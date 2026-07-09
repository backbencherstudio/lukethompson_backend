import { Controller, Post, Req, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { TransactionRepository } from '../../../common/repository/transaction/transaction.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubscriptionStatus } from 'prisma/generated/client';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Payment / Stripe')
@Controller('payment/stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly transactionRepository: TransactionRepository,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({
    summary: 'Stripe Webhook Handler',
    description:
      'Handles incoming asynchronous events from Stripe (e.g. successful checkout sessions, subscriptions updates/cancellations, payment intents status updates).',
  })
  @ApiResponse({
    status: 200,
    description: 'Event processed successfully',
  })
  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    try {
      const payload = req.rawBody.toString();
      const event = await this.stripeService.handleWebhook(payload, signature);

      // Handle events
      switch (event.type) {
        case 'customer.created':
          break;
        case 'payment_intent.created':
          break;
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          // create tax transaction
          // await StripePayment.createTaxTransaction(
          //   paymentIntent.metadata['tax_calculation'],
          // );
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: paymentIntent.id,
            status: 'succeeded',
            paid_amount: paymentIntent.amount / 100, // amount in dollars
            paid_currency: paymentIntent.currency,
            raw_status: paymentIntent.status,
          });
          break;
        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: failedPaymentIntent.id,
            status: 'failed',
            raw_status: failedPaymentIntent.status,
          });
        case 'payment_intent.canceled':
          const canceledPaymentIntent = event.data.object;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: canceledPaymentIntent.id,
            status: 'canceled',
            raw_status: canceledPaymentIntent.status,
          });
          break;
        case 'payment_intent.requires_action':
          const requireActionPaymentIntent = event.data.object;
          // Update transaction status in database
          await this.transactionRepository.updateTransaction({
            reference_number: requireActionPaymentIntent.id,
            status: 'requires_action',
            raw_status: requireActionPaymentIntent.status,
          });
          break;
        case 'payout.paid':
          const paidPayout = event.data.object;
          console.log(paidPayout);
          break;
        case 'payout.failed':
          const failedPayout = event.data.object;
          console.log(failedPayout);
          break;

        case 'checkout.session.completed':
          const checkoutSession = event.data.object as any;
          if (checkoutSession.mode === 'subscription') {
            const user_id = checkoutSession.client_reference_id;
            const plan_id = checkoutSession.metadata?.plan_id;
            const subscriptionId = checkoutSession.subscription;

            if (user_id && plan_id && subscriptionId) {
              const started_at = new Date();
              const expires_at = new Date();
              expires_at.setMonth(expires_at.getMonth() + 1);

              await this.prisma.userSubscription.create({
                data: {
                  user_id,
                  plan_id,
                  status: 'ACTIVE',
                  started_at,
                  expires_at,
                  purchase_provider: 'stripe',
                  purchase_id: subscriptionId,
                },
              });
            }
          }
          break;

        case 'customer.subscription.updated':
          const stripeSubscription = event.data.object as any;
          const subId = stripeSubscription.id;
          const status = stripeSubscription.status;
          const currentPeriodStart = new Date(
            stripeSubscription.current_period_start * 1000,
          );
          const currentPeriodEnd = new Date(
            stripeSubscription.current_period_end * 1000,
          );
          const canceledAt = stripeSubscription.canceled_at
            ? new Date(stripeSubscription.canceled_at * 1000)
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

          await this.prisma.userSubscription.updateMany({
            where: {
              purchase_id: subId,
              purchase_provider: 'stripe',
            },
            data: {
              status: mappedStatus,
              started_at: currentPeriodStart,
              expires_at: currentPeriodEnd,
              canceled_at: canceledAt,
            },
          });
          break;

        case 'customer.subscription.deleted':
          const deletedSub = event.data.object as any;
          const deletedSubId = deletedSub.id;

          await this.prisma.userSubscription.updateMany({
            where: {
              purchase_id: deletedSubId,
              purchase_provider: 'stripe',
            },
            data: {
              status: 'CANCELED',
              canceled_at: new Date(),
            },
          });
          break;

        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Webhook error', error);
      return { received: false };
    }
  }
}
