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
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        currency: true,
        interval: true,
        status: true,
        sort_order: true,
        product_id: true,
        price_id: true,
        apple_product_id: true,
        google_product_id: true,
        created_at: true,
        updated_at: true,
        features: {
          select: {
            enabled: true,
            limit_value: true,
            feature: {
              select: {
                id: true,
                key: true,
                name: true,
                description: true,
                type: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    const formattedPlans = plans.map((plan) => ({
      ...plan,
      price: Number(plan.price),
      features: plan.features.map((f) => ({
        id: f.feature?.id,
        key: f.feature?.key,
        name: f.feature?.name,
        description: f.feature?.description,
        type: f.feature?.type,
        unit: f.feature?.unit,
        limit_value: f.limit_value,
        enabled: f.enabled,
      })),
    }));

    return {
      success: true,
      message: 'Active subscription plans retrieved successfully',
      data: formattedPlans,
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
      select: {
        id: true,
        status: true,
        started_at: true,
        expires_at: true,
        canceled_at: true,
        purchase_provider: true,
        purchase_id: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            type: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            currency: true,
            interval: true,
            features: {
              select: {
                enabled: true,
                limit_value: true,
                feature: {
                  select: {
                    id: true,
                    key: true,
                    name: true,
                    description: true,
                    type: true,
                    unit: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedSub = subscription
      ? {
          ...subscription,
          plan: subscription.plan
            ? {
                ...subscription.plan,
                price: Number(subscription.plan.price),
                features: subscription.plan.features.map((f) => ({
                  id: f.feature?.id,
                  key: f.feature?.key,
                  name: f.feature?.name,
                  description: f.feature?.description,
                  type: f.feature?.type,
                  unit: f.feature?.unit,
                  limit_value: f.limit_value,
                  enabled: f.enabled,
                })),
              }
            : null,
        }
      : null;

    return {
      success: true,
      message: 'Current user subscription retrieved successfully',
      data: formattedSub,
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
