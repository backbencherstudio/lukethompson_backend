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
  QueryStopLogDto,
  StopLogStatus as QueryStopLogStatus,
} from './dto/query-stoplog.dto';
import {
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

    const stopLogSelect = {
      id: true,
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

    const uploadedAttachments = await this.uploadStopLogAttachments(
      dto.attachments,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: user_id },
          select: { id: true },
        });

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        const activeLog = await tx.stopLog.findFirst({
          where: { user_id, departed_at: null },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            arrived_at: true,
            docked_at: true,
            completed_at: true,
            departed_at: true,
            bol_number: true,
            _count: {
              select: {
                attachments: true,
              },
            },
          },
        });

        const now = new Date();

        const stoplog =
          step === LogStopStep.ARRIVAL_TIME
            ? await (async () => {
                if (activeLog) {
                  throw new UnauthorizedException(
                    'An active stop log is already in progress',
                  );
                }

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
                    status:
                      uploadedAttachments.length > 0
                        ? PrismaStopLogStatus.COMPLETED
                        : PrismaStopLogStatus.ACTIVE,
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
                if (!activeLog) {
                  throw new UnauthorizedException(
                    'No active stop log found. Start with Arrival.',
                  );
                }

                if (this.getCurrentStep(activeLog) !== config.prev) {
                  throw new UnauthorizedException(
                    `Invalid sequence. Next step should be: ${config.prev}`,
                  );
                }

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

                const totalAttachments =
                  activeLog._count.attachments + uploadedAttachments.length;

                const updateData: Prisma.StopLogUpdateInput = {
                  [config.field]: now,
                  bol_number: bol_number?.trim() || undefined,
                  status:
                    totalAttachments > 0
                      ? PrismaStopLogStatus.COMPLETED
                      : PrismaStopLogStatus.ACTIVE,
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
      page = 1,
      limit = 10,
      search,
      status = QueryStopLogStatus.ALL,
    } = query;
    const skip = (page - 1) * limit;

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

    const [total, data] = await Promise.all([
      this.prisma.stopLog.count({ where }),
      this.prisma.stopLog.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { created_at: 'desc' },
        include: {
          user: {
            select: {
              rate_per_hour: true,
              free_wait_time: true,
            },
          },
          arrival_location: true,
          facility_address: true,
        },
      }),
    ]);

    const getHHMM = (date: Date) =>
      new Date(date).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });

    const formattedData = data.map((item: any) => {
      const arrived = item.arrived_at ? new Date(item.arrived_at).getTime() : 0;
      const departed = item.departed_at
        ? new Date(item.departed_at).getTime()
        : 0;

      const totalTime =
        departed > arrived
          ? ((departed - arrived) / (1000 * 60 * 60)).toFixed(2)
          : null;

      const totalTimeNum = totalTime ? parseFloat(totalTime) : 0;
      const payableTime = Math.max(
        0,
        totalTimeNum - (item.user?.free_wait_time || 0),
      );

      const payableTimeFormatted = payableTime.toFixed(2);
      const totalAmount = payableTime * (item.user?.rate_per_hour || 0);

      const address = this.getStopLogAddress(item);

      const status =
        item.status === PrismaStopLogStatus.COMPLETED
          ? QueryStopLogStatus.COMPLETED
          : QueryStopLogStatus.PROGRESS;

      return {
        id: item.id,
        arrived_at: item.arrived_at ? getHHMM(item.arrived_at) : null,
        departed_at: item.departed_at ? getHHMM(item.departed_at) : null,
        total_time: totalTime,
        billable_time: payableTimeFormatted,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
        address,
        status,
      };
    });

    return ResponseHelper.success({
      message: 'Stop logs fetched successfully',
      data: formattedData,
      meta_data: {
        total,
        page: Number(page),
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

    return ResponseHelper.success({
      message: 'Stop log fetched successfully',
      data: {
        id: stoplog.id,
        rate_per_hour: stoplog.user?.rate_per_hour,
        free_wait_time: stoplog.user?.free_wait_time,
        billable_time: payableTimeFormatted,
        arrival_departure_time: totalTime,
        address,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
      },
    });
  }

  async getHomeData(user_id: string, query: QueryHomeDataDto) {
    const { period = Period.TODAY } = query;

    const where: Prisma.StopLogWhereInput = {
      user_id,
      departed_at: { not: null }, // Only calculate for completed stops
    };

    const now = new Date();
    switch (period) {
      case Period.TODAY:
        where.created_at = {
          gte: new Date(now.setHours(0, 0, 0, 0)),
        };
        break;
      case Period.WEEK:
        where.created_at = {
          gte: new Date(now.setDate(now.getDate() - 7)),
        };
        break;
      case Period.MONTH:
        where.created_at = {
          gte: new Date(now.setMonth(now.getMonth() - 1)),
        };
        break;
      case Period.YEAR:
        where.created_at = {
          gte: new Date(now.setFullYear(now.getFullYear() - 1)),
        };
        break;
    }

    const stopLogs = await this.prisma.stopLog.findMany({
      where,
      include: {
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

    let total_detention = 0;
    let total_hours = 0;
    let worstStopLogData = null;
    let maxAmount = -1;

    stopLogs.forEach((stopLog) => {
      const arrived = stopLog.arrived_at.getTime();
      const departed = stopLog.departed_at.getTime();

      const hoursDiff = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
      const payableTime = Math.max(
        0,
        hoursDiff - (stopLog.user?.free_wait_time || 0),
      );
      const amount = payableTime * (stopLog.user?.rate_per_hour || 0);

      total_detention += amount;
      total_hours += payableTime;

      if (amount > maxAmount) {
        maxAmount = amount;
        worstStopLogData = {
          address: this.getStopLogAddress(stopLog) || 'Unknown Address',
          total_lost: amount.toFixed(2),
        };
      }
    });

    return ResponseHelper.success({
      message: 'Home data fetched successfully',
      data: {
        total_detention: total_detention.toFixed(2),
        total_lost: total_detention.toFixed(2),
        total_hours: total_hours.toFixed(2),
        rate_per_hour: stopLogs[0]?.user?.rate_per_hour || 0,
        worst_stoplog: worstStopLogData || {
          address: null,
          total_lost: '0.00',
        },
      },
    });
  }

  async getReport(user_id: string) {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stopLogs = await this.prisma.stopLog.findMany({
      where: {
        user_id,
        departed_at: { not: null },
        created_at: { gte: lastWeek },
      },
      include: {
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

    let total_detention = 0;
    let total_timeloast = 0;
    let worstStopLogData = null;
    let maxAmount = -1;

    stopLogs.forEach((stopLog) => {
      const arrived = stopLog.arrived_at.getTime();
      const departed = stopLog.departed_at.getTime();

      const hoursDiff = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
      const payableTime = Math.max(
        0,
        hoursDiff - (stopLog.user?.free_wait_time || 0),
      );
      const amount = payableTime * (stopLog.user?.rate_per_hour || 0);

      total_detention += amount;
      total_timeloast += payableTime;

      if (amount > maxAmount) {
        maxAmount = amount;
        worstStopLogData = {
          address: this.getStopLogAddress(stopLog) || 'Unknown Address',
          total_lost: amount.toFixed(2),
        };
      }
    });

    return ResponseHelper.success({
      message: 'Weekly report fetched successfully',
      data: {
        total_stops: stopLogs.length,
        total_timeloast: total_timeloast.toFixed(2),
        total_detention: total_detention.toFixed(2),
        total_lost: total_detention.toFixed(2),
        worst_stoplog: worstStopLogData || {
          address: null,
          total_lost: '0.00',
        },
        rate_per_hour: stopLogs[0]?.user?.rate_per_hour || 0,
      },
    });
  }
}
