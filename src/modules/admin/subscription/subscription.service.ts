import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSubscriptionPlanDto,
  CreateSubscriptionFeatureDto,
  CreateUserSubscriptionDto,
} from './dto/create-subscription.dto';
import {
  UpdateSubscriptionPlanDto,
  UpdateSubscriptionFeatureDto,
  UpdateUserSubscriptionDto,
} from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // PLAN CRUD
  // ==========================================

  async createPlan(dto: CreateSubscriptionPlanDto) {
    const { features, ...planData } = dto;

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        ...planData,
        features: features
          ? {
              create: features.map((f) => ({
                feature_id: f.feature_id,
                enabled: f.enabled ?? true,
                limit_value: f.limit_value,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        name: true,
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

    const formattedPlan = {
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
    };

    return {
      success: true,
      message: 'Subscription plan created successfully',
      data: formattedPlan,
    };
  }

  async findAllPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        name: true,
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
      message: 'Subscription plans retrieved successfully',
      data: formattedPlans,
    };
  }

  async findOnePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
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

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const formattedPlan = {
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
    };

    return {
      success: true,
      message: 'Subscription plan details retrieved successfully',
      data: formattedPlan,
    };
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    const { features, ...planData } = dto;

    // Check if plan exists
    await this.findOnePlan(id);

    const updateData: any = { ...planData };

    if (features) {
      // For simplicity, we delete existing features mapping and recreate them
      await this.prisma.subscriptionPlanFeature.deleteMany({
        where: { plan_id: id },
      });

      updateData.features = {
        create: features.map((f) => ({
          feature_id: f.feature_id,
          enabled: f.enabled ?? true,
          limit_value: f.limit_value,
        })),
      };
    }

    const updatedPlan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
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

    const formattedPlan = {
      ...updatedPlan,
      price: Number(updatedPlan.price),
      features: updatedPlan.features.map((f) => ({
        id: f.feature?.id,
        key: f.feature?.key,
        name: f.feature?.name,
        description: f.feature?.description,
        type: f.feature?.type,
        unit: f.feature?.unit,
        limit_value: f.limit_value,
        enabled: f.enabled,
      })),
    };

    return {
      success: true,
      message: 'Subscription plan updated successfully',
      data: formattedPlan,
    };
  }

  async removePlan(id: string) {
    await this.findOnePlan(id);

    // Delete relation mappings first due to foreign keys, although onDelete: Cascade is configured in schema.prisma
    await this.prisma.subscriptionPlanFeature.deleteMany({
      where: { plan_id: id },
    });

    await this.prisma.subscriptionPlan.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Subscription plan deleted successfully',
      data: null,
    };
  }

  // ==========================================
  // FEATURE CRUD
  // ==========================================

  async createFeature(dto: CreateSubscriptionFeatureDto) {
    const feature = await this.prisma.subscriptionFeature.create({
      data: dto,
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        reset_period: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      success: true,
      message: 'Subscription feature created successfully',
      data: feature,
    };
  }

  async findAllFeatures() {
    const features = await this.prisma.subscriptionFeature.findMany({
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        reset_period: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      success: true,
      message: 'Subscription features retrieved successfully',
      data: features,
    };
  }

  async findOneFeature(id: string) {
    const feature = await this.prisma.subscriptionFeature.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        reset_period: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!feature) {
      throw new NotFoundException('Subscription feature not found');
    }

    return {
      success: true,
      message: 'Subscription feature details retrieved successfully',
      data: feature,
    };
  }

  async updateFeature(id: string, dto: UpdateSubscriptionFeatureDto) {
    await this.findOneFeature(id);

    const updatedFeature = await this.prisma.subscriptionFeature.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        reset_period: true,
        is_active: true,
        sort_order: true,
        created_at: true,
        updated_at: true,
      },
    });

    return {
      success: true,
      message: 'Subscription feature updated successfully',
      data: updatedFeature,
    };
  }

  async removeFeature(id: string) {
    await this.findOneFeature(id);

    await this.prisma.subscriptionPlanFeature.deleteMany({
      where: { feature_id: id },
    });

    await this.prisma.subscriptionFeature.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Subscription feature deleted successfully',
      data: null,
    };
  }

  // ==========================================
  // USER SUBSCRIPTIONS CRUD
  // ==========================================

  async createUserSubscription(dto: CreateUserSubscriptionDto) {
    // Check if user and plan exist
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.plan_id },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.user_id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscription = await this.prisma.userSubscription.create({
      data: dto,
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
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
    });

    const formattedSub = {
      ...subscription,
      plan: subscription.plan
        ? {
            ...subscription.plan,
            price: Number(subscription.plan.price),
          }
        : null,
    };

    return {
      success: true,
      message: 'User subscription created successfully',
      data: formattedSub,
    };
  }

  async findAllUserSubscriptions() {
    const subscriptions = await this.prisma.userSubscription.findMany({
      orderBy: { created_at: 'desc' },
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
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
    });

    const formattedSubs = subscriptions.map((sub) => ({
      ...sub,
      plan: sub.plan
        ? {
            ...sub.plan,
            price: Number(sub.plan.price),
          }
        : null,
    }));

    return {
      success: true,
      message: 'User subscriptions retrieved successfully',
      data: formattedSubs,
    };
  }

  async findOneUserSubscription(id: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { id },
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
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('User subscription not found');
    }

    const formattedSub = {
      ...subscription,
      plan: subscription.plan
        ? {
            ...subscription.plan,
            price: Number(subscription.plan.price),
          }
        : null,
    };

    return {
      success: true,
      message: 'User subscription details retrieved successfully',
      data: formattedSub,
    };
  }

  async updateUserSubscription(id: string, dto: UpdateUserSubscriptionDto) {
    await this.findOneUserSubscription(id);

    const updated = await this.prisma.userSubscription.update({
      where: { id },
      data: dto,
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
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
    });

    const formattedSub = {
      ...updated,
      plan: updated.plan
        ? {
            ...updated.plan,
            price: Number(updated.plan.price),
          }
        : null,
    };

    return {
      success: true,
      message: 'User subscription updated successfully',
      data: formattedSub,
    };
  }

  async removeUserSubscription(id: string) {
    await this.findOneUserSubscription(id);

    await this.prisma.userSubscription.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'User subscription deleted successfully',
      data: null,
    };
  }
}
