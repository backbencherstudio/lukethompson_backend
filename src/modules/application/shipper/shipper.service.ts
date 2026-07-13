import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import {
  QueryShipperDto,
  QueryShipperStatus,
  SearchShipperDto,
} from './dto/query-shipper.dto';
import { ClaimStatus, Prisma } from '../../../../prisma/generated/client';
import { CreateShipperRatingDto } from './dto/create-shipper.dto';

@Injectable()
export class ShipperService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensurePgTrgm() {
    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      );
    } catch (err) {
      console.error('Failed to ensure pg_trgm extension:', err);
    }
  }

  async getAllShippers(query: QueryShipperDto) {
    const {
      cursor,
      limit = 10,
      search,
      status = QueryShipperStatus.ALL,
    } = query;

    const where: Prisma.ShipperFacilityWhereInput = {};
    let matchedIds: { id: string }[] = [];

    if (search) {
      await this.ensurePgTrgm();
      matchedIds = await this.prisma.$queryRaw`
        SELECT sf.id
        FROM shipper_facilities sf
        LEFT JOIN locations l ON sf.location_id = l.id
        WHERE sf.name ILIKE ${'%' + search + '%'}
           OR coalesce(l.address, '') ILIKE ${'%' + search + '%'}
           OR similarity(sf.name, ${search}) > 0.15
           OR similarity(coalesce(l.address, ''), ${search}) > 0.15
        ORDER BY greatest(similarity(sf.name, ${search}), similarity(coalesce(l.address, ''), ${search})) DESC
      `;
      const ids = (matchedIds || []).map((m) => m?.id).filter(Boolean);
      where.id = { in: ids };
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

    if (search) {
      const ids = (matchedIds || []).map((m) => m?.id).filter(Boolean);
      filteredShippers.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }

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

  async createRating(
    stop_log_id: string,
    user_id: string,
    dto: CreateShipperRatingDto,
  ) {
    const stopLog = await this.prisma.stopLog.findFirst({
      where: { id: stop_log_id, user_id },
    });

    if (!stopLog) {
      throw new NotFoundException('Stop log not found');
    }

    if (!stopLog.shipper_facility_id) {
      throw new BadRequestException(
        'This stop log does not have an associated shipper facility',
      );
    }

    const existingRating = await this.prisma.shipperFacilityRating.findUnique({
      where: { stop_log_id },
    });

    if (existingRating) {
      throw new BadRequestException('Rating already exists for this stop log');
    }

    const rating = await this.prisma.shipperFacilityRating.create({
      data: {
        rating: dto.rate,
        user_id,
        shipper_facility_id: stopLog.shipper_facility_id,
        stop_log_id,
      },
    });

    return ResponseHelper.success({
      message: 'Rating submitted successfully',
      data: rating,
    });
  }

  async searchShippers(query: SearchShipperDto) {
    const { search, cursor, limit = 10 } = query;

    let matchedIds: { id: string }[] = [];

    if (search) {
      await this.ensurePgTrgm();
      matchedIds = await this.prisma.$queryRaw`
        SELECT sf.id
        FROM shipper_facilities sf
        LEFT JOIN locations l ON sf.location_id = l.id
        WHERE sf.name ILIKE ${'%' + search + '%'}
           OR coalesce(l.address, '') ILIKE ${'%' + search + '%'}
           OR similarity(sf.name, ${search}) > 0.15
           OR similarity(coalesce(l.address, ''), ${search}) > 0.15
        ORDER BY greatest(similarity(sf.name, ${search}), similarity(coalesce(l.address, ''), ${search})) DESC
        LIMIT 100
      `;
    }

    const ids = (matchedIds || []).map((m) => m?.id).filter(Boolean);

    const where: Prisma.ShipperFacilityWhereInput = {};
    if (search) {
      where.id = { in: ids };
    }

    const facilities = await this.prisma.shipperFacility.findMany({
      where,
      include: {
        location: {
          select: {
            address: true,
            city: true,
            state: true,
            zip: true,
          },
        },
        claims: {
          select: {
            status: true,
          },
        },
        ratings: {
          select: {
            rating: true,
          },
        },
      },
    });

    const mapped = (facilities || [])
      .map((f) => {
        if (!f) return null;
        let addressStr = f.location?.address || '';
        if (!addressStr && f.location) {
          const parts = [
            f.location.city,
            f.location.state,
            f.location.zip,
          ].filter(Boolean);
          addressStr = parts.join(', ');
        }

        const claims = f.claims || [];
        const ratings = f.ratings || [];
        const claims_count = claims.length;
        const paid_claims_count = claims.filter(
          (c) => c.status === ClaimStatus.PAID,
        ).length;

        let rating = 0;
        if (ratings.length > 0) {
          const sumRating = ratings.reduce(
            (sum, r) => sum + Number(r.rating),
            0,
          );
          rating = Math.round(sumRating / ratings.length);
        } else {
          rating =
            claims_count > 0
              ? Math.round((paid_claims_count / claims_count) * 100)
              : 0;
        }

        return {
          id: f.id,
          name: f.name,
          address: addressStr || null,
          rating,
        };
      })
      .filter(Boolean);

    // Sort by SQL query ranking order if search is provided
    if (search) {
      mapped.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }

    // Apply cursor pagination in memory
    let startIndex = 0;
    if (cursor) {
      const index = mapped.findIndex((s) => s.id === cursor);
      if (index !== -1) {
        startIndex = index + 1;
      }
    }

    const paginated = mapped.slice(startIndex, startIndex + Number(limit));

    const nextCursor =
      startIndex + Number(limit) < mapped.length
        ? mapped[startIndex + Number(limit) - 1].id
        : null;

    return ResponseHelper.success({
      message: 'Shipper facilities searched successfully',
      data: paginated,
      meta_data: {
        next_cursor: nextCursor,
        limit: Number(limit),
        search,
      },
    });
  }
}
