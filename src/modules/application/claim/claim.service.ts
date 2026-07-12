import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import { QueryClaimDto, QueryClaimStatus } from './dto/query-claim.dto';
import {
  ClaimStatus,
  ClaimEventType,
  Prisma,
  AttachmentType,
} from 'prisma/generated/client';
import {
  MarkPaidDto,
  MarkDeniedDto,
  SubmitClaimDto,
} from './dto/update-claim.dto';
import { MailService } from 'src/mail/mail.service';
import { SendFollowUpDto } from './dto/send-follow-up.dto';
import { NajimStorage } from 'src/common/lib/Disk/NajimStorage';

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
export class ClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private formatHoursMinutes(hours: number) {
    const totalMinutes = Math.round(hours * 60);
    const formattedHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${formattedHours}h ${minutes}m`;
  }

  async getAllClaims(query: QueryClaimDto, user_id: string) {
    const { cursor, limit = 10, search, status = QueryClaimStatus.ALL } = query;

    const where: Prisma.ClaimWhereInput = {
      user_id,
    };

    // Apply status filter if not ALL
    if (status !== QueryClaimStatus.ALL) {
      where.status = status as unknown as ClaimStatus;
    }

    // Apply search filter (facility name, BOL, or load number)
    if (search) {
      where.OR = [
        {
          stop_log: {
            facility_name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          shipper_facility: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          stop_log: {
            bol_number: { contains: search, mode: 'insensitive' },
          },
        },
        {
          stop_log: {
            load_number: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);

    // Parallelize all database queries for maximum performance
    const [data, statusGroups, pendingAggregate, settledAggregate] =
      await Promise.all([
        // 1. Fetch paginated claims data
        this.prisma.claim.findMany({
          where,
          take: Number(limit) + 1,
          skip: cursor ? 1 : undefined,
          cursor: cursor
            ? {
                id: cursor,
              }
            : undefined,
          orderBy: { created_at: 'desc' },

          include: {
            stop_log: {
              select: {
                facility_name: true,
                arrived_at: true,
                bol_number: true,
                load_number: true,
              },
            },
            shipper_facility: {
              select: {
                name: true,
              },
            },
          },
        }),

        // 2. Fetch counts grouped by status
        this.prisma.claim.groupBy({
          by: ['status'],
          where: { user_id },
          _count: { id: true },
        }),

        // 3. Sum of pending claims amount
        this.prisma.claim.aggregate({
          where: {
            user_id,
            status: ClaimStatus.SUBMITTED,
          },
          _sum: {
            claim_amount: true,
          },
        }),

        // 4. Sum of settled claims this week
        this.prisma.claim.aggregate({
          where: {
            user_id,
            status: ClaimStatus.PAID,
            paid_at: {
              gte: weekStart,
              lt: nextWeekStart,
            },
          },
          _sum: {
            paid_amount: true,
            claim_amount: true,
          },
        }),
      ]);

    const nextCursor =
      data.length > Number(limit) ? data[Number(limit)].id : null;
    if (nextCursor) {
      data.pop();
    }

    // Map claim records to the single card format requested
    const formattedData = data.map((claim) => {
      const facility_name =
        claim.stop_log?.facility_name ??
        claim.shipper_facility?.name ??
        'Unknown Facility';
      const date = claim.stop_log?.arrived_at ?? claim.created_at;
      const amount = claim.paid_amount ?? claim.claim_amount;

      return {
        id: claim.id,
        facility_name,
        date,
        amount,
        status: claim.status,
      };
    });

    // --- Meta-data Stats and Counts Calculation ---
    const counts = {
      all: 0,
      draft: 0,
      submitted: 0,
      paid: 0,
      denied: 0,
    };

    let totalCount = 0;
    statusGroups.forEach((group) => {
      const countVal = group._count.id;
      totalCount += countVal;

      if (group.status === ClaimStatus.DRAFT) {
        counts.draft += countVal;
      } else if (group.status === ClaimStatus.PAID) {
        counts.paid += countVal;
      } else if (group.status === ClaimStatus.DENIED) {
        counts.denied += countVal;
      } else if (group.status === ClaimStatus.SUBMITTED) {
        counts.submitted += countVal;
      }
    });
    counts.all = totalCount;

    const pendingClaimsAmount = (
      pendingAggregate._sum.claim_amount ?? 0
    ).toFixed(2);

    const settledThisWeekAmount = (
      settledAggregate._sum.paid_amount ??
      settledAggregate._sum.claim_amount ??
      0
    ).toFixed(2);

    return ResponseHelper.success({
      message: 'Claims fetched successfully',
      data: formattedData,
      meta_data: {
        next_cursor: nextCursor,
        limit: Number(limit),
        search,
        filters: {
          status,
        },
        counts,
        stats: {
          pending_claims_amount: pendingClaimsAmount,
          settled_this_week_amount: settledThisWeekAmount,
        },
      },
    });
  }

  async markPaid(id: string, dto: MarkPaidDto, user_id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, user_id },
    });
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const paid_amount = dto.paid_amount ?? claim.claim_amount;

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: {
        status: ClaimStatus.PAID,
        paid_at: new Date(),
        paid_amount,
      },
    });

    return ResponseHelper.success({
      message: 'Claim marked as paid successfully',
      data: updatedClaim,
    });
  }

  async markDenied(id: string, dto: MarkDeniedDto, user_id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, user_id },
    });
    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    const updatedClaim = await this.prisma.claim.update({
      where: { id },
      data: {
        status: ClaimStatus.DENIED,
        denied_at: new Date(),
        denied_by: dto.denied_by ?? claim?.denied_by,
        denial_reason: dto.denial_reason ?? claim?.denial_reason,
      },
    });

    return ResponseHelper.success({
      message: 'Claim marked as denied successfully',
      data: updatedClaim,
    });
  }

  async sendFollowUp(id: string, dto: SendFollowUpDto, user_id: string) {
    // 1. Fetch claim with stop log details and user details (driver name)
    const claim = await this.prisma.claim.findFirst({
      where: { id, user_id },
      include: {
        stop_log: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // 2. Validate downgrade restriction
    let minLevel = 1;
    if (claim.followup_count === 1) {
      minLevel = 2;
    } else if (claim.followup_count >= 2) {
      minLevel = 3;
    }

    if (dto.level < minLevel) {
      throw new BadRequestException(
        `Downgrade restriction: Cannot select Level ${dto.level} follow-up when current follow-up count is ${claim.followup_count}`,
      );
    }

    if (!claim.sent_at) {
      throw new BadRequestException('Claim has not been submitted yet');
    }

    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - claim.sent_at.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let requiredDays = 0;
    if (dto.level === 1) {
      requiredDays = 2;
    } else if (dto.level === 2) {
      requiredDays = 7;
    } else if (dto.level === 3) {
      requiredDays = 14;
    }

    if (diffDays < requiredDays) {
      throw new BadRequestException(
        `Follow-up Level ${dto.level} is locked until Day ${requiredDays} (currently Day ${diffDays}).`,
      );
    }

    // 3. Resolve recipient and CC emails
    const toEmail = claim.recipient_email || claim.stop_log?.broker_email;
    if (!toEmail) {
      throw new BadRequestException(
        'No recipient email configured for this claim',
      );
    }

    const cc = [];
    if (
      claim.stop_log?.broker_email &&
      claim.stop_log.broker_email !== toEmail
    ) {
      // Check if user has cc_broker setting enabled (defaults to true)
      const brokerCcSetting = await this.prisma.userSetting.findFirst({
        where: {
          user_id,
          setting: { key: 'cc_broker' },
        },
      });
      const isCcEnabled = brokerCcSetting
        ? brokerCcSetting.value === 'true'
        : true;
      if (isCcEnabled) {
        cc.push(claim.stop_log.broker_email);
      }
    }

    // 4. Determine template and subject line
    let template = '';
    let subject = '';
    let templateLevelName = '';

    const bolSuffix = claim.stop_log?.bol_number
      ? ` - BOL: ${claim.stop_log.bol_number}`
      : '';

    if (dto.level === 1) {
      template = 'follow-up-level1';
      subject = `Professional Reminder: Outstanding Detention Payment${bolSuffix}`;
      templateLevelName = 'Professional Reminder';
    } else if (dto.level === 2) {
      template = 'follow-up-level2';
      subject = `Firm Notice: Past Due Detention Invoice${bolSuffix}`;
      templateLevelName = 'Firm Notice';
    } else {
      template = 'follow-up-level3';
      subject = `FINAL NOTICE: Immediate Detention Payment Required${bolSuffix}`;
      templateLevelName = 'Final Notice';
    }

    // 5. Trigger email dispatch
    const context = {
      driverName: claim.user?.name || 'Driver',
      facilityName: claim.stop_log?.facility_name || 'Unknown Facility',
      amount: claim.claim_amount,
      bolNumber: claim.stop_log?.bol_number || '',
      loadNumber: claim.stop_log?.load_number || '',
      brokerName: claim.stop_log?.broker_name || '',
      brokerMcNumber: claim.stop_log?.broker_mc_number || '',
      brokerEmail: claim.stop_log?.broker_email || '',
    };

    await this.mailService.sendClaimFollowUp({
      to: toEmail,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      template,
      context,
    });

    // 6. Database mutations in sequential transaction
    const nextMilestone = new Date(now);
    nextMilestone.setDate(nextMilestone.getDate() + 7); // update timestamp for next milestone (7 days from now)

    const formattedDate = now.toISOString().split('T')[0];
    const eventDescription = `Follow-up sent: ${templateLevelName} - ${formattedDate}`;

    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      // Update claim fields
      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          followup_count: Math.max(claim.followup_count, dto.level),
          last_follow_up_at: now,
          followup_due_at: nextMilestone,
          recourse_level: 1, // recourse_level level 1 is the followup stage
        },
      });

      // Insert timeline event record
      await tx.claimEvent.create({
        data: {
          claim_id: claim.id,
          type: ClaimEventType.FOLLOW_UP_SENT,
          recourse_level: 1,
          followup_level: dto.level,
          description: eventDescription,
        },
      });

      return updated;
    });

    return ResponseHelper.success({
      message: `${templateLevelName} follow-up sent successfully`,
      data: updatedClaim,
    });
  }

  async submitClaim(stoplog_id: string, dto: SubmitClaimDto, user_id: string) {
    // 1. Fetch the claim with stop log and user details
    const claim = await this.prisma.claim.findFirst({
      where: { stop_log_id: stoplog_id, user_id },
      include: {
        stop_log: {
          include: {
            arrival_location: true,
            attachments: true,
          },
        },
        user: true,
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // 2. Retrieve the generated DETENTION_SUMMARY PDF attachment
    const pdfAttachment = await this.prisma.attachment.findFirst({
      where: {
        claim_id: claim.id,
        type: AttachmentType.DETENTION_SUMMARY,
      },
    });
    if (!pdfAttachment) {
      throw new BadRequestException(
        'Detention summary PDF is still generating. Please try again in a few seconds.',
      );
    }

    // 3. Generate pre-signed URL for the PDF (valid for 2 years)
    const pdfUrl = NajimStorage.url(pdfAttachment.file_url, {
      signed: true,
      expires: 63072000,
    });

    // Helper functions for time/money calculations
    const arrived = new Date(claim.stop_log.arrived_at).getTime();
    const departed = claim.stop_log.departed_at
      ? new Date(claim.stop_log.departed_at).getTime()
      : new Date().getTime();
    const totalTime = Math.max(0, (departed - arrived) / (1000 * 60 * 60));
    const payableTime = Math.max(
      0,
      totalTime - (claim.user?.free_wait_time || 0),
    );
    const totalAmount = payableTime * (claim.user?.rate_per_hour || 0);

    const formatDuration = (hoursDecimal: number): string => {
      const hours = Math.floor(hoursDecimal);
      const minutes = Math.round((hoursDecimal - hours) * 60);
      if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h`;
      return `${minutes}m`;
    };

    const formatTime = (date: Date): string => {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    };

    const claimAmountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.round(totalAmount));

    let claimMessage = '';
    if (dto.claim_method.toUpperCase() === 'MESSAGE') {
      claimMessage = `Hello,

This is a formal request for payment of the detention claim of ${claimAmountFormatted} for the stop log at ${claim.stop_log?.facility_name || 'facility'}.

Claim Details:
- BOL Number: ${claim.stop_log?.bol_number || 'N/A'}
- Arrived At: ${claim.stop_log?.arrived_at}
- Departed At: ${claim.stop_log?.departed_at || 'N/A'}
- Billable Detention: ${formatDuration(payableTime)}

You can view the detention summary PDF here:
${pdfUrl}`;
    }

    // 4. Handle EMAIL submission method
    if (dto.claim_method.toUpperCase() === 'EMAIL') {
      const cc = [];
      if (dto.broker_email && dto.broker_email !== dto.recipient_email) {
        cc.push(dto.broker_email);
      } else if (
        claim.stop_log?.broker_email &&
        claim.stop_log.broker_email !== dto.recipient_email
      ) {
        cc.push(claim.stop_log.broker_email);
      }

      const gpsStr =
        claim.stop_log?.arrival_location?.lat &&
        claim.stop_log?.arrival_location?.lng
          ? `${Number(claim.stop_log.arrival_location.lat).toFixed(4)}, ${Number(claim.stop_log.arrival_location.lng).toFixed(4)}`
          : 'N/A';

      const otherAttachments = claim.stop_log.attachments
        .filter((att) => att.type !== AttachmentType.DETENTION_SUMMARY)
        .map((att) => ({
          file_name: att.file_name || 'Attachment',
          file_url: NajimStorage.url(att.file_url, {
            signed: true,
            expires: 63072000,
          }),
        }));

      const bolSuffix = claim.stop_log?.bol_number
        ? ` - BOL: ${claim.stop_log.bol_number}`
        : '';

      const subject = `Detention Claim Submission${bolSuffix}`;

      await this.mailService.sendClaimSubmission({
        to: dto.recipient_email,
        cc: cc.length > 0 ? cc : undefined,
        subject,
        template: 'detention-summary',
        context: {
          isEmail: true,
          claimAmount: claimAmountFormatted,
          billableDurationStr: formatDuration(payableTime),
          detentionRate: claim.user?.rate_per_hour || 0,
          freeWaitTimeStr: formatDuration(claim.user?.free_wait_time || 0),
          facilityName: claim.stop_log.facility_name,
          arrivalTimeStr: formatTime(claim.stop_log.arrived_at),
          departureTimeStr: claim.stop_log.departed_at
            ? formatTime(claim.stop_log.departed_at)
            : 'N/A',
          bolNumber: claim.stop_log.bol_number,
          gpsStr,
          attachments: otherAttachments,
        },
        attachments: [
          {
            filename: pdfAttachment.file_name || 'detention-summary.pdf',
            path: pdfUrl,
            contentType: 'application/pdf',
          },
        ],
      });
    }

    // 5. Perform sequential database updates inside transaction
    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      if (dto.broker_email) {
        await tx.stopLog.update({
          where: { id: claim.stop_log_id },
          data: {
            broker_email: dto.broker_email,
          },
        });
      }

      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          status: ClaimStatus.SUBMITTED,
          sent_at: new Date(),
          recipient_email: dto.recipient_email,
          send_method: dto.claim_method.toUpperCase(),
        },
      });

      await tx.claimEvent.create({
        data: {
          claim_id: claim.id,
          type: ClaimEventType.CLAIM_SENT,
          description: `Claim submitted via ${dto.claim_method} to ${dto.recipient_email}`,
        },
      });

      return updated;
    });

    return ResponseHelper.success({
      message:
        dto.claim_method.toUpperCase() === 'EMAIL'
          ? 'Claim submitted successfully via email'
          : 'Claim message generated successfully',
      data: {
        claim_id: updatedClaim.id,
        status: updatedClaim.status,
        sent_at: updatedClaim.sent_at,
        ...(claimMessage ? { claim_message: claimMessage } : {}),
      },
    });
  }

  async getOneClaim(id: string, user_id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, user_id },
      include: {
        user: {
          select: {
            rate_per_hour: true,
            free_wait_time: true,
          },
        },
        shipper_facility: {
          select: {
            name: true,
          },
        },
        stop_log: {
          include: {
            arrival_location: true,
            facility_address: true,
            attachments: true,
          },
        },
        attachments: true,
        claim_events: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    // Combine stop log and claim attachments, resolving file URLs
    const stopLogAttachments = claim.stop_log?.attachments || [];
    const claimAttachments = claim.attachments || [];
    const allRawAttachments = [...stopLogAttachments, ...claimAttachments];
    const uniqueAttachmentsMap = new Map<
      string,
      (typeof allRawAttachments)[0]
    >();
    for (const att of allRawAttachments) {
      uniqueAttachmentsMap.set(att.id, att);
    }

    const attachments = Array.from(uniqueAttachmentsMap.values())
      .filter(
        (attachment) => attachment.type !== AttachmentType.DETENTION_SUMMARY,
      )
      .map((attachment) => ({
        id: attachment.id,
        file_name: attachment.file_name,
        file_url: NajimStorage.url(attachment.file_url, {
          signed: true,
          expires: 86400,
        }),
        mime_type: attachment.mime_type,
        type: attachment.type,
        size_bytes: attachment.size_bytes,
      }));

    // Resolve detention summary PDF
    let detention_summary_pdf = null;
    const detentionSummaryAttachment = Array.from(
      uniqueAttachmentsMap.values(),
    ).find(
      (attachment) => attachment.type === AttachmentType.DETENTION_SUMMARY,
    );

    if (detentionSummaryAttachment) {
      detention_summary_pdf = {
        id: detentionSummaryAttachment.id,
        file_name: detentionSummaryAttachment.file_name,
        file_url: NajimStorage.url(detentionSummaryAttachment.file_url, {
          signed: true,
          expires: 63072000,
        }),
        mime_type: detentionSummaryAttachment.mime_type,
        type: detentionSummaryAttachment.type,
        size_bytes: detentionSummaryAttachment.size_bytes,
      };
    }

    // recourse level lookup
    const recourseLevelInfo = RECOURSE_LEVELS[claim.recourse_level] || {
      name: 'Unknown Stage',
    };

    // Format timeline events
    const timeline = (claim.claim_events || []).map((event) => ({
      id: event.id,
      created_at: event.created_at,
      type: event.type,
      recourse_level: event.recourse_level,
      followup_level: event.followup_level,
      description: event.description,
    }));

    return ResponseHelper.success({
      message: 'Claim fetched successfully',
      data: {
        id: claim.id,
        status: claim.status,
        claim_amount: claim.claim_amount,
        paid_amount: claim.paid_amount,
        sent_at: claim.sent_at,
        paid_at: claim.paid_at,
        denied_at: claim.denied_at,
        denied_by: claim.denied_by,
        denial_reason: claim.denial_reason,
        recipient_email: claim.recipient_email,
        broker_email: claim.stop_log?.broker_email,
        send_method: claim.send_method,
        recourse_level: claim.recourse_level,
        recourse_level_name: recourseLevelInfo.name,
        followup_count: claim.followup_count,
        last_follow_up_at: claim.last_follow_up_at,
        followup_due_at: claim.followup_due_at,
        usps_tracking_number: claim.usps_tracking_number,
        fmcsa_complaint_number: claim.fmcsa_complaint_number,
        small_claims_case_number: claim.small_claims_case_number,
        broker_escalation_at: claim.broker_escalation_at,
        demand_letter_at: claim.demand_letter_at,
        bond_claim_at: claim.bond_claim_at,
        credit_report_at: claim.credit_report_at,
        fmcsa_complaint_at: claim.fmcsa_complaint_at,
        load_board_report_at: claim.load_board_report_at,
        small_claims_filed_at: claim.small_claims_filed_at,
        collections_referred_at: claim.collections_referred_at,
        detention_summary_pdf,
        attachments,
        timeline,
      },
    });
  }

  async escalateClaim(id: string, user_id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, user_id },
      include: {
        stop_log: true,
      },
    });

    if (!claim) {
      throw new NotFoundException('Claim not found');
    }

    if (claim.status === ClaimStatus.PAID) {
      throw new BadRequestException('Claim is already paid');
    }

    if (!claim.sent_at) {
      throw new BadRequestException('Claim has not been submitted yet');
    }

    const now = new Date();
    let nextRecourseLevel = null;
    let eventType: ClaimEventType = null;
    let requiredGapDays = 0;
    let stageName = '';
    let description = '';
    let elapsedDays = 0;

    if (claim.recourse_level === 1) {
      if (claim.followup_count < 3 || !claim.last_follow_up_at) {
        throw new BadRequestException(
          'Cannot escalate to Broker Formal Escalation. Please send the 3rd soft follow-up first.',
        );
      }
      const oneDayMs = 24 * 60 * 60 * 1000;
      const diffTime = now.getTime() - claim.last_follow_up_at.getTime();
      elapsedDays = Math.floor(diffTime / oneDayMs);
      requiredGapDays = 1;

      if (diffTime < oneDayMs) {
        throw new BadRequestException(
          `Broker Formal Escalation is locked until 1 day after sending the 3rd follow-up (currently ${elapsedDays} days elapsed).`,
        );
      }

      nextRecourseLevel = 2;
      eventType = ClaimEventType.BROKER_ESCALATION_SENT;
      stageName = 'Broker Formal Escalation';
      description = `Broker Formal Escalation initiated manually by driver (1 day after 3rd follow-up)`;
    } else {
      let previousActionDate: Date | null = null;
      if (claim.recourse_level === 2) {
        previousActionDate = claim.broker_escalation_at;
      } else if (claim.recourse_level === 3) {
        previousActionDate = claim.demand_letter_at;
      } else if (claim.recourse_level === 4) {
        previousActionDate = claim.bond_claim_at;
      } else if (claim.recourse_level === 5) {
        previousActionDate = claim.credit_report_at;
      } else if (claim.recourse_level === 6) {
        previousActionDate = claim.fmcsa_complaint_at;
      } else if (claim.recourse_level === 7) {
        previousActionDate = claim.load_board_report_at;
      } else if (claim.recourse_level === 8) {
        previousActionDate = claim.small_claims_filed_at;
      }

      if (!previousActionDate) {
        throw new BadRequestException(
          `Cannot escalate. Action for recourse level ${claim.recourse_level} has not been recorded.`,
        );
      }

      const diffTime = now.getTime() - previousActionDate.getTime();
      elapsedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (claim.recourse_level === 2) {
        requiredGapDays = 6;
        nextRecourseLevel = 3;
        eventType = ClaimEventType.DEMAND_LETTER_MAILED;
        stageName = 'Certified Demand Letter';
      } else if (claim.recourse_level === 3) {
        requiredGapDays = 4;
        nextRecourseLevel = 4;
        eventType = ClaimEventType.BOND_CLAIM_FILED;
        stageName = 'Broker Bond Claim (BMC-84/85)';
      } else if (claim.recourse_level === 4) {
        requiredGapDays = 5;
        nextRecourseLevel = 5;
        eventType = ClaimEventType.CREDIT_REPORT_SUBMITTED;
        stageName = 'Credit Bureau Report';
      } else if (claim.recourse_level === 5) {
        requiredGapDays = 5;
        nextRecourseLevel = 6;
        eventType = ClaimEventType.FMCSA_COMPLAINT_FILED;
        stageName = 'FMCSA Complaint';
      } else if (claim.recourse_level === 6) {
        requiredGapDays = 5;
        nextRecourseLevel = 7;
        eventType = ClaimEventType.LOAD_BOARD_REVIEW_POSTED;
        stageName = 'Load Board Negative Report';
      } else if (claim.recourse_level === 7) {
        requiredGapDays = 5;
        nextRecourseLevel = 8;
        eventType = ClaimEventType.SMALL_CLAIMS_FILED;
        stageName = 'Small Claims Court Filing';
      } else if (claim.recourse_level === 8) {
        requiredGapDays = 15;
        nextRecourseLevel = 9;
        eventType = ClaimEventType.COLLECTIONS_REFERRED;
        stageName = 'Collections / Attorney Referral';
      } else {
        throw new BadRequestException(
          'Claim is already at the highest recourse level',
        );
      }

      if (elapsedDays < requiredGapDays) {
        throw new BadRequestException(
          `Cannot escalate to ${stageName} yet. This stage unlocks ${requiredGapDays} days after Level ${claim.recourse_level} action (currently ${elapsedDays} days elapsed).`,
        );
      }

      description = `${stageName} initiated manually by driver (${elapsedDays} days after Level ${claim.recourse_level})`;
    }

    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        recourse_level: nextRecourseLevel,
        followup_due_at: null,
      };

      if (nextRecourseLevel === 2) {
        updateData.broker_escalation_at = now;
      } else if (nextRecourseLevel === 3) {
        updateData.demand_letter_at = now;
      } else if (nextRecourseLevel === 4) {
        updateData.bond_claim_at = now;
      } else if (nextRecourseLevel === 5) {
        updateData.credit_report_at = now;
      } else if (nextRecourseLevel === 6) {
        updateData.fmcsa_complaint_at = now;
      } else if (nextRecourseLevel === 7) {
        updateData.load_board_report_at = now;
      } else if (nextRecourseLevel === 8) {
        updateData.small_claims_filed_at = now;
      } else if (nextRecourseLevel === 9) {
        updateData.collections_referred_at = now;
      }

      // Update recourse level and specific stage timestamp
      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: updateData,
      });

      // Create event
      await tx.claimEvent.create({
        data: {
          claim_id: claim.id,
          type: eventType,
          recourse_level: nextRecourseLevel,
          description,
        },
      });

      return updated;
    });

    return ResponseHelper.success({
      message: `Claim escalated successfully to ${stageName}`,
      data: updatedClaim,
    });
  }

  async processNightlyClaims() {
    const claims = await this.prisma.claim.findMany({
      where: {
        status: ClaimStatus.SUBMITTED,
        recourse_level: { lte: 1 },
      },
    });

    const now = new Date();

    for (const claim of claims) {
      if (!claim.sent_at) continue;

      const diffTime = Math.max(0, now.getTime() - claim.sent_at.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let targetFollowUpCount = claim.followup_count;

      if (diffDays >= 14) {
        targetFollowUpCount = 3;
      } else if (diffDays >= 7) {
        targetFollowUpCount = 2;
      } else if (diffDays >= 2) {
        targetFollowUpCount = 1;
      }

      if (targetFollowUpCount > claim.followup_count) {
        try {
          await this.prisma.claim.update({
            where: { id: claim.id },
            data: {
              followup_count: targetFollowUpCount,
            },
          });
        } catch (err) {
          console.error(
            `Error auto-incrementing follow-up count for claim ${claim.id}:`,
            err,
          );
        }
      }
    }
  }
}
