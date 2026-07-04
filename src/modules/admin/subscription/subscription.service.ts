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
      message: 'Subscription plan created successfully',
      data: plan,
    };
  }

  async findAllPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { sort_order: 'asc' },
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

  async findOnePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return {
      success: true,
      data: plan,
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
      message: 'Subscription plan updated successfully',
      data: updatedPlan,
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
    };
  }

  // ==========================================
  // FEATURE CRUD
  // ==========================================

  async createFeature(dto: CreateSubscriptionFeatureDto) {
    const feature = await this.prisma.subscriptionFeature.create({
      data: dto,
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
    });

    return {
      success: true,
      data: features,
    };
  }

  async findOneFeature(id: string) {
    const feature = await this.prisma.subscriptionFeature.findUnique({
      where: { id },
    });

    if (!feature) {
      throw new NotFoundException('Subscription feature not found');
    }

    return {
      success: true,
      data: feature,
    };
  }

  async updateFeature(id: string, dto: UpdateSubscriptionFeatureDto) {
    await this.findOneFeature(id);

    const updatedFeature = await this.prisma.subscriptionFeature.update({
      where: { id },
      data: dto,
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
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            type: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'User subscription created successfully',
      data: subscription,
    };
  }

  async findAllUserSubscriptions() {
    const subscriptions = await this.prisma.userSubscription.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            type: true,
          },
        },
      },
    });

    return {
      success: true,
      data: subscriptions,
    };
  }

  async findOneUserSubscription(id: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { id },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            type: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('User subscription not found');
    }

    return {
      success: true,
      data: subscription,
    };
  }

  async updateUserSubscription(id: string, dto: UpdateUserSubscriptionDto) {
    await this.findOneUserSubscription(id);

    const updated = await this.prisma.userSubscription.update({
      where: { id },
      data: dto,
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            type: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'User subscription updated successfully',
      data: updated,
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
    };
  }
}
