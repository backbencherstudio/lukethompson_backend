import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
  AttachmentType,
  ClaimStatus,
  Prisma,
  StopLogStatus as PrismaStopLogStatus,
} from '../../../../prisma/generated/client';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';
import appConfig from 'src/config/app.config';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';

type StepState = Pick<
  Prisma.StopLogUncheckedCreateInput,
  'arrived_at' | 'docked_at' | 'completed_at' | 'departed_at' | 'status'
>;

const RECOURSE_LEVELS = {
  0: { name: 'Draft / Initial Claim', days: 'Day 0' },
  1: { name: 'Soft follow-ups', days: 'Day 2, 7, 14' },
  2: { name: 'Broker Formal Escalation', days: 'Day 15+' },
  3: { name: 'Certified Demand Letter', days: 'Day 21+' },
  4: { name: 'Broker Bond Claim (BMC-84/85)', days: 'Day 21+' },
  5: { name: 'Credit Bureau Report', days: 'Day 30+' },
  6: { name: 'FMCSA Complaint', days: 'Day 30+' },
  7: { name: 'Load Board Negative Report', days: 'Day 30+' },
  8: { name: 'Small Claims Court Filing', days: 'Day 45+' },
  9: { name: 'Collections / Attorney Referral', days: 'Day 60+' },
};

@Injectable()
export class StopLogService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('pdf-queue') private readonly pdfQueue: Queue,
  ) {}

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
    [LogStopStep.UPLOAD_DOCUMENTS]: {
      prev: LogStopStep.DEPARTURE_TIME,
      field: null,
    },
  };

  private getCurrentStep(stopLog: StepState): LogStopStep {
    if (stopLog.status === PrismaStopLogStatus.COMPLETED)
      return LogStopStep.UPLOAD_DOCUMENTS;
    if (stopLog.departed_at) return LogStopStep.DEPARTURE_TIME;
    if (stopLog.completed_at) return LogStopStep.COMPLETED_TIME;
    if (stopLog.docked_at) return LogStopStep.DOCK_IN_TIME;
    return LogStopStep.ARRIVAL_TIME;
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

  async putStopLog(dto: PutStopLogDto, user_id: string) {
    const { step, bol_number, broker_id } = dto;
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
            status: true,
            broker_id: true,
            broker_name: true,
            broker_email: true,
            broker_mc_number: true,
            _count: {
              select: {
                attachments: true,
              },
            },
          },
        })
      : await this.prisma.stopLog.findFirst({
          where: { user_id, status: { not: PrismaStopLogStatus.COMPLETED } },
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            arrived_at: true,
            docked_at: true,
            completed_at: true,
            departed_at: true,
            bol_number: true,
            user_id: true,
            status: true,
            broker_id: true,
            broker_name: true,
            broker_email: true,
            broker_mc_number: true,
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

    // 3. Step Order ranking
    const STEP_ORDER = {
      [LogStopStep.ARRIVAL_TIME]: 1,
      [LogStopStep.DOCK_IN_TIME]: 2,
      [LogStopStep.COMPLETED_TIME]: 3,
      [LogStopStep.DEPARTURE_TIME]: 4,
      [LogStopStep.UPLOAD_DOCUMENTS]: 5,
    };

    // 4. Validate step sequence
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

      const currentStep = this.getCurrentStep(activeLog);

      // Rule: Step cannot go backward (upper level to lower level)
      if (STEP_ORDER[step] < STEP_ORDER[currentStep]) {
        throw new BadRequestException(
          `Cannot go back to an earlier step (${currentStep}) from ${step}`,
        );
      }

      // Rule: Strict sequence check for forward progress
      if (STEP_ORDER[step] > STEP_ORDER[currentStep]) {
        if (STEP_ORDER[step] !== STEP_ORDER[currentStep] + 1) {
          const expectedStep = Object.keys(STEP_ORDER).find(
            (k) => STEP_ORDER[k] === STEP_ORDER[currentStep] + 1,
          );
          throw new BadRequestException(
            `Invalid sequence. Next step should be: ${expectedStep}`,
          );
        }
      }

      // Rule: Prevent repeating completed steps (except upload_documents)
      if (
        STEP_ORDER[step] === STEP_ORDER[currentStep] &&
        step !== LogStopStep.UPLOAD_DOCUMENTS
      ) {
        throw new BadRequestException(
          `Step ${step} has already been completed and cannot be recorded again`,
        );
      }
    }

    // 5. Enforce that bol_number and attachments can ONLY be provided during or after the upload_documents step
    const hasNewAttachments = dto.attachments && dto.attachments.length > 0;
    const currentStepOfLog = activeLog ? this.getCurrentStep(activeLog) : null;
    const isUploadOrUploaded =
      step === LogStopStep.UPLOAD_DOCUMENTS ||
      currentStepOfLog === LogStopStep.UPLOAD_DOCUMENTS;

    if (!isUploadOrUploaded) {
      if (hasNewAttachments || bol_number !== undefined) {
        throw new BadRequestException(
          'BOL number and attachments can only be provided during the upload_documents step',
        );
      }
    }

    // 6. Inline upload attachments
    const uploadedAttachments: Prisma.AttachmentCreateInput[] = [];
    if (dto.attachments) {
      for (const attachment of dto.attachments) {
        try {
          const fileName = NajimStorage.generateFilename(
            attachment.originalname,
          );
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
    }

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
      broker_id: true,
      broker_name: true,
      broker_email: true,
      broker_mc_number: true,
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

        // Resolve broker if provided
        let brokerInfo: {
          id: string;
          name: string;
          email: string;
          mcNumber?: string;
        } | null = null;
        if (broker_id) {
          const broker = await tx.broker.findUnique({
            where: { id: broker_id },
            select: {
              id: true,
              name: true,
              email: true,
              brokerId: true,
            },
          });

          if (!broker) {
            throw new BadRequestException('Invalid broker id');
          }

          brokerInfo = {
            id: broker.id,
            name: broker.name,
            email: broker.email,
            mcNumber: broker.brokerId || undefined,
          };
        }

        const now = new Date();

        const totalAttachmentsCount =
          (activeLog?._count?.attachments || 0) + uploadedAttachments.length;

        let determineStatus: PrismaStopLogStatus = PrismaStopLogStatus.ACTIVE;
        if (
          step === LogStopStep.UPLOAD_DOCUMENTS ||
          activeLog?.status === PrismaStopLogStatus.COMPLETED
        ) {
          if (totalAttachmentsCount === 0) {
            throw new BadRequestException(
              'At least one attachment is mandatory to complete the stop log',
            );
          }
          determineStatus = PrismaStopLogStatus.COMPLETED;
        }

        const stoplog =
          step === LogStopStep.ARRIVAL_TIME
            ? await (async () => {
                // Inline location creation check
                const hasLocation =
                  dto.location &&
                  Boolean(
                    dto.location.address ||
                      dto.location.city ||
                      dto.location.state ||
                      dto.location.country ||
                      dto.location.zip,
                  );

                const arrivalLocationId = hasLocation
                  ? (
                      await tx.location.create({
                        data: dto.location!,
                        select: { id: true },
                      })
                    ).id
                  : undefined;
                const facilityAddressId = hasLocation
                  ? (
                      await tx.location.create({
                        data: dto.location!,
                        select: { id: true },
                      })
                    ).id
                  : undefined;

                // Inline resolveShipperFacility
                let shipperFacilityId = dto.shipper_id;
                let shipperFacilityName = dto.facility_name?.trim();

                if (dto.shipper_id) {
                  const sf = await tx.shipperFacility.findUnique({
                    where: { id: dto.shipper_id },
                    select: { id: true, name: true },
                  });
                  if (!sf) {
                    throw new BadRequestException('Invalid shipper id');
                  }
                  shipperFacilityName = sf.name;
                } else {
                  if (!dto.facility_name?.trim()) {
                    throw new BadRequestException(
                      'Facility name is required when shipper id is not provided',
                    );
                  }
                  if (!dto.location || !hasLocation) {
                    throw new BadRequestException(
                      'Arrival location is required when shipper id is not provided',
                    );
                  }

                  const facilityName = dto.facility_name.trim();

                  const normalizedName = facilityName
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]/g, '_');

                  const existingSF = await tx.shipperFacility.findUnique({
                    where: { normalized_name: normalizedName },
                    select: { id: true, name: true },
                  });

                  if (existingSF) {
                    shipperFacilityId = existingSF.id;
                    shipperFacilityName = existingSF.name;
                  } else {
                    const newSF = await tx.shipperFacility.create({
                      data: {
                        name: facilityName,
                        normalized_name: normalizedName,
                        location_id: facilityAddressId || null,
                      },
                      select: { id: true, name: true },
                    });
                    shipperFacilityId = newSF.id;
                    shipperFacilityName = newSF.name;
                  }
                }

                return tx.stopLog.create({
                  data: {
                    user_id,
                    shipper_facility_id: shipperFacilityId,
                    shipper_name: shipperFacilityName,
                    facility_name: shipperFacilityName || 'Unknown Facility',
                    bol_number: bol_number?.trim() || undefined,
                    status: determineStatus,
                    arrived_at: now,
                    arrival_location_id: arrivalLocationId,
                    facility_address_id: facilityAddressId,
                    broker_id: brokerInfo?.id || null,
                    broker_name: brokerInfo?.name || null,
                    broker_email: brokerInfo?.email || null,
                    broker_mc_number: brokerInfo?.mcNumber || null,
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
                const hasLocation =
                  dto.location &&
                  Boolean(
                    dto.location.address ||
                      dto.location.city ||
                      dto.location.state ||
                      dto.location.country ||
                      dto.location.zip,
                  );

                const facilityAddressId = hasLocation
                  ? (
                      await tx.location.create({
                        data: dto.location!,
                        select: { id: true },
                      })
                    ).id
                  : undefined;

                const updateData: Prisma.StopLogUpdateInput = {
                  ...(config.field &&
                    activeLog &&
                    !activeLog[config.field as keyof typeof activeLog] && {
                      [config.field]: now,
                    }),
                  ...(bol_number !== undefined && {
                    bol_number: bol_number.trim() || null,
                  }),
                  status: determineStatus,
                  // Update broker fields if broker_id is provided
                  ...(broker_id &&
                    brokerInfo && {
                      broker_id: brokerInfo.id,
                      broker_name: brokerInfo.name,
                      broker_email: brokerInfo.email,
                      broker_mc_number: brokerInfo.mcNumber || null,
                    }),
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

          const claim = await tx.claim.upsert({
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

          // Trigger async PDF generation using BullMQ
          try {
            await this.pdfQueue.add('generateDetentionSummary', {
              stopLogId: stoplog.id,
              claimId: claim.id,
            });
          } catch (queueError) {
            console.error('Failed to enqueue PDF generation job:', queueError);
          }
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
      for (const attachment of uploadedAttachments) {
        try {
          await NajimStorage.delete(attachment.file_url);
        } catch (delError) {
          console.log(
            'Error during attachment deletion stoplog DTO:',
            delError,
          );
        }
      }
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

    const where: Prisma.StopLogWhereInput = {
      user_id,
    };

    if (status === QueryStopLogStatus.ACTIVE) {
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
      skip: cursor ? 1 : undefined,
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
        claim: {
          select: {
            status: true,
          },
        },
        arrival_location: true,
        facility_address: true,

        // Snapshot fields (fallback)
        broker_name: true,
        broker_email: true,

        // Related shipper facility with broker
        shipper_facility: {
          select: {
            broker: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },

        rating: {
          select: {
            id: true,
            rating: true,
          },
        },
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

        // Get broker from related shipper_facility or fallback to snapshot fields
        const broker = item.shipper_facility?.broker
          ? {
              id: item.shipper_facility.broker.id,
              name: item.shipper_facility.broker.name,
              email: item.shipper_facility.broker.email,
            }
          : item.broker_name || item.broker_email
            ? {
                id: null,
                name: item.broker_name,
                email: item.broker_email,
              }
            : null;

        return {
          id: item.id,
          facility_name: item.facility_name,
          shipper_facility_id: item.shipper_facility_id,
          date: item.created_at,
          amount: amount.toFixed(2),
          claim_status: item?.claim?.status ?? null,
          status: item?.status,
          rating: item?.rating,
          broker: broker,
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
        attachments: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
            mime_type: true,
            type: true,
            size_bytes: true,
          },
        },
        claim: true,
        shipper_facility: {
          include: {
            broker: true,
          },
        },
        broker: true,
      },
    });

    if (!stoplog) throw new UnauthorizedException('Stop log not found');

    const currentStep = this.getCurrentStep(stoplog);

    const attachments = stoplog.attachments
      .filter((attachment) => {
        return attachment.type !== AttachmentType.DETENTION_SUMMARY;
      })
      .map((attachment) => {
        return {
          ...attachment,
          file_url: NajimStorage.url(attachment.file_url, {
            signed: true,
            expires: 86400,
          }),
        };
      });

    let detention_summary_pdf = null;
    if (stoplog.status === PrismaStopLogStatus.COMPLETED) {
      const DetentionSummary = stoplog?.attachments?.find((attachment) => {
        return attachment.type === AttachmentType.DETENTION_SUMMARY;
      });

      if (DetentionSummary) {
        detention_summary_pdf = {
          ...DetentionSummary,
          file_url: NajimStorage.url(DetentionSummary.file_url, {
            signed: true,
            expires: 63072000,
          }),
        };
      }
    }

    // Get broker information - prefer direct broker relation first, fallback to shipper_facility broker
    let broker = null;

    // First try to get broker directly from stoplog
    if (stoplog.broker) {
      broker = {
        id: stoplog.broker.id,
        name: stoplog.broker.name,
        email: stoplog.broker.email,
        phone: stoplog.broker.phone,
        brokerId: stoplog.broker.brokerId,
        location_id: stoplog.broker.location_id,
        created_at: stoplog.broker.created_at,
        updated_at: stoplog.broker.updated_at,
      };
    }
    // Fallback to broker from shipper_facility
    else if (stoplog.shipper_facility?.broker) {
      broker = {
        id: stoplog.shipper_facility.broker.id,
        name: stoplog.shipper_facility.broker.name,
        email: stoplog.shipper_facility.broker.email,
        phone: stoplog.shipper_facility.broker.phone,
        brokerId: stoplog.shipper_facility.broker.brokerId,
        location_id: stoplog.shipper_facility.broker.location_id,
        created_at: stoplog.shipper_facility.broker.created_at,
        updated_at: stoplog.shipper_facility.broker.updated_at,
      };
    }

    if (stoplog.status !== PrismaStopLogStatus.COMPLETED) {
      return ResponseHelper.success({
        message: 'Stop log fetched successfully',
        data: {
          id: stoplog.id,
          user_id: stoplog.user_id,
          shipper_facility_id: stoplog.shipper_facility_id,
          shipper_id: stoplog.shipper_facility_id,
          shipper_name: stoplog.shipper_name,
          facility_name: stoplog.facility_name,
          bol_number: stoplog.bol_number,
          status: stoplog.status,
          arrived_at: stoplog.arrived_at,
          docked_at: stoplog.docked_at,
          completed_at: stoplog.completed_at,
          departed_at: stoplog.departed_at,
          arrival_location: stoplog.arrival_location,
          facility_address: stoplog.facility_address,
          detention_summary_pdf,
          attachments,
          current_step: currentStep,
          broker: broker,
          claim: stoplog?.claim
            ? {
                id: stoplog.claim.id,
                status: stoplog.claim.status,
                amount: stoplog.claim.claim_amount,
                level: stoplog.claim.recourse_level,
                level_name:
                  RECOURSE_LEVELS[stoplog.claim.recourse_level]?.name ||
                  'Unknown Stage',
                followup_count: stoplog.claim.followup_count,
                send_method: stoplog.claim.send_method,
                sent_at: stoplog.claim.sent_at,
              }
            : null,
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

    const address =
      stoplog.facility_address?.address ||
      stoplog.arrival_location?.address ||
      null;

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
        docked_at: stoplog.docked_at,
        completed_at: stoplog.completed_at,
        current_step: currentStep,
        bol_number: stoplog.bol_number,
        gps_coordinates,
        rate_per_hour: stoplog.user?.rate_per_hour + '',
        free_wait_time: stoplog.user?.free_wait_time + '',
        billable_time: payableTimeFormatted + 'h',
        billable_time_text: this.formatHoursMinutes(payableTime),
        arrival_departure_time: totalTime,
        address,
        detention: totalAmount.toFixed(2),
        lost: totalAmount.toFixed(2),
        detention_summary_pdf,
        attachments,
        broker: broker,
        claim: stoplog?.claim
          ? {
              id: stoplog.claim.id,
              status: stoplog.claim.status,
              amount: stoplog.claim.claim_amount,
              level: stoplog.claim.recourse_level,
              level_name:
                RECOURSE_LEVELS[stoplog.claim.recourse_level]?.name ||
                'Unknown Stage',
              followup_count: stoplog.claim.followup_count,
              send_method: stoplog.claim.send_method,
              sent_at: stoplog.claim.sent_at,
            }
          : null,
      },
    });
  }

  async updateStopLog(
    id: string,
    user_id: string,
    dto: UpdateStopLogDto,
    files: Express.Multer.File[] = [],
  ) {
    const { step, bol_number } = dto;

    const config = this.STEP_CONFIG[step];

    if (!config) {
      throw new BadRequestException('Invalid stop log step');
    }

    // ---------------------------------------------------------
    // 1. Find the stop log and verify ownership
    // ---------------------------------------------------------
    const stopLog = await this.prisma.stopLog.findFirst({
      where: {
        id,
        user_id,
      },
      select: {
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

        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });

    if (!stopLog) {
      throw new NotFoundException('Stop log not found');
    }

    // ---------------------------------------------------------
    // 2. Completed stop log cannot be modified
    // ---------------------------------------------------------
    if (stopLog.status === PrismaStopLogStatus.COMPLETED) {
      throw new BadRequestException('Completed stop log cannot be updated');
    }

    // ---------------------------------------------------------
    // 3. Step order
    // ---------------------------------------------------------
    const STEP_ORDER = {
      [LogStopStep.ARRIVAL_TIME]: 1,
      [LogStopStep.DOCK_IN_TIME]: 2,
      [LogStopStep.COMPLETED_TIME]: 3,
      [LogStopStep.DEPARTURE_TIME]: 4,
      [LogStopStep.UPLOAD_DOCUMENTS]: 5,
    };

    const currentStep = this.getCurrentStep(stopLog);

    // ---------------------------------------------------------
    // 4. Validate step sequence
    // ---------------------------------------------------------

    // Arrival cannot be updated again
    if (step === LogStopStep.ARRIVAL_TIME && stopLog.arrived_at) {
      throw new BadRequestException('Arrival time has already been recorded');
    }

    const requestedOrder = STEP_ORDER[step];
    const currentOrder = STEP_ORDER[currentStep];

    // Upload documents is allowed after departure/completion
    if (step !== LogStopStep.UPLOAD_DOCUMENTS) {
      // Cannot go backwards
      if (requestedOrder < currentOrder) {
        throw new BadRequestException(
          `Cannot go back to an earlier step (${currentStep}) from ${step}`,
        );
      }

      // Cannot skip a step
      if (requestedOrder > currentOrder + 1) {
        const expectedStep = Object.keys(STEP_ORDER).find(
          (key) => STEP_ORDER[key] === currentOrder + 1,
        );

        throw new BadRequestException(
          `Invalid sequence. Next step should be: ${expectedStep}`,
        );
      }

      // Prevent duplicate step
      if (requestedOrder === currentOrder) {
        throw new BadRequestException(
          `Step ${step} has already been completed and cannot be recorded again`,
        );
      }
    }

    // ---------------------------------------------------------
    // 5. Attachments
    // ---------------------------------------------------------
    const hasNewAttachments = files.length > 0;

    /*
     * Same rule as putStopLog():
     * BOL and attachments are only allowed during
     * upload_documents.
     */
    if (step !== LogStopStep.UPLOAD_DOCUMENTS) {
      if (hasNewAttachments || bol_number !== undefined) {
        throw new BadRequestException(
          'BOL number and attachments can only be provided during the upload_documents step',
        );
      }
    }

    // ---------------------------------------------------------
    // 6. Upload files before DB transaction
    // ---------------------------------------------------------
    const uploadedAttachments: Prisma.AttachmentCreateInput[] = [];

    try {
      for (const file of files) {
        const fileName = NajimStorage.generateFilename(file.originalname);

        const objectKey = `${appConfig().storageUrl.stopLog}/${fileName}`;

        await NajimStorage.put(objectKey, file.buffer);

        uploadedAttachments.push({
          type: AttachmentType.OTHER,
          file_name: fileName,
          file_url: objectKey,
          mime_type: file.mimetype,
          size_bytes: file.size,
        });
      }

      // ---------------------------------------------------------
      // 7. Transaction
      // ---------------------------------------------------------
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();

        // Get user for claim calculation
        const user = await tx.user.findUnique({
          where: {
            id: user_id,
          },
          select: {
            id: true,
            rate_per_hour: true,
            free_wait_time: true,
          },
        });

        if (!user) {
          throw new UnauthorizedException('User not found');
        }

        // -------------------------------------------------------
        // 8. Build update data
        // -------------------------------------------------------
        const updateData: Prisma.StopLogUpdateInput = {};

        // Timestamp for the requested step
        if (config.field) {
          updateData[config.field] = now;
        }

        // -------------------------------------------------------
        // 9. Location update
        // -------------------------------------------------------
        if (dto.location) {
          const hasLocation = Boolean(
            dto.location.address ||
              dto.location.city ||
              dto.location.state ||
              dto.location.country ||
              dto.location.zip ||
              dto.location.lat !== undefined ||
              dto.location.lng !== undefined,
          );

          if (hasLocation) {
            const location = await tx.location.create({
              data: dto.location,
              select: {
                id: true,
              },
            });

            /*
             * Arrival location should be used for arrival step.
             * For later updates we update facility_address.
             */
            if (step === LogStopStep.ARRIVAL_TIME) {
              updateData.arrival_location = {
                connect: {
                  id: location.id,
                },
              };
            } else {
              updateData.facility_address = {
                connect: {
                  id: location.id,
                },
              };
            }
          }
        }

        // -------------------------------------------------------
        // 10. BOL number
        // -------------------------------------------------------
        if (bol_number !== undefined) {
          updateData.bol_number = bol_number.trim() || null;
        }

        // -------------------------------------------------------
        // 11. Upload documents
        // -------------------------------------------------------
        if (uploadedAttachments.length > 0) {
          updateData.attachments = {
            create: uploadedAttachments,
          };
        }

        // -------------------------------------------------------
        // 12. Determine status
        // -------------------------------------------------------

        /*
         * Departure means the stop is completed.
         *
         * Upload documents can also complete the stop if
         * departure has already been recorded.
         */
        let newStatus = stopLog.status;

        if (step === LogStopStep.DEPARTURE_TIME) {
          newStatus = PrismaStopLogStatus.COMPLETED;
        }

        if (step === LogStopStep.UPLOAD_DOCUMENTS && stopLog.departed_at) {
          newStatus = PrismaStopLogStatus.COMPLETED;
        }

        updateData.status = newStatus;

        // -------------------------------------------------------
        // 13. Update stop log
        // -------------------------------------------------------
        const updatedStopLog = await tx.stopLog.update({
          where: {
            id,
          },
          data: updateData,
          select: {
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
          },
        });

        // -------------------------------------------------------
        // 14. Calculate claim when stop is completed
        // -------------------------------------------------------
        const hasAttachments = updatedStopLog.attachments.length > 0;

        if (
          updatedStopLog.status === PrismaStopLogStatus.COMPLETED &&
          hasAttachments &&
          updatedStopLog.departed_at &&
          updatedStopLog.user_id &&
          updatedStopLog.shipper_facility_id
        ) {
          const arrived = new Date(updatedStopLog.arrived_at).getTime();

          const departed = new Date(updatedStopLog.departed_at).getTime();

          const totalTime = Math.max(
            0,
            (departed - arrived) / (1000 * 60 * 60),
          );

          const payableTime = Math.max(
            0,
            totalTime - (user.free_wait_time || 0),
          );

          const totalAmount = payableTime * (user.rate_per_hour || 0);

          const claim = await tx.claim.upsert({
            where: {
              stop_log_id: updatedStopLog.id,
            },
            create: {
              status: ClaimStatus.DRAFT,
              claim_amount: Math.round(totalAmount),
              user_id: updatedStopLog.user_id,
              shipper_facility_id: updatedStopLog.shipper_facility_id,
              stop_log_id: updatedStopLog.id,
            },
            update: {
              claim_amount: Math.round(totalAmount),
            },
          });

          // -----------------------------------------------------
          // 15. Generate detention summary PDF
          // -----------------------------------------------------
          try {
            await this.pdfQueue.add('generateDetentionSummary', {
              stopLogId: updatedStopLog.id,
              claimId: claim.id,
            });
          } catch (queueError) {
            console.error('Failed to enqueue PDF generation job:', queueError);
          }
        }

        // -------------------------------------------------------
        // 16. Response
        // -------------------------------------------------------
        return ResponseHelper.success({
          message: 'Stop log updated successfully',
          data: {
            ...updatedStopLog,
            shipper_id: updatedStopLog.shipper_facility_id,
            current_step: this.getCurrentStep(updatedStopLog),
          },
        });
      });
    } catch (error) {
      // ---------------------------------------------------------
      // 17. Delete uploaded files if DB operation fails
      // ---------------------------------------------------------
      for (const attachment of uploadedAttachments) {
        try {
          await NajimStorage.delete(attachment.file_url);
        } catch (deleteError) {
          console.error('Error deleting uploaded attachment:', deleteError);
        }
      }

      throw error;
    }
  }

  async getHomeData(user_id: string, query: QueryHomeDataDto) {
    const { period = Period.TODAY } = query;

    const now = new Date();
    const periodStart = new Date(now);
    if (period === Period.TODAY) periodStart.setHours(0, 0, 0, 0);
    else if (period === Period.WEEK)
      periodStart.setDate(periodStart.getDate() - 7);
    else if (period === Period.MONTH)
      periodStart.setMonth(periodStart.getMonth() - 1);
    else if (period === Period.YEAR)
      periodStart.setFullYear(periodStart.getFullYear() - 1);

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

  async getActiveStopLog(user_id: string) {
    const activeLog = await this.prisma.stopLog.findFirst({
      where: {
        user_id,
        status: PrismaStopLogStatus.ACTIVE,
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
        attachments: {
          select: {
            id: true,
            file_name: true,
            file_url: true,
            mime_type: true,
            type: true,
            size_bytes: true,
          },
        },
        claim: true,
        shipper_facility: {
          include: {
            broker: true,
          },
        },
        broker: true,
      },
    });

    if (!activeLog) {
      return ResponseHelper.success({
        message: 'No active stop log found',
        data: null,
      });
    }

    const currentStep = this.getCurrentStep(activeLog);

    const attachments = activeLog.attachments
      .filter((attachment) => {
        return attachment.type !== AttachmentType.DETENTION_SUMMARY;
      })
      .map((attachment) => {
        return {
          ...attachment,
          file_url: NajimStorage.url(attachment.file_url, {
            signed: true,
            expires: 86400,
          }),
        };
      });

    // Get broker information - prefer direct broker relation first, fallback to shipper_facility broker
    let broker = null;

    // First try to get broker directly from stoplog
    if (activeLog.broker) {
      broker = {
        id: activeLog.broker.id,
        name: activeLog.broker.name,
        email: activeLog.broker.email,
        phone: activeLog.broker.phone,
        brokerId: activeLog.broker.brokerId,
        location_id: activeLog.broker.location_id,
        created_at: activeLog.broker.created_at,
        updated_at: activeLog.broker.updated_at,
      };
    }
    // Fallback to broker from shipper_facility
    else if (activeLog.shipper_facility?.broker) {
      broker = {
        id: activeLog.shipper_facility.broker.id,
        name: activeLog.shipper_facility.broker.name,
        email: activeLog.shipper_facility.broker.email,
        phone: activeLog.shipper_facility.broker.phone,
        brokerId: activeLog.shipper_facility.broker.brokerId,
        location_id: activeLog.shipper_facility.broker.location_id,
        created_at: activeLog.shipper_facility.broker.created_at,
        updated_at: activeLog.shipper_facility.broker.updated_at,
      };
    }

    // Get detention summary if exists
    let detention_summary_pdf = null;
    const DetentionSummary = activeLog?.attachments?.find((attachment) => {
      return attachment.type === AttachmentType.DETENTION_SUMMARY;
    });

    if (DetentionSummary) {
      detention_summary_pdf = {
        ...DetentionSummary,
        file_url: NajimStorage.url(DetentionSummary.file_url, {
          signed: true,
          expires: 63072000,
        }),
      };
    }

    return ResponseHelper.success({
      message: 'Active stop log fetched successfully',
      data: {
        id: activeLog.id,
        user_id: activeLog.user_id,
        shipper_facility_id: activeLog.shipper_facility_id,
        shipper_id: activeLog.shipper_facility_id,
        shipper_name: activeLog.shipper_name,
        facility_name: activeLog.facility_name,
        bol_number: activeLog.bol_number,
        status: activeLog.status,
        arrived_at: activeLog.arrived_at,
        docked_at: activeLog.docked_at,
        completed_at: activeLog.completed_at,
        departed_at: activeLog.departed_at,
        arrival_location: activeLog.arrival_location,
        facility_address: activeLog.facility_address,
        detention_summary_pdf,
        attachments,
        current_step: currentStep,
        broker: broker,
        claim: activeLog?.claim
          ? {
              id: activeLog.claim.id,
              status: activeLog.claim.status,
              amount: activeLog.claim.claim_amount,
              level: activeLog.claim.recourse_level,
              level_name:
                RECOURSE_LEVELS[activeLog.claim.recourse_level]?.name ||
                'Unknown Stage',
              followup_count: activeLog.claim.followup_count,
              send_method: activeLog.claim.send_method,
              sent_at: activeLog.claim.sent_at,
            }
          : null,
      },
    });
  }
}
