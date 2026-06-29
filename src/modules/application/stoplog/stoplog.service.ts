import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LogStopStep, PutStopLogDto } from './dto/create-stoplog.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import {
  Period,
  QueryHomeDataDto,
  QueryReportDto,
  QueryStopLogDto,
  ReportPeriod,
  ReportTab,
  StopLogStatus as QueryStopLogStatus,
} from './dto/query-stoplog.dto';
import {
  ClaimStatus,
  Prisma,
  StopLogStatus as PrismaStopLogStatus,
} from 'prisma/generated/client';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';

type StepState = Pick<
  Prisma.StopLogUncheckedCreateInput,
  'arrived_at' | 'docked_at' | 'completed_at' | 'departed_at'
>;

@Injectable()
export class StopLogService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly STEP_CONFIG = {
    [LogStopStep.ARRIVAL_TIME]: { prev: null, field: 'arrived_at' },
    [LogStopStep.DOCK_IN_TIME]: {
      prev: LogStopStep.ARRIVAL_TIME,
      field: 'docked_at',
    },
    [LogStopStep.COMPLETED_TIME]: {
      prev: LogStopStep.DOCK_IN_TIME,
      field: 'completed_at',
    },
    [LogStopStep.DEPARTURE_TIME]: {
      prev: LogStopStep.COMPLETED_TIME,
      field: 'departed_at',
    },
  };

  private getCurrentStep(stopLog: StepState): LogStopStep {
    if (stopLog.departed_at) return LogStopStep.DEPARTURE_TIME;
    if (stopLog.completed_at) return LogStopStep.COMPLETED_TIME;
    if (stopLog.docked_at) return LogStopStep.DOCK_IN_TIME;
    return LogStopStep.ARRIVAL_TIME;
  }

  private getStopLogAddress(stopLog: {
    facility_address?: { address: string | null } | null;
    arrival_location?: { address: string | null } | null;
  }) {
    return (
      stopLog.facility_address?.address ||
      stopLog.arrival_location?.address ||
      null
    );
  }

  private getHomeDataPeriodStart(period: Period, date: Date) {
    const start = new Date(date);

    switch (period) {
      case Period.TODAY:
        start.setHours(0, 0, 0, 0);
        return start;
      case Period.WEEK:
        start.setDate(start.getDate() - 7);
        return start;
      case Period.MONTH:
        start.setMonth(start.getMonth() - 1);
        return start;
      case Period.YEAR:
        start.setFullYear(start.getFullYear() - 1);
        return start;
    }
  }

  private getWeekStart(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysFromMonday);
    return start;
  }

  private formatHoursMinutes(hours: number) {
    const totalMinutes = Math.round(hours * 60);
    const formattedHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${formattedHours}h ${minutes}m`;
  }

  private async uploadStopLogAttachments(
    attachments: PutStopLogDto['attachments'] = [],
  ) {
    const uploadedAttachments: Prisma.AttachmentCreateInput[] = [];

    for (const attachment of attachments) {
      try {
        const fileName = NajimStorage.generateFilename(attachment.originalname);
        const objectKey = `${appConfig().storageUrl.stopLog}/${fileName}`;

        await NajimStorage.put(objectKey, attachment.buffer);

        uploadedAttachments.push({
          type: 'OTHER',
          file_name: fileName,
          file_url: objectKey,
          mime_type: attachment.mimetype,
          size_bytes: attachment.size,
        });
      } catch (error) {
        console.log('Error during attachment upload stoplog DTO:', error);
      }
    }

    return uploadedAttachments;
  }

  private async deleteUploadedAttachments(
    attachments: Prisma.AttachmentCreateInput[],
  ) {
    for (const attachment of attachments) {
      try {
        await NajimStorage.delete(attachment.file_url);
      } catch (error) {
        console.log('Error during attachment deletion stoplog DTO:', error);
      }
    }
  }

  private async createLocation(
    tx: Prisma.TransactionClient,
    location: NonNullable<PutStopLogDto['location']>,
  ) {
    const createdLocation = await tx.location.create({
      data: {
        ...location,
      },
      select: {
        id: true,
      },
    });

    return createdLocation.id;
  }

  private async resolveShipperFacility(
    tx: Prisma.TransactionClient,
    dto: PutStopLogDto,
    locationId?: string,
  ) {
    if (dto.shipper_id) {
      const shipperFacility = await tx.shipperFacility.findUnique({
        where: { id: dto.shipper_id },
        select: { id: true, name: true },
      });

      if (!shipperFacility) {
        throw new BadRequestException('Invalid shipper id');
      }

      return shipperFacility;
    }

    if (!dto.facility_name?.trim()) {
      throw new BadRequestException(
        'Facility name is required when shipper id is not provided',
      );
    }

    if (
      !dto.location ||
      !(
        dto.location.address ||
        dto.location.city ||
        dto.location.state ||
        dto.location.country ||
        dto.location.zip
      )
    ) {
      throw new BadRequestException(
        'Arrival location is required when shipper id is not provided',
      );
    }

    const facilityName = dto.facility_name.trim();
    const normalizedName = [
      facilityName,
      dto.location.address,
      dto.location.city,
      dto.location.state,
      dto.location.country,
      dto.location.zip,
    ]
      .map((value) => value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '')
      .filter(Boolean)
      .join('|');

    const existingShipperFacility = await tx.shipperFacility.findUnique({
      where: {
        normalized_name: normalizedName,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (existingShipperFacility) {
      return existingShipperFacility;
    }

    return tx.shipperFacility.create({
      data: {
        name: facilityName,
        normalized_name: normalizedName,
        location_id: locationId,
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  async putStopLog(dto: PutStopLogDto, user_id: string) {
    const { step, bol_number } = dto;
    const config = this.STEP_CONFIG[step];
    if (!config) {
      throw new BadRequestException('Invalid stop log step');
    }

    // 1. Fetch active log first (outside transaction, for validation and optimization)
    const activeLog = dto.id
      ? await this.prisma.stopLog.findUnique({
          where: { id: dto.id },
          select: {
            id: true,
            arrived_at: true,
            docked_at: true,
            completed_at: true,
            departed_at: true,
            bol_number: true,
            user_id: true,
            _count: {
              select: {
                attachments: true,
              },
            },
          },
        })
      : await this.prisma.stopLog.findFirst({
          where: { user_id, departed_at: null },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            arrived_at: true,
            docked_at: true,
            completed_at: true,
            departed_at: true,
            bol_number: true,
            user_id: true,
            _count: {
              select: {
                attachments: true,
              },
            },
          },
        });

    // 2. Validate ownership
    if (activeLog && activeLog.user_id !== user_id) {
      throw new UnauthorizedException('Unauthorized access to stop log');
    }

    // 3. Check if departure has occurred or is occurring
    const isDepartureOrDeparted =
      step === LogStopStep.DEPARTURE_TIME || Boolean(activeLog?.departed_at);

    // 4. Enforce that bol_number and attachments are ONLY allowed during/after departure
    const hasNewAttachments = dto.attachments && dto.attachments.length > 0;
    if (!isDepartureOrDeparted) {
      if (hasNewAttachments || bol_number) {
        throw new BadRequestException(
          'BOL number and attachments can only be provided during or after departure',
        );
      }
    }

    // 5. Enforce that attachment is MANDATORY for departure/departed logs
    if (isDepartureOrDeparted) {
      const totalAttachmentsCount =
        (activeLog?._count?.attachments || 0) +
        (hasNewAttachments ? dto.attachments.length : 0);
      if (totalAttachmentsCount === 0) {
        throw new BadRequestException(
          'At least one attachment is mandatory for departure',
        );
      }
    }

    // 6. Validate step sequence (if not already departed)
    if (step === LogStopStep.ARRIVAL_TIME) {
      if (activeLog) {
        throw new BadRequestException(
          'An active stop log is already in progress',
        );
      }
    } else {
      if (!activeLog) {
        throw new BadRequestException(
          'No active stop log found. Start with Arrival.',
        );
      }
      // If the log is already departed, we only allow updating bol_number and attachments
      // If it is not yet departed, we enforce the step sequence
      if (
        !activeLog.departed_at &&
        this.getCurrentStep(activeLog) !== config.prev
      ) {
        throw new BadRequestException(
          `Invalid sequence. Next step should be: ${config.prev}`,
        );
      }
    }

    // 7. Upload attachments now that validation has passed
    const uploadedAttachments = await this.uploadStopLogAttachments(
      dto.attachments,
    );

    const stopLogSelect = {
      id: true,
      user_id: true,
      shipper_facility_id: true,
      shipper_name: true,
      facility_name: true,
      bol_number: true,
      status: true,
      arrived_at: true,
      docked_at: true,
      completed_at: true,
      departed_at: true,
      arrival_location: true,
      facility_address: true,
      attachments: {
        select: {
          id: true,
          type: true,
          file_name: true,
          file_url: true,
          mime_type: true,
          size_bytes: true,
          created_at: true,
        },
      },
    } satisfies Prisma.StopLogSelect;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: user_id },
          select: { id: true, rate_per_hour: true, free_wait_time: true },
        });

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        const now = new Date();
        const hasDepartureTime =
          step === LogStopStep.DEPARTURE_TIME ||
          Boolean(activeLog?.departed_at);

        let determineStatus: PrismaStopLogStatus = PrismaStopLogStatus.ACTIVE;
        if (hasDepartureTime) {
          determineStatus = PrismaStopLogStatus.COMPLETED;
        }

        const stoplog =
          step === LogStopStep.ARRIVAL_TIME
            ? await (async () => {
                const arrivalLocationId =
                  dto.location &&
                  Boolean(
                    dto.location.address ||
                      dto.location.city ||
                      dto.location.state ||
                      dto.location.country ||
                      dto.location.zip,
                  )
                    ? await this.createLocation(tx, dto.location)
                    : undefined;
                const facilityAddressId =
                  dto.location &&
                  Boolean(
                    dto.location.address ||
                      dto.location.city ||
                      dto.location.state ||
                      dto.location.country ||
                      dto.location.zip,
                  )
                    ? await this.createLocation(tx, dto.location)
                    : undefined;
                const shipperFacility = await this.resolveShipperFacility(
                  tx,
                  dto,
                  facilityAddressId,
                );

                return tx.stopLog.create({
                  data: {
                    user_id,
                    shipper_facility_id: shipperFacility.id,
                    shipper_name: shipperFacility.name,
                    facility_name:
                      dto.facility_name?.trim() ||
                      shipperFacility.name ||
                      'Unknown Facility',
                    bol_number: bol_number?.trim() || undefined,
                    status: determineStatus,
                    arrived_at: now,
                    arrival_location_id: arrivalLocationId,
                    facility_address_id: facilityAddressId,
                    attachments: uploadedAttachments.length
                      ? {
                          create: uploadedAttachments,
                        }
                      : undefined,
                  },
                  select: stopLogSelect,
                });
              })()
            : await (async () => {
                const facilityAddressId =
                  dto.location &&
                  Boolean(
                    dto.location.address ||
                      dto.location.city ||
                      dto.location.state ||
                      dto.location.country ||
                      dto.location.zip,
                  )
                    ? await this.createLocation(tx, dto.location)
                    : undefined;

                const updateData: Prisma.StopLogUpdateInput = {
                  ...(!activeLog.departed_at && { [config.field]: now }),
                  ...(bol_number !== undefined && {
                    bol_number: bol_number.trim() || null,
                  }),
                  status: determineStatus,
                  attachments: uploadedAttachments.length
                    ? {
                        create: uploadedAttachments,
                      }
                    : undefined,
                  facility_address: facilityAddressId
                    ? {
                        connect: { id: facilityAddressId },
                      }
                    : undefined,
                };

                return tx.stopLog.update({
                  where: { id: activeLog.id },
                  data: updateData,
                  select: stopLogSelect,
                });
              })();

        // Calculate and upsert Claim only if completed and has attachments
        const hasAttachments = stoplog.attachments.length > 0;
        if (
          stoplog.status === PrismaStopLogStatus.COMPLETED &&
          hasAttachments &&
          stoplog.departed_at &&
          stoplog.user_id &&
          stoplog.shipper_facility_id
        ) {
          const arrived = new Date(stoplog.arrived_at).getTime();
          const departed = new Date(stoplog.departed_at).getTime();
          const totalTime = Math.max(
            0,
            (departed - arrived) / (1000 * 60 * 60),
          );
          const payableTime = Math.max(
            0,
            totalTime - (user.free_wait_time || 0),
          );
          const totalAmount = payableTime * (user.rate_per_hour || 0);

          await tx.claim.upsert({
            where: { stop_log_id: stoplog.id },
            create: {
              status: ClaimStatus.DRAFT,
              claim_amount: Math.round(totalAmount),
              user_id: stoplog.user_id,
              shipper_facility_id: stoplog.shipper_facility_id,
              stop_log_id: stoplog.id,
            },
            update: {
              claim_amount: Math.round(totalAmount),
            },
          });
        }

        return ResponseHelper.success({
          message: 'Stop log step recorded successfully',
          data: {
            ...stoplog,
            shipper_id: stoplog.shipper_facility_id,
            current_step: this.getCurrentStep(stoplog),
          },
        });
      });
    } catch (error) {
      await this.deleteUploadedAttachments(uploadedAttachments);
      throw error;
    }
  }

  async getAllStopLogs(query: QueryStopLogDto, user_id: string) {
    const {
      cursor,
      limit = 10,
      search,
      status = QueryStopLogStatus.ALL,
    } = query;

    const where: any = {
      user_id,
    };

    if (status === QueryStopLogStatus.PROGRESS) {
      where.status = {
        not: PrismaStopLogStatus.COMPLETED,
      };
    } else if (status === QueryStopLogStatus.COMPLETED) {
      where.status = PrismaStopLogStatus.COMPLETED;
    }

    if (search) {
      where.OR = [
        {
          arrival_location: {
            OR: [
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          facility_address: {
            OR: [
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const data = await this.prisma.stopLog.findMany({
      where,
      take: Number(limit) + 1,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        created_at: true,
        status: true,
        facility_name: true,
        shipper_facility_id: true,
        arrived_at: true,
        departed_at: true,
        user: {
          select: {
            rate_per_hour: true,
            free_wait_time: true,
          },
        },
        arrival_location: true,
        facility_address: true,
      },
    });

    const nextCursor =
      data.length > Number(limit) ? data[Number(limit)].id : null;
    if (nextCursor) {
      data.pop();
    }

    return ResponseHelper.success({
      message: 'Stop logs fetched successfully',
      data: data.map((item) => {
        const arrived = item.arrived_at?.getTime() ?? 0;
        const departed = item.departed_at?.getTime() ?? 0;
        const totalHours =
          departed > arrived ? (departed - arrived) / (1000 * 60 * 60) : 0;
        const billableHours = Math.max(
          0,
          totalHours - (item.user?.free_wait_time || 0),
        );
        const amount = billableHours * (item.user?.rate_per_hour || 0);

        return {
          id: item.id,
          facility_name: item.facility_name,
          shipper_facility_id: item.shipper_facility_id,
          date: item.created_at,
          amount: amount.toFixed(2),
          status:
            item.status === PrismaStopLogStatus.COMPLETED //TODO
              ? QueryStopLogStatus.COMPLETED
              : QueryStopLogStatus.PROGRESS,
        };
      }),
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

  async getOneStopLog(id: string, user_id: string) {
    const stoplog = await this.prisma.stopLog.findUnique({
      where: { id, user_id },
      include: {
        user: {
          select: {
            rate_per_hour: true,
            free_wait_time: true,
          },
        },
        arrival_location: true,
        facility_address: true,
        attachments: true,
        claim: {
          include: {
            claim_events: {
              orderBy: {
                created_at: 'desc',
              },
            },
          },
        },
      },
    });
    if (!stoplog) throw new UnauthorizedException('Stop log not found');

    const currentStep = this.getCurrentStep(stoplog);

    if (currentStep !== LogStopStep.DEPARTURE_TIME) {
      return ResponseHelper.success({
        message: 'Stop log fetched successfully',
        data: {
          id: stoplog.id,
          arrived_at: stoplog.arrived_at,
          docked_at: stoplog.docked_at,
          completed_at: stoplog.completed_at,
          departed_at: stoplog.departed_at,
          current_step: currentStep,
        },
      });
    }

    const arrived = stoplog.arrived_at
      ? new Date(stoplog.arrived_at).getTime()
      : 0;
    const departed = stoplog.departed_at
      ? new Date(stoplog.departed_at).getTime()
      : 0;

    const totalTime =
      departed > arrived
        ? ((departed - arrived) / (1000 * 60 * 60)).toFixed(2)
        : null;

    const totalTimeNum = totalTime ? parseFloat(totalTime) : 0;
    const payableTime = Math.max(
      0,
      totalTimeNum - (stoplog.user?.free_wait_time || 0),
    );

    const payableTimeFormatted = payableTime.toFixed(2);
    const totalAmount = payableTime * (stoplog.user?.rate_per_hour || 0);

    const address = this.getStopLogAddress(stoplog);

    const gps_coordinates = stoplog.arrival_location
      ? `${stoplog.arrival_location.lat}, ${stoplog.arrival_location.lng}`
      : stoplog.facility_address
        ? `${stoplog.facility_address.lat}, ${stoplog.facility_address.lng}`
        : null;

    return ResponseHelper.success({
      message: 'Stop log fetched successfully',
      data: {
        id: stoplog.id,
        status: stoplog.status,
        facility_name: stoplog.facility_name,
        arrived_at: stoplog.arrived_at,
        departed_at: stoplog.departed_at,
        bol_number: stoplog.bol_number,
        gps_coordinates,
        rate_per_hour: stoplog.user?.rate_per_hour,
        free_wait_time: stoplog.user?.free_wait_time,
        billable_time: payableTimeFormatted,
        billable_time_text: this.formatHoursMinutes(payableTime),
        arrival_departure_time: totalTime,
        address,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
        attachments: stoplog.attachments.map((att) => ({
          id: att.id,
          file_name: att.file_name,
          file_url: att.file_url,
          type: att.type,
        })),
        claim: stoplog.claim
          ? {
              id: stoplog.claim.id,
              status: stoplog.claim.status,
              amount: stoplog.claim.claim_amount,
              paid_amount: stoplog.claim.paid_amount,
              sent_at: stoplog.claim.sent_at,
              recipient_email: stoplog.claim.recipient_email,
              recourse_level: stoplog.claim.recourse_level,
              followup_count: stoplog.claim.followup_count,
              followup_due_at: stoplog.claim.followup_due_at,
              claim_events: stoplog.claim.claim_events.map((event) => ({
                id: event.id,
                created_at: event.created_at,
                type: event.type,
                recourse_level: event.recourse_level,
                followup_level: event.followup_level,
                description: event.description,
              })),
            }
          : null,
      },
    });
  }

  async getHomeData(user_id: string, query: QueryHomeDataDto) {
    const { period = Period.TODAY } = query;

    const now = new Date();
    const periodStart = this.getHomeDataPeriodStart(period, now);
    const where: Prisma.StopLogWhereInput = {
      user_id,
      departed_at: { not: null }, // Only calculate for completed stops
      created_at: { gte: periodStart },
    };

    const weekStart = this.getWeekStart(now);
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const [user, stopLogs, weeklyStopLogs, lastWeekClaims] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user_id },
        select: {
          rate_per_hour: true,
          free_wait_time: true,
        },
      }),
      this.prisma.stopLog.findMany({
        where,
        select: {
          arrived_at: true,
          departed_at: true,
          claim: {
            select: {
              status: true,
              claim_amount: true,
              paid_amount: true,
            },
          },
        },
      }),
      this.prisma.stopLog.findMany({
        where: {
          user_id,
          departed_at: { not: null },
          created_at: {
            gte: weekStart,
            lt: nextWeekStart,
          },
        },
        select: {
          created_at: true,
        },
      }),
      this.prisma.claim.findMany({
        where: {
          user_id,
          created_at: {
            gte: lastWeekStart,
            lt: weekStart,
          },
        },
        select: {
          claim_amount: true,
          paid_amount: true,
          status: true,
        },
      }),
    ]);

    let total_detention = 0;
    let total_hours = 0;
    let claimedStops = 0;
    let totalClaimedAmount = 0;
    let totalCollectedAmount = 0;

    stopLogs.forEach((stopLog) => {
      const arrived = stopLog.arrived_at.getTime();
      const departed = stopLog.departed_at?.getTime() || 0;

      const hoursDiff = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
      const payableTime = Math.max(0, hoursDiff - (user?.free_wait_time || 0));
      const amount = payableTime * (user?.rate_per_hour || 0);

      total_detention += amount;
      total_hours += payableTime;

      if (stopLog.claim && stopLog.claim.status !== ClaimStatus.DRAFT) {
        claimedStops += 1;
        totalClaimedAmount += stopLog.claim.claim_amount;
        totalCollectedAmount += stopLog.claim.paid_amount || 0;
      }
    });

    const weeklyActivity = [
      { day: 'Mon', total_stops: 0 },
      { day: 'Tue', total_stops: 0 },
      { day: 'Wed', total_stops: 0 },
      { day: 'Thu', total_stops: 0 },
      { day: 'Fri', total_stops: 0 },
      { day: 'Sat', total_stops: 0 },
      { day: 'Sun', total_stops: 0 },
    ];

    weeklyStopLogs.forEach((stopLog) => {
      const day = stopLog.created_at.getDay();
      const index = day === 0 ? 6 : day - 1;
      weeklyActivity[index].total_stops += 1;
    });

    const collectionRate =
      totalClaimedAmount > 0
        ? (totalCollectedAmount / totalClaimedAmount) * 100
        : 0;

    const lastWeekTotals = lastWeekClaims.reduce(
      (totals, claim) => {
        if (claim.status === ClaimStatus.DRAFT) {
          return totals;
        }

        totals.claimed += claim.claim_amount;
        totals.collected += claim.paid_amount || 0;
        return totals;
      },
      { claimed: 0, collected: 0 },
    );
    const lastWeekCollectionRate =
      lastWeekTotals.claimed > 0
        ? (lastWeekTotals.collected / lastWeekTotals.claimed) * 100
        : 0;
    const collectionRateChange = collectionRate - lastWeekCollectionRate;
    const avgHoursPerStop =
      stopLogs.length > 0 ? total_hours / stopLogs.length : 0;

    return ResponseHelper.success({
      message: 'Home data fetched successfully',
      data: {
        total_detention: total_detention.toFixed(2),
        total_lost: total_detention.toFixed(2),
        total_stops: stopLogs.length,
        claimed_stops: claimedStops,
        total_hours: total_hours.toFixed(2),
        avg_hours_per_stop: avgHoursPerStop.toFixed(2),
        avg_hours_per_stop_text: this.formatHoursMinutes(avgHoursPerStop),
        collection_rate: collectionRate.toFixed(2),
        collection_rate_change: collectionRateChange.toFixed(2),
        weekly_activity: {
          total_stops: weeklyStopLogs.length,
          data: weeklyActivity,
        },
      },
    });
  }

  async getReport(user_id: string, query: QueryReportDto) {
    const { tab = ReportTab.WEEKLY_SUMMARY, period = ReportPeriod.MONTHLY } =
      query;
    const now = new Date();

    if (tab === ReportTab.WEEKLY_SUMMARY) {
      const weekStart = this.getWeekStart(now);
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);

      const [user, weeklyStopLogs] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: user_id },
          select: {
            rate_per_hour: true,
            free_wait_time: true,
          },
        }),
        this.prisma.stopLog.findMany({
          where: {
            user_id,
            departed_at: { not: null },
            created_at: {
              gte: weekStart,
              lt: nextWeekStart,
            },
          },
          select: {
            facility_name: true,
            arrived_at: true,
            departed_at: true,
            claim: {
              select: {
                status: true,
                paid_amount: true,
              },
            },
          },
        }),
      ]);

      let totalWaitingHours = 0;
      let weeklyDetentionAmount = 0;
      let weeklyCollectedAmount = 0;
      let topWorstStop = null;
      let maxWaitingHours = -1;

      weeklyStopLogs.forEach((stopLog) => {
        const arrived = stopLog.arrived_at.getTime();
        const departed = stopLog.departed_at?.getTime() || 0;
        const hoursDiff = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
        const payableTime = Math.max(
          0,
          hoursDiff - (user?.free_wait_time || 0),
        );
        const amount = payableTime * (user?.rate_per_hour || 0);

        totalWaitingHours += payableTime;
        weeklyDetentionAmount += amount;

        if (stopLog.claim && stopLog.claim.status !== ClaimStatus.DRAFT) {
          weeklyCollectedAmount += stopLog.claim.paid_amount || 0;
        }

        if (payableTime > maxWaitingHours) {
          maxWaitingHours = payableTime;
          topWorstStop = {
            facility_name: stopLog.facility_name || 'Unknown Facility',
            waiting_hours: payableTime.toFixed(2),
            waiting_time_text: this.formatHoursMinutes(payableTime),
          };
        }
      });

      const weeklyRevenueLost = Math.max(
        0,
        weeklyDetentionAmount - weeklyCollectedAmount,
      );

      return ResponseHelper.success({
        message: 'Weekly summary fetched successfully',
        data: {
          tab,
          total_waiting_hours: totalWaitingHours.toFixed(2),
          total_waiting_text: this.formatHoursMinutes(totalWaitingHours),
          detention_captured: weeklyCollectedAmount.toFixed(2),
          revenue_lost: weeklyRevenueLost.toFixed(2),
          top_worst_stop: topWorstStop || {
            facility_name: null,
            waiting_hours: '0.00',
            waiting_time_text: '0h 0m',
          },
        },
      });
    }

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
    const chartStart =
      period === ReportPeriod.YEARLY
        ? new Date(now.getFullYear() - 6, 0, 1)
        : yearStart;
    const reportStart = period === ReportPeriod.YEARLY ? chartStart : yearStart;

    const taxClaims = await this.prisma.claim.findMany({
      where: {
        user_id,
        status: { not: ClaimStatus.DRAFT },
        OR: [
          {
            created_at: {
              gte: reportStart,
              lt: nextYearStart,
            },
          },
          {
            paid_at: {
              gte: reportStart,
              lt: nextYearStart,
            },
          },
        ],
      },
      select: {
        claim_amount: true,
        paid_amount: true,
        created_at: true,
        sent_at: true,
        paid_at: true,
      },
    });

    let totalClaimed = 0;
    let totalCollected = 0;
    let paidClaimDays = 0;
    let paidClaimCount = 0;

    taxClaims.forEach((claim) => {
      if (claim.created_at >= reportStart && claim.created_at < nextYearStart) {
        totalClaimed += claim.claim_amount;
      }

      if (
        claim.paid_at &&
        claim.paid_at >= reportStart &&
        claim.paid_at < nextYearStart
      ) {
        totalCollected += claim.paid_amount || 0;
      }

      if (
        claim.paid_at &&
        claim.paid_at >= reportStart &&
        claim.paid_at < nextYearStart
      ) {
        const startedAt = claim.sent_at || claim.created_at;
        paidClaimDays += Math.max(
          0,
          (claim.paid_at.getTime() - startedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        paidClaimCount += 1;
      }
    });

    const revenueLost = Math.max(0, totalClaimed - totalCollected);
    const collectionRate =
      totalClaimed > 0 ? (totalCollected / totalClaimed) * 100 : 0;
    const avgDaysToPay =
      paidClaimCount > 0 ? paidClaimDays / paidClaimCount : 0;

    const revenueRealization =
      period === ReportPeriod.YEARLY
        ? Array.from({ length: 7 }, (_, index) => {
            const year = chartStart.getFullYear() + index;

            return {
              label: String(year),
              claimed: 0,
              collected: 0,
            };
          })
        : [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
          ].map((month) => ({
            label: month,
            claimed: 0,
            collected: 0,
          }));

    taxClaims.forEach((claim) => {
      const claimedIndex =
        period === ReportPeriod.YEARLY
          ? claim.created_at.getFullYear() - chartStart.getFullYear()
          : claim.created_at.getMonth();

      if (
        claim.created_at >= reportStart &&
        claim.created_at < nextYearStart &&
        revenueRealization[claimedIndex]
      ) {
        revenueRealization[claimedIndex].claimed += claim.claim_amount;
      }

      if (
        !claim.paid_at ||
        claim.paid_at < reportStart ||
        claim.paid_at >= nextYearStart
      ) {
        return;
      }

      const collectedIndex =
        period === ReportPeriod.YEARLY
          ? claim.paid_at.getFullYear() - chartStart.getFullYear()
          : claim.paid_at.getMonth();

      if (!revenueRealization[collectedIndex]) {
        return;
      }

      revenueRealization[collectedIndex].collected += claim.paid_amount || 0;
    });

    return ResponseHelper.success({
      message: 'Tax report fetched successfully',
      data: {
        tab,
        period,
        date_range: {
          start: reportStart,
          end: new Date(nextYearStart.getTime() - 1),
        },
        total_claimed: totalClaimed.toFixed(2),
        total_collected: totalCollected.toFixed(2),
        collection_rate: collectionRate.toFixed(2),
        avg_days_to_pay: avgDaysToPay.toFixed(2),
        avg_days_to_pay_text: `${Math.round(avgDaysToPay)} days`,
        revenue_lost: revenueLost.toFixed(2),
        revenue_realization: revenueRealization.map((item) => ({
          label: item.label,
          claimed: item.claimed.toFixed(2),
          collected: item.collected.toFixed(2),
        })),
      },
    });
  }
}
