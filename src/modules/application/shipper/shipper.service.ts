import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import { QueryShipperDto, QueryShipperStatus } from './dto/query-shipper.dto';
import { ClaimStatus, Prisma } from 'prisma/generated/client';

@Injectable()
export class ShipperService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllShippers(query: QueryShipperDto) {
    const {
      cursor,
      limit = 10,
      search,
      status = QueryShipperStatus.ALL,
    } = query;

    const where: Prisma.ShipperFacilityWhereInput = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Fetch all shippers matching the name filter, along with their claims and ratings
    const shippers = await this.prisma.shipperFacility.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        claims: {
          select: {
            id: true,
            status: true,
            created_at: true,
            sent_at: true,
            paid_at: true,
            user_id: true,
          },
        },
        ratings: {
          select: {
            rating: true,
          },
        },
      },
    });

    // Aggregate statistics in memory for each shipper
    const mappedShippers = shippers.map((shipper) => {
      const claims = shipper.claims;
      const ratings = shipper.ratings;

      const claims_count = claims.length;
      const paidClaims = claims.filter((c) => c.status === ClaimStatus.PAID);
      const paid_claims_count = paidClaims.length;

      // 1. Calculate average pay days for paid claims
      let avg_pay_days: number | null = null;
      if (paidClaims.length > 0) {
        let totalDays = 0;
        paidClaims.forEach((c) => {
          const paidTime = c.paid_at ? new Date(c.paid_at).getTime() : 0;
          const startTime =
            (c.sent_at ?? c.created_at)
              ? new Date(c.sent_at ?? c.created_at).getTime()
              : 0;
          const diffDays = Math.max(
            0,
            (paidTime - startTime) / (1000 * 60 * 60 * 24),
          );
          totalDays += diffDays;
        });
        avg_pay_days = Math.round(totalDays / paidClaims.length);
      }

      // 2. Calculate aggregate score rating (0-100)
      let rating = 0;
      if (ratings.length > 0) {
        const sumRating = ratings.reduce((sum, r) => sum + Number(r.rating), 0);
        rating = Math.round(sumRating / ratings.length);
      } else {
        // Fallback to payment success rate if no ratings exist
        rating =
          claims_count > 0
            ? Math.round((paid_claims_count / claims_count) * 100)
            : 0;
      }

      // 3. Calculate distinct drivers reporting non-payment (denied status)
      const nonPaymentClaims = claims.filter(
        (c) => c.status === ClaimStatus.DENIED,
      );
      const distinctDriversNonPayment = new Set(
        nonPaymentClaims.map((c) => c.user_id),
      );
      const non_payment_reports_count = distinctDriversNonPayment.size;

      // 4. Determine status subtext
      let status_subtext = 'Poor payer';
      if (rating >= 80) {
        status_subtext =
          avg_pay_days !== null
            ? `Known good payer • Avg. ${avg_pay_days} days to pay`
            : 'Known good payer';
      } else if (rating >= 40) {
        status_subtext = 'Mixed payment history';
      } else {
        if (non_payment_reports_count > 0) {
          status_subtext = `${non_payment_reports_count} drivers reported non-payment`;
        } else {
          status_subtext = 'Poor payer';
        }
      }

      return {
        id: shipper.id,
        facility_name: shipper.name,
        rating,
        status_subtext,
        claims_count,
        avg_pay_days,
        paid_claims_count,
      };
    });

    // Apply category status filter in memory
    let filteredShippers = mappedShippers;

    if (status === QueryShipperStatus.GOOD_PAYERS) {
      filteredShippers = filteredShippers.filter((s) => s.rating >= 80);
    } else if (status === QueryShipperStatus.AVERAGE) {
      filteredShippers = filteredShippers.filter(
        (s) => s.rating >= 40 && s.rating < 80,
      );
    } else if (status === QueryShipperStatus.POOR_PAYERS) {
      filteredShippers = filteredShippers.filter((s) => s.rating < 40);
    }

    // Apply cursor pagination in memory over the filtered subset
    let startIndex = 0;
    if (cursor) {
      const index = filteredShippers.findIndex((s) => s.id === cursor);
      if (index !== -1) {
        startIndex = index + 1;
      }
    }

    const paginatedShippers = filteredShippers.slice(
      startIndex,
      startIndex + Number(limit),
    );

    const nextCursor =
      startIndex + Number(limit) < filteredShippers.length
        ? filteredShippers[startIndex + Number(limit) - 1].id
        : null;

    return ResponseHelper.success({
      message: 'Shipper ratings fetched successfully',
      data: paginatedShippers,
      meta_data: {
        next_cursor: nextCursor,
        limit: Number(limit),
        search,
        filters: {
          status,
        },
      },
    });
  }

  async getOneShipper(id: string) {
    const shipper = await this.prisma.shipperFacility.findUnique({
      where: { id },
      include: {
        claims: {
          select: {
            id: true,
            status: true,
            created_at: true,
            sent_at: true,
            paid_at: true,
          },
        },
        ratings: {
          select: {
            rating: true,
          },
        },
      },
    });

    if (!shipper) {
      throw new NotFoundException('Shipper facility not found');
    }

    const claims = shipper.claims;
    const ratings = shipper.ratings;

    const total_claims_submitted = claims.length;
    const paidClaims = claims.filter((c) => c.status === ClaimStatus.PAID);
    const total_paid = paidClaims.length;
    const total_denied = claims.filter(
      (c) => c.status === ClaimStatus.DENIED,
    ).length;

    // calculate avg_pay_days
    let avg_pay_days: number | null = null;
    if (paidClaims.length > 0) {
      let totalDays = 0;
      paidClaims.forEach((c) => {
        const paidTime = c.paid_at ? new Date(c.paid_at).getTime() : 0;
        const startTime =
          (c.sent_at ?? c.created_at)
            ? new Date(c.sent_at ?? c.created_at).getTime()
            : 0;
        const diffDays = Math.max(
          0,
          (paidTime - startTime) / (1000 * 60 * 60 * 24),
        );
        totalDays += diffDays;
      });
      avg_pay_days = Math.round(totalDays / paidClaims.length);
    }

    // calculate rating (0-100)
    let rating = 0;
    if (ratings.length > 0) {
      const sumRating = ratings.reduce((sum, r) => sum + Number(r.rating), 0);
      rating = Math.round(sumRating / ratings.length);
    } else {
      rating =
        total_claims_submitted > 0
          ? Math.round((total_paid / total_claims_submitted) * 100)
          : 0;
    }

    return ResponseHelper.success({
      message: 'Shipper rating details fetched successfully',
      data: {
        id: shipper.id,
        facility_name: shipper.name,
        rating,
        total_claims_submitted,
        avg_pay_days,
        total_paid,
        total_denied,
      },
    });
  }
}
