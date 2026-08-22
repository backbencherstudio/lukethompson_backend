import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import {
  QueryShipperDto,
  QueryShipperStatus,
  QueryType,
  SearchShipperDto,
} from './dto/query-shipper.dto';
import { ClaimStatus, Prisma } from '../../../../prisma/generated/client';
import { CreateShipperDto, CreateShipperRatingDto } from './dto/create-shipper.dto';

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

  async createShipper(dto: CreateShipperDto) {
    const {
      name,
      address,
      city,
      state,
      zip,
      country,
      lat,
      lng,
      brokerId,
      brokerName,
      brokerEmail,
    } = dto;

    // --- 1. Validate broker input ---
    if (!brokerId && brokerName && !brokerEmail) {
      throw new BadRequestException(
        'Broker email is required when creating a new broker',
      );
    }

    // --- 2. Check shipper uniqueness ---
    const normalizedName = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '_');

    // --- 3. Use transaction to ensure all operations succeed or rollback ---
    return await this.prisma.$transaction(async (tx) => {
      // Check if facility already exists
      const existingFacility = await tx.shipperFacility.findUnique({
        where: { normalized_name: normalizedName },
      });

      if (existingFacility) {
        throw new ConflictException(
          `A facility with name "${name}" already exists`,
        );
      }

      // --- 4. Create location (if provided) ---
      let locationId: string | undefined;

      if (
        address ||
        city ||
        state ||
        zip ||
        country ||
        lat !== undefined ||
        lng !== undefined
      ) {
        const location = await tx.location.create({
          data: {
            address: address || null,
            city: city || null,
            state: state || null,
            zip: zip || null,
            country: country || 'USA',
            lat: lat !== undefined ? lat : null,
            lng: lng !== undefined ? lng : null,
          },
        });
        locationId = location.id;
      }

      // --- 5. Handle broker ---
      let finalBrokerId: string | null = null;

      if (brokerId) {
        // Use existing broker
        const existingBroker = await tx.broker.findUnique({
          where: { id: brokerId },
        });

        if (!existingBroker) {
          throw new NotFoundException(`Broker with ID "${brokerId}" not found`);
        }

        finalBrokerId = brokerId;
      } else if (brokerName && brokerEmail) {
        // Create new broker
        // Check if broker with same email or name already exists
        const existingBroker = await tx.broker.findFirst({
          where: {
            OR: [{ email: brokerEmail }, { name: brokerName.trim() }],
          },
        });

        if (existingBroker) {
          throw new ConflictException(
            `A broker with name "${brokerName}" or email "${brokerEmail}" already exists`,
          );
        }

        const newBroker = await tx.broker.create({
          data: {
            name: brokerName.trim(),
            email: brokerEmail.trim(),
          },
        });

        finalBrokerId = newBroker.id;
      }
      // If neither brokerId nor brokerName+email, finalBrokerId remains null

      // --- 6. Create shipper facility ---
      const shipper = await tx.shipperFacility.create({
        data: {
          name: name.trim(),
          normalized_name: normalizedName,
          location_id: locationId || null,
          broker_id: finalBrokerId,
        },
        include: {
          location: true,
          broker: true,
        },
      });

      return ResponseHelper.success({
        message: 'Shipper facility created successfully',
        data: shipper,
      });
    });
  }

  async getAllShippers(query: QueryShipperDto) {
    const {
      type = QueryType.SHIPPER,
      cursor,
      limit = 10,
      search,
      status = QueryShipperStatus.ALL,
    } = query;

    // --- Handle BROKER type - fetch directly from broker table ---
    if (type === QueryType.BROKER) {
      return await this.getAllBrokers({ cursor, limit, search });
    }

    // --- Handle SHIPPER type (default) - fetch from shipper_facilities table ---
    const where: Prisma.ShipperFacilityWhereInput = {};
    let matchedIds: { id: string }[] = [];

    if (search) {
      await this.ensurePgTrgm();
      matchedIds = await this.prisma.$queryRaw`
      SELECT sf.id
      FROM shipper_facilities sf
      LEFT JOIN locations l ON sf.location_id = l.id
      LEFT JOIN brokers b ON sf.broker_id = b.id
      WHERE sf.name ILIKE ${'%' + search + '%'}
         OR coalesce(l.address, '') ILIKE ${'%' + search + '%'}
         OR b.name ILIKE ${'%' + search + '%'}
         OR similarity(sf.name, ${search}) > 0.15
         OR similarity(coalesce(l.address, ''), ${search}) > 0.15
         OR similarity(b.name, ${search}) > 0.15
      ORDER BY greatest(
        similarity(sf.name, ${search}), 
        similarity(coalesce(l.address, ''), ${search}),
        similarity(b.name, ${search})
      ) DESC
    `;
      const ids = (matchedIds || []).map((m) => m?.id).filter(Boolean);
      where.id = { in: ids };
    }

    // Fetch all shippers matching the filter, along with their claims, ratings, and broker
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
        broker: {
          select: {
            id: true,
            name: true,
            email: true,
            created_at: true,
            updated_at: true,
          },
        },
        location: {
          select: {
            address: true,
            city: true,
            state: true,
            zip: true,
            country: true,
          },
        },
      },
    });

    // Aggregate statistics in memory for each shipper
    const mappedShippers = shippers.map((shipper) => {
      const claims = shipper.claims || [];
      const ratings = shipper.ratings || [];

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
        broker: shipper.broker
          ? {
              id: shipper.broker.id,
              name: shipper.broker.name,
              email: shipper.broker.email,
              created_at: shipper.broker.created_at,
              updated_at: shipper.broker.updated_at,
            }
          : null,
        location: shipper.location
          ? {
              address: shipper.location.address,
              city: shipper.location.city,
              state: shipper.location.state,
              zip: shipper.location.zip,
              country: shipper.location.country,
            }
          : null,
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
          type: QueryType.SHIPPER,
        },
        total_count: filteredShippers.length,
      },
    });
  }

  // --- Get all brokers directly from broker table ---
  private async getAllBrokers(query: {
    cursor?: string;
    limit?: number;
    search?: string;
  }) {
    const { cursor, limit = 10, search } = query;

    const where: Prisma.BrokerWhereInput = {};
    let matchedIds: { id: string }[] = [];

    if (search) {
      await this.ensurePgTrgm();
      matchedIds = await this.prisma.$queryRaw`
    SELECT b.id
    FROM brokers b
    WHERE b.name ILIKE ${'%' + search + '%'}
       OR b.email ILIKE ${'%' + search + '%'}
       OR similarity(b.name, ${search}) > 0.15
       OR similarity(b.email, ${search}) > 0.15
    ORDER BY greatest(
      similarity(b.name, ${search}),
      similarity(b.email, ${search})
    ) DESC
  `;
      const ids = (matchedIds || []).map((m) => m?.id).filter(Boolean);
      where.id = { in: ids };
    }

    // Fetch all brokers from the broker table with their ratings and shipper facilities
    const brokers = await this.prisma.broker.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        ratings: {
          select: {
            rating: true,
            review: true,
            user_id: true,
            created_at: true,
          },
        },
        shipperFacilities: {
          select: {
            id: true,
            name: true,
            location: {
              select: {
                address: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    // If no brokers found, return empty result with appropriate message
    if (brokers.length === 0) {
      return ResponseHelper.success({
        message: search
          ? 'No brokers found matching your search'
          : 'No brokers available',
        data: [],
        meta_data: {
          next_cursor: null,
          limit: Number(limit),
          search,
          filters: {
            type: QueryType.BROKER,
          },
          total_count: 0,
        },
      });
    }

    // Define the return type explicitly
    interface MappedBroker {
      id: string;
      name: string;
      email: string | null;
      created_at: Date;
      updated_at: Date;
      avg_rating: number;
      rating_category: string;
      total_ratings: number;
      total_shippers: number;
      recent_shippers: Array<{
        id: string;
        name: string;
        location: {
          address: string | null;
          city: string | null;
          state: string | null;
        } | null;
      }>;
    }

    // Map broker data with explicit typing
    const mappedBrokers: MappedBroker[] = brokers.map((broker) => {
      const ratings = broker.ratings || [];
      const shipperFacilities = broker.shipperFacilities || [];

      // Calculate average rating (0-100)
      let avg_rating = 0;
      if (ratings.length > 0) {
        const sumRating = ratings.reduce((sum, r) => sum + Number(r.rating), 0);
        avg_rating = Math.round(sumRating / ratings.length);
      }

      // Count distinct users who rated this broker
      const distinctUsers = new Set(ratings.map((r) => r.user_id));
      const total_ratings = distinctUsers.size;

      // Count shipper facilities associated with this broker
      const total_shippers = shipperFacilities.length;

      // Get recent shippers (last 5)
      const recent_shippers = shipperFacilities.slice(0, 5).map((sf) => ({
        id: sf.id,
        name: sf.name,
        location: sf.location
          ? {
              address: sf.location.address,
              city: sf.location.city,
              state: sf.location.state,
            }
          : null,
      }));

      // Determine rating category
      let rating_category = 'Poor';
      if (avg_rating >= 80) {
        rating_category = 'Excellent';
      } else if (avg_rating >= 60) {
        rating_category = 'Good';
      } else if (avg_rating >= 40) {
        rating_category = 'Average';
      } else if (avg_rating > 0) {
        rating_category = 'Poor';
      } else {
        rating_category = 'Not Rated';
      }

      return {
        id: broker.id,
        name: broker.name,
        email: broker.email,
        created_at: broker.created_at,
        updated_at: broker.updated_at,
        avg_rating,
        rating_category,
        total_ratings,
        total_shippers,
        recent_shippers,
      };
    });

    // Apply cursor pagination in memory
    let startIndex = 0;
    if (cursor) {
      const index = mappedBrokers.findIndex((s) => s.id === cursor);
      if (index !== -1) {
        startIndex = index + 1;
      }
    }

    const paginatedBrokers = mappedBrokers.slice(
      startIndex,
      startIndex + Number(limit),
    );

    const nextCursor =
      startIndex + Number(limit) < mappedBrokers.length
        ? mappedBrokers[startIndex + Number(limit) - 1].id
        : null;

    return ResponseHelper.success({
      message: 'Brokers fetched successfully from broker table',
      data: paginatedBrokers,
      meta_data: {
        next_cursor: nextCursor,
        limit: Number(limit),
        search,
        filters: {
          type: QueryType.BROKER,
        },
        total_count: mappedBrokers.length,
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
    prisma?: Prisma.TransactionClient,
  ) {
    // Use provided transaction client or create a new one
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Get the stop log with shipper facility and broker
      const stopLog = await tx.stopLog.findFirst({
        where: { id: stop_log_id, user_id },
        include: {
          shipper_facility: {
            include: {
              broker: true,
            },
          },
        },
      });

      if (!stopLog) {
        throw new NotFoundException('Stop log not found');
      }

      if (!stopLog.shipper_facility_id) {
        throw new BadRequestException(
          'This stop log does not have an associated shipper facility',
        );
      }

      const results: any = {
        shipper_rating: null,
        broker_rating: null,
      };

      // 2. Check for existing shipper rating
      const existingShipperRating = await tx.shipperFacilityRating.findUnique({
        where: { stop_log_id },
      });

      if (existingShipperRating) {
        throw new BadRequestException(
          'Shipper rating already exists for this stop log',
        );
      }

      // 3. Create shipper facility rating
      results.shipper_rating = await tx.shipperFacilityRating.create({
        data: {
          rating: dto.rate,
          user_id,
          shipper_facility_id: stopLog.shipper_facility_id,
          stop_log_id,
        },
      });

      // 4. Handle broker rating if brokerRate is provided
      if (dto.brokerRate !== undefined && dto.brokerRate !== null) {
        // Check if shipper facility has a broker
        if (!stopLog.shipper_facility?.broker_id) {
          throw new BadRequestException(
            'This shipper facility does not have an associated broker',
          );
        }

        // Check if broker rating already exists for this stop log
        const existingBrokerRating = await tx.brokerRating.findFirst({
          where: {
            stop_log_id,
            user_id,
          },
        });

        if (existingBrokerRating) {
          throw new BadRequestException(
            'Broker rating already exists for this stop log',
          );
        }

        // Create broker rating
        results.broker_rating = await tx.brokerRating.create({
          data: {
            rating: dto.brokerRate,
            user_id,
            broker_id: stopLog.shipper_facility.broker_id,
            stop_log_id,
          },
          include: {
            broker: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });
      }

      return results;
    };

    // Execute with transaction
    if (prisma) {
      // If transaction client is provided, use it directly
      const results = await execute(prisma);
      return ResponseHelper.success({
        message: results.broker_rating
          ? 'Shipper and broker ratings submitted successfully'
          : 'Shipper rating submitted successfully',
        data: results,
      });
    } else {
      // Create new transaction
      return this.prisma.$transaction(async (tx) => {
        const results = await execute(tx);
        return ResponseHelper.success({
          message: results.broker_rating
            ? 'Shipper and broker ratings submitted successfully'
            : 'Shipper rating submitted successfully',
          data: results,
        });
      });
    }
  }

  async searchShippers(query: SearchShipperDto) {
    const { search, cursor, limit = 10, type = QueryType.SHIPPER } = query;

    // --- Handle BROKER type ---
    if (type === QueryType.BROKER) {
      return this.searchBrokers({ cursor, limit, search });
    }

    // --- Handle SHIPPER type (default) ---
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
            lat: true,
            lng: true,
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
          lat: f.location?.lat ?? null,
          lng: f.location?.lng ?? null,
          rating,
        };
      })
      .filter(Boolean);

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
        filters: {
          type: QueryType.SHIPPER,
        },
      },
    });
  }

  // --- Search brokers ---
  private async searchBrokers(query: {
    cursor?: string;
    limit?: number;
    search?: string;
  }) {
    const { cursor, limit = 10, search } = query;

    const where: Prisma.BrokerWhereInput = {};
    let matchedIds: { id: string }[] = [];

    if (search) {
      await this.ensurePgTrgm();
      matchedIds = await this.prisma.$queryRaw`
      SELECT b.id
      FROM brokers b
      WHERE b.name ILIKE ${'%' + search + '%'}
         OR b.email ILIKE ${'%' + search + '%'}
         OR similarity(b.name, ${search}) > 0.15
         OR similarity(b.email, ${search}) > 0.15
      ORDER BY greatest(
        similarity(b.name, ${search}),
        similarity(b.email, ${search})
      ) DESC
      LIMIT 100
    `;
      const ids = (matchedIds || []).map((m) => m?.id).filter(Boolean);
      where.id = { in: ids };
    }

    // Fetch all brokers from the broker table with their ratings
    const brokers = await this.prisma.broker.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        ratings: {
          select: {
            rating: true,
            user_id: true,
          },
        },
        shipperFacilities: {
          select: {
            id: true,
            name: true,
            location: {
              select: {
                address: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    // If no brokers found, return empty result
    if (brokers.length === 0) {
      return ResponseHelper.success({
        message: search
          ? 'No brokers found matching your search'
          : 'No brokers available',
        data: [],
        meta_data: {
          next_cursor: null,
          limit: Number(limit),
          search,
          filters: {
            type: QueryType.BROKER,
          },
          total_count: 0,
        },
      });
    }

    // Map broker data for search results
    const mappedBrokers = brokers.map((broker) => {
      const ratings = broker.ratings || [];
      const shipperFacilities = broker.shipperFacilities || [];

      // Calculate average rating (0-100)
      let avg_rating = 0;
      if (ratings.length > 0) {
        const sumRating = ratings.reduce((sum, r) => sum + Number(r.rating), 0);
        avg_rating = Math.round(sumRating / ratings.length);
      }

      // Get the first shipper facility as the main location (if any)
      const firstFacility = shipperFacilities[0];
      let address = null;
      let lat = null;
      let lng = null;

      if (firstFacility?.location) {
        address =
          firstFacility.location.address ||
          [firstFacility.location.city, firstFacility.location.state]
            .filter(Boolean)
            .join(', ') ||
          null;
        // Note: Broker model doesn't have lat/lng directly,
        // you might want to add these to the Broker model or use the facility's location
      }

      return {
        id: broker.id,
        name: broker.name,
        address: address,
        lat: lat,
        lng: lng,
        rating: avg_rating,
        // Additional broker-specific fields for search
        email: broker.email,
        total_shippers: shipperFacilities.length,
      };
    });

    // Apply cursor pagination in memory
    let startIndex = 0;
    if (cursor) {
      const index = mappedBrokers.findIndex((s) => s.id === cursor);
      if (index !== -1) {
        startIndex = index + 1;
      }
    }

    const paginatedBrokers = mappedBrokers.slice(
      startIndex,
      startIndex + Number(limit),
    );

    const nextCursor =
      startIndex + Number(limit) < mappedBrokers.length
        ? mappedBrokers[startIndex + Number(limit) - 1].id
        : null;

    return ResponseHelper.success({
      message: 'Brokers searched successfully',
      data: paginatedBrokers,
      meta_data: {
        next_cursor: nextCursor,
        limit: Number(limit),
        search,
        filters: {
          type: QueryType.BROKER,
        },
        total_count: mappedBrokers.length,
      },
    });
  }
}
