import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import { SubscriptionStatus } from '../../../../prisma/generated/client';

@Injectable()
export class SubscriptionSyncCron {
  private readonly logger = new Logger(SubscriptionSyncCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run every night at 3 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncSubscriptions() {
    this.logger.log('Starting nightly Stripe subscription sync...');

    try {
      // Find all active/trialing/past_due subscriptions with a stripe purchase_id
      const subscriptions = await this.prisma.userSubscription.findMany({
        where: {
          purchase_provider: 'stripe',
          status: {
            in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
          },
          purchase_id: {
            not: null,
          },
        },
      });

      this.logger.log(`Found ${subscriptions.length} subscriptions to sync.`);

      for (const sub of subscriptions) {
        if (!sub.purchase_id) continue;

        try {
          const stripeSub = (await StripePayment.retrieveSubscription(
            sub.purchase_id,
          )) as any;
          const status = stripeSub.status;
          const currentPeriodStart = new Date(
            stripeSub.current_period_start * 1000,
          );
          const currentPeriodEnd = new Date(
            stripeSub.current_period_end * 1000,
          );
          const canceledAt = stripeSub.canceled_at
            ? new Date(stripeSub.canceled_at * 1000)
            : null;

          let mappedStatus: SubscriptionStatus = 'ACTIVE';
          if (status === 'trialing') {
            mappedStatus = 'TRIALING';
          } else if (status === 'past_due') {
            mappedStatus = 'PAST_DUE';
          } else if (status === 'canceled') {
            mappedStatus = 'CANCELED';
          } else if (status === 'unpaid' || status === 'incomplete_expired') {
            mappedStatus = 'EXPIRED';
          } else if (status === 'active') {
            mappedStatus = 'ACTIVE';
          }

          await this.prisma.userSubscription.update({
            where: { id: sub.id },
            data: {
              status: mappedStatus,
              started_at: currentPeriodStart,
              expires_at: currentPeriodEnd,
              canceled_at: canceledAt,
            },
          });

          this.logger.log(
            `Synced subscription ${sub.purchase_id} -> status: ${mappedStatus}`,
          );
        } catch (subError) {
          this.logger.error(
            `Failed to sync subscription ${sub.purchase_id}: ${subError.message}`,
          );
        }
      }

      this.logger.log('Nightly Stripe subscription sync completed.');
    } catch (error) {
      this.logger.error(`Error during subscription sync: ${error.message}`);
    }
  }
}
