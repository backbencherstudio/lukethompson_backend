import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import { QueryClaimDto, QueryClaimStatus } from './dto/query-claim.dto';
import { ClaimStatus, ClaimEventType, Prisma } from 'prisma/generated/client';
import { MarkPaidDto, MarkDeniedDto } from './dto/update-claim.dto';
import { MailService } from 'src/mail/mail.service';
import { SendFollowUpDto } from './dto/send-follow-up.dto';

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
    const [data, statusGroups, pendingAggregate, settledAggregate] = await Promise.all([
      // 1. Fetch paginated claims data
      this.prisma.claim.findMany({
        where,
        take: Number(limit) + 1,
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

    const nextCursor = data.length > Number(limit) ? data[Number(limit)].id : null;
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
        denied_by: dto.denied_by,
        denial_reason: dto.denial_reason,
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

    // 3. Resolve recipient and CC emails
    const toEmail = claim.recipient_email || claim.stop_log?.broker_email;
    if (!toEmail) {
      throw new BadRequestException('No recipient email configured for this claim');
    }

    const cc = [];
    if (claim.stop_log?.broker_email && claim.stop_log.broker_email !== toEmail) {
      // Check if user has cc_broker setting enabled (defaults to true)
      const brokerCcSetting = await this.prisma.userSetting.findFirst({
        where: {
          user_id,
          setting: { key: 'cc_broker' },
        },
      });
      const isCcEnabled = brokerCcSetting ? brokerCcSetting.value === 'true' : true;
      if (isCcEnabled) {
        cc.push(claim.stop_log.broker_email);
      }
    }

    // 4. Determine template and subject line
    let template = '';
    let subject = '';
    let templateLevelName = '';

    const bolSuffix = claim.stop_log?.bol_number ? ` - BOL: ${claim.stop_log.bol_number}` : '';

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
    const now = new Date();
    const nextMilestone = new Date(now);
    nextMilestone.setDate(nextMilestone.getDate() + 7); // update timestamp for next milestone (7 days from now)

    const formattedDate = now.toISOString().split('T')[0];
    const eventDescription = `Follow-up sent: ${templateLevelName} - ${formattedDate}`;

    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      // Update claim fields
      const updated = await tx.claim.update({
        where: { id: claim.id },
        data: {
          followup_count: claim.followup_count + 1,
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
}
