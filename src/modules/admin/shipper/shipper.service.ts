import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NajimStorage } from '../../../common/lib/Disk/NajimStorage';
import appConfig from '../../../config/app.config';
import { QueryShipperRatingDto } from './dto/query-shipper.dto';
import { Prisma } from '../../../../prisma/generated/client';

@Injectable()
export class ShipperService {
  constructor(private readonly prisma: PrismaService) {}

  async getRatings(query: QueryShipperRatingDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ShipperFacilityRatingWhereInput = {};

    if (search) {
      whereClause.OR = [
        {
          shipper_facility: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, ratings] = await Promise.all([
      this.prisma.shipperFacilityRating.count({ where: whereClause }),
      this.prisma.shipperFacilityRating.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        skip: Number(skip),
        take: Number(limit),
        select: {
          id: true,
          rating: true,
          review: true,
          created_at: true,
          shipper_facility: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    const formattedRatings = ratings.map((item) => {
      let avatarUrl = item.user?.avatar || null;
      if (item.user?.avatar) {
        avatarUrl = NajimStorage.url(
          appConfig().storageUrl.avatar + item.user.avatar,
          { signed: true },
        );
      }

      return {
        id: item.id,
        shipper_facility_id: item.shipper_facility?.id || null,
        shipper_facility_name: item.shipper_facility?.name || null,
        rate: Number(item.rating),
        review: item.review,
        created_at: item.created_at,
        user: item.user
          ? {
              id: item.user.id,
              name: item.user.name,
              email: item.user.email,
              avatar: avatarUrl,
            }
          : null,
      };
    });

    return {
      success: true,
      message: 'Ratings retrieved successfully',
      data: formattedRatings,
      meta_data: {
        total,
        page: Number(page),
        limit: Number(limit),
      },
    };
  }

  async getStats() {
    const [totalUsers, totalReviews, totalFacilities] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.shipperFacilityRating.count(),
      this.prisma.shipperFacility.count(),
    ]);

    return {
      success: true,
      message: 'Shipper statistics retrieved successfully',
      data: {
        total_users: totalUsers,
        total_reviews: totalReviews,
        total_facilities: totalFacilities,
      },
    };
  }

  async deleteRating(id: string) {
    const rating = await this.prisma.shipperFacilityRating.findUnique({
      where: { id },
    });
    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    await this.prisma.shipperFacilityRating.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Rating deleted successfully',
    };
  }
}
