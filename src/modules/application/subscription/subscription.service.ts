import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripePayment } from '../../../common/lib/Payment/stripe/StripePayment';
import { CreateCheckoutSessionDto } from './dto/subscription.dto';
import { PlanStatus } from 'prisma/generated/enums';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: {
        status: PlanStatus.ACTIVE,
      },
      orderBy: {
        sort_order: 'asc',
      },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    return {
      success: true,
      data: plans,
    };
  }

  async getCurrentSubscription(user_id: string) {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        user_id,
        status: {
          in: ['ACTIVE', 'TRIALING'],
        },
      },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      success: true,
      data: subscription || null,
    };
  }

  async createCheckoutSession(user_id: string, dto: CreateCheckoutSessionDto) {
    const { plan_id } = dto;

    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: plan_id },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (!plan.price_id) {
      throw new BadRequestException(
        'This plan does not have a Stripe Price ID configured.',
      );
    }

    // 1. Ensure user has a Stripe customer ID (billing_id)
    let billing_id = user.billing_id;
    if (!billing_id) {
      try {
        const stripeCustomer = await StripePayment.createCustomer({
          user_id: user.id,
          email: user.email || '',
          name: user.name || '',
        });
        billing_id = stripeCustomer.id;
        await this.prisma.user.update({
          where: { id: user_id },
          data: { billing_id },
        });
      } catch (error) {
        throw new BadRequestException(
          `Failed to create Stripe customer: ${error.message}`,
        );
      }
    }

    // 2. Generate Stripe checkout session
    try {
      const session = await StripePayment.createCheckoutSessionSubscription(
        billing_id,
        plan.price_id,
        user_id,
        { plan_id: plan.id },
      );

      return {
        success: true,
        message: 'Checkout session created successfully',
        data: {
          id: session.id,
          url: session.url,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create Stripe checkout session: ${error.message}`,
      );
    }
  }
}
