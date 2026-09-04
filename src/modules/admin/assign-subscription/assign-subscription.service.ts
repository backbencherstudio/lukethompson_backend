// assign-subscription.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BillingCycle,
  ExtendSubscriptionDto,
  GrantSubscriptionDto,
  QuerySubscriptionDto,
  RevokeSubscriptionDto,
  REVENUECAT_ENTITLEMENTS,
} from './dto/assign-subscription.dto';
import { RevenueCatService } from 'src/common/webhook/revenuecat/revenuecat.service';

@Injectable()
export class AssignSubscriptionService {
  constructor(
    private prisma: PrismaService,
    private revenueCatService: RevenueCatService,
  ) {}

  /**
   * Grant subscription to user (via RevenueCat)
   */
  async grantSubscription(grantDto: GrantSubscriptionDto) {
    const { userId, entitlementId, duration, customEndDate, notes } = grantDto;

    // 1. Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Format entitlement ID to match RevenueCat exactly
    const formattedEntitlementId = this.formatEntitlementId(entitlementId);
    console.log(
      `Granting entitlement: "${formattedEntitlementId}" (original: "${entitlementId}")`,
    );

    // 2. Create RevenueCat customer if doesn't exist
    try {
      await this.revenueCatService.createCustomer({
        userId: user.id,
        email: user.email || undefined,
        name: user.name || undefined,
      });
    } catch (error: any) {
      console.error('Failed to create RevenueCat customer:', error.message);
      throw new InternalServerErrorException(
        `Failed to create RevenueCat customer: ${error.message}`,
      );
    }

    // 3. Grant entitlement in RevenueCat
    let revenueCatResult;
    try {
      const mappedDuration = this.mapDuration(duration || BillingCycle.MONTHLY);

      if (duration === BillingCycle.CUSTOM && customEndDate) {
        const endDate = new Date(customEndDate);
        if (isNaN(endDate.getTime())) {
          throw new BadRequestException('Invalid custom end date');
        }
        revenueCatResult = await this.revenueCatService.grantEntitlement(
          userId,
          formattedEntitlementId,
          mappedDuration,
          new Date(),
          endDate,
        );
      } else {
        revenueCatResult = await this.revenueCatService.grantEntitlement(
          userId,
          formattedEntitlementId,
          mappedDuration,
        );
      }
    } catch (error: any) {
      console.error('RevenueCat grant failed:', error.message);
      throw new InternalServerErrorException(
        `Failed to grant entitlement in RevenueCat: ${error.message}`,
      );
    }

    // 4. Find or create subscription plan in local DB
    let plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: formattedEntitlementId },
    });

    if (!plan) {
      plan = await this.prisma.subscriptionPlan.create({
        data: {
          name: formattedEntitlementId,
          description: `${formattedEntitlementId} subscription plan`,
          price: 0,
          currency: 'USD',
          interval: 'MONTHLY',
          status: 'ACTIVE',
        },
      });
    }

    // 5. Calculate expiry date
    let expiryDate: Date;
    if (duration === BillingCycle.CUSTOM && customEndDate) {
      expiryDate = new Date(customEndDate);
    } else {
      expiryDate = this.calculateExpiryDate(duration || BillingCycle.MONTHLY);
    }

    // 6. Create subscription in local database
    const subscription = await this.prisma.userSubscription.create({
      data: {
        user_id: userId,
        plan_id: plan.id,
        status: 'ACTIVE',
        started_at: new Date(),
        expires_at: expiryDate,
        purchase_provider: 'revenuecat',
        purchase_id: `rc_${Date.now()}`,
      },
    });

    // 7. Update user's active entitlements cache
    await this.updateUserEntitlementsCache(userId);

    return {
      success: true,
      message: 'Subscription granted successfully via RevenueCat',
      data: {
        userId,
        entitlementId: formattedEntitlementId,
        duration: duration || BillingCycle.MONTHLY,
        startDate: subscription.started_at.toISOString(),
        endDate: subscription.expires_at?.toISOString(),
        status: subscription.status,
        subscriptionId: subscription.id,
        revenueCat: revenueCatResult.subscriber,
      },
    };
  }

  /**
   * Revoke subscription from user (via RevenueCat)
   */
  async revokeSubscription(revokeDto: RevokeSubscriptionDto) {
    const { userId, entitlementId, reason } = revokeDto;

    // 1. Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Format entitlement ID to match RevenueCat exactly
    const formattedEntitlementId = this.formatEntitlementId(entitlementId);
    console.log(
      `Revoking entitlement: "${formattedEntitlementId}" (original: "${entitlementId}")`,
    );

    // 2. Revoke entitlement in RevenueCat
    let revenueCatResult;
    try {
      revenueCatResult = await this.revenueCatService.revokeEntitlement(
        userId,
        formattedEntitlementId,
      );
    } catch (error: any) {
      console.error('RevenueCat revoke failed:', error.message);
      throw new InternalServerErrorException(
        `Failed to revoke entitlement in RevenueCat: ${error.message}`,
      );
    }

    // 3. Update local database
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: formattedEntitlementId },
    });

    if (plan) {
      const subscription = await this.prisma.userSubscription.findFirst({
        where: {
          user_id: userId,
          plan_id: plan.id,
          status: 'ACTIVE',
        },
      });

      if (subscription) {
        await this.prisma.userSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELED',
            canceled_at: new Date(),
            expires_at: new Date(),
          },
        });
      }
    }

    // 4. Update user's active entitlements cache
    await this.updateUserEntitlementsCache(userId);

    return {
      success: true,
      message: 'Subscription revoked successfully via RevenueCat',
      data: {
        userId,
        entitlementId: formattedEntitlementId,
        revokedAt: new Date().toISOString(),
        reason,
        revenueCat: revenueCatResult.subscriber,
      },
    };
  }

  /**
   * Extend user subscription (via RevenueCat)
   */
  async extendSubscription(extendDto: ExtendSubscriptionDto) {
    const { userId, entitlementId, extensionDays, reason } = extendDto;

    // 1. Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Format entitlement ID to match RevenueCat exactly
    const formattedEntitlementId = this.formatEntitlementId(entitlementId);
    console.log(
      `Extending entitlement: "${formattedEntitlementId}" (original: "${entitlementId}")`,
    );

    // 2. Get current subscription to get expiry date
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: formattedEntitlementId },
    });

    let currentExpiry = new Date();
    if (plan) {
      const subscription = await this.prisma.userSubscription.findFirst({
        where: {
          user_id: userId,
          plan_id: plan.id,
          status: 'ACTIVE',
        },
      });
      if (subscription?.expires_at) {
        currentExpiry = subscription.expires_at;
      }
    }

    // 3. Calculate new expiry date
    const newExpiryDate = new Date(currentExpiry);
    newExpiryDate.setDate(newExpiryDate.getDate() + extensionDays);

    // 4. Extend in RevenueCat
    let revenueCatResult;
    try {
      revenueCatResult = await this.revenueCatService.grantEntitlement(
        userId,
        formattedEntitlementId,
        BillingCycle.MONTHLY,
        new Date(),
        newExpiryDate,
      );
    } catch (error: any) {
      console.error('RevenueCat extension failed:', error.message);
      throw new InternalServerErrorException(
        `Failed to extend entitlement in RevenueCat: ${error.message}`,
      );
    }

    // 5. Update local database
    if (plan) {
      const subscription = await this.prisma.userSubscription.findFirst({
        where: {
          user_id: userId,
          plan_id: plan.id,
          status: 'ACTIVE',
        },
      });

      if (subscription) {
        await this.prisma.userSubscription.update({
          where: { id: subscription.id },
          data: {
            expires_at: newExpiryDate,
          },
        });
      }
    }

    // 6. Update user's active entitlements cache
    await this.updateUserEntitlementsCache(userId);

    return {
      success: true,
      message: `Subscription extended by ${extensionDays} days via RevenueCat`,
      data: {
        userId,
        entitlementId: formattedEntitlementId,
        extensionDays,
        oldEndDate: currentExpiry.toISOString(),
        newEndDate: newExpiryDate.toISOString(),
        reason,
        revenueCat: revenueCatResult.subscriber,
      },
    };
  }

  /**
   * Find all subscriptions (from RevenueCat)
   */
  async findAll(query: QuerySubscriptionDto) {
    const {
      status,
      userId,
      entitlementId,
      search,
      limit = 20,
      offset = 0,
    } = query;

    try {
      const result = await this.revenueCatService.getAllCustomers(
        limit + offset,
        offset,
        { search, status },
      );

      let customers = result?.customers || [];

      if (userId) {
        customers = customers.filter((c: any) => c.id === userId);
      }

      if (entitlementId) {
        const formattedEntitlementId = this.formatEntitlementId(entitlementId);
        const filteredCustomers = [];
        for (const customer of customers) {
          try {
            const details =
              await this.revenueCatService.getUserSubscriptionDetails(
                customer.id,
              );
            if (
              details.entitlements &&
              details.entitlements[formattedEntitlementId]
            ) {
              filteredCustomers.push(customer);
            }
          } catch (error) {
            console.error(
              `Failed to get details for customer ${customer.id}:`,
              error,
            );
          }
        }
        customers = filteredCustomers;
      }

      const transformedData = customers.map((customer: any) => ({
        id: customer.id,
        userId: customer.id,
        email: customer.attributes?.$email?.value || '',
        name: customer.attributes?.$displayName?.value || '',
        entitlements: customer.entitlements || {},
        subscription_customer_id: customer.id,
        createdAt: customer.created_at,
        status: customer.status,
      }));

      return {
        success: true,
        message: 'Subscriptions retrieved successfully from RevenueCat',
        data: transformedData,
        pagination: {
          total: customers.length,
          limit,
          offset,
          hasMore: offset + limit < customers.length,
        },
      };
    } catch (error: any) {
      console.error('Failed to fetch from RevenueCat:', error.message);
      throw new InternalServerErrorException(
        `Failed to fetch subscriptions from RevenueCat: ${error.message}`,
      );
    }
  }

  /**
   * ✅ FIXED: Find one subscription by ID (using V1 API)
   * The V1 API returns a complete subscriber object with all entitlements
   */
  async findOne(id: string) {
    try {
      // Use V1 API (getCustomer) instead of V2
      const response = await this.revenueCatService.getCustomer(id);
      const subscriber = response.subscriber;

      if (!subscriber) {
        throw new NotFoundException(
          `Subscription ${id} not found in RevenueCat`,
        );
      }

      return {
        success: true,
        message: 'Subscription retrieved successfully from RevenueCat',
        data: {
          id: subscriber.original_app_user_id,
          userId: subscriber.original_app_user_id,
          // ✅ Correctly map the $email and $displayName values
          email: subscriber.subscriber_attributes?.$email?.value || '',
          name: subscriber.subscriber_attributes?.$displayName?.value || '',
          entitlements: subscriber.entitlements || {},
          subscriptions: subscriber.subscriptions || {},
          non_subscriptions: subscriber.non_subscriptions || {},
          subscription_customer_id: subscriber.original_app_user_id,
          createdAt: subscriber.first_seen,
          lastSeen: subscriber.last_seen,
          managementUrl: subscriber.management_url,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        'Failed to fetch subscription from RevenueCat:',
        error.message,
      );
      throw new InternalServerErrorException(
        `Failed to fetch subscription from RevenueCat: ${error.message}`,
      );
    }
  }

  /**
   * Get all subscriptions for a user (from RevenueCat)
   */
  async getUserSubscriptions(userId: string) {
    try {
      const details =
        await this.revenueCatService.getUserSubscriptionDetails(userId);
      const subscriptions =
        await this.revenueCatService.getActiveSubscriptions(userId);

      return {
        success: true,
        message: 'User subscriptions retrieved successfully from RevenueCat',
        data: {
          user: {
            id: details.id,
            email: details.email || '',
            name: details.name || '',
          },
          subscriptions: subscriptions,
          total: subscriptions.length,
          active: subscriptions.filter((s: any) => s.is_active).length,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        'Failed to fetch user subscriptions from RevenueCat:',
        error.message,
      );
      throw new InternalServerErrorException(
        `Failed to fetch user subscriptions from RevenueCat: ${error.message}`,
      );
    }
  }

  /**
   * Get subscription history for a user (from RevenueCat)
   */
  async getSubscriptionHistory(userId: string) {
    try {
      const history =
        await this.revenueCatService.getTransactionHistory(userId);
      return {
        success: true,
        message: 'Subscription history retrieved successfully',
        data: history.transactions || [],
      };
    } catch (error: any) {
      console.error('Failed to fetch subscription history:', error.message);
      throw new InternalServerErrorException(
        `Failed to fetch subscription history: ${error.message}`,
      );
    }
  }

  /**
   * Check if user has active subscription (from RevenueCat)
   */
  async checkUserSubscription(userId: string, entitlementId: string) {
    try {
      const formattedEntitlementId = this.formatEntitlementId(entitlementId);
      const isActive = await this.revenueCatService.hasActiveEntitlement(
        userId,
        formattedEntitlementId,
      );

      return {
        success: true,
        message: 'Subscription status retrieved from RevenueCat',
        data: {
          userId,
          entitlementId: formattedEntitlementId,
          hasActiveSubscription: isActive,
        },
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error(
        'Failed to check subscription from RevenueCat:',
        error.message,
      );
      throw new InternalServerErrorException(
        `Failed to check subscription from RevenueCat: ${error.message}`,
      );
    }
  }

  /**
   * Get available entitlements (from RevenueCat)
   */
  async getAvailableEntitlements() {
    try {
      const entitlements =
        await this.revenueCatService.getAvailableEntitlements();

      return {
        success: true,
        message: 'Entitlements retrieved successfully',
        data: entitlements,
      };
    } catch (error: any) {
      console.error('Failed to get entitlements:', error.message);
      return {
        success: true,
        message: 'Entitlements retrieved successfully (fallback)',
        data: [
          {
            id: REVENUECAT_ENTITLEMENTS.PRO,
            name: 'GetDockPay Pro',
            description: 'Pro subscription with all features',
            durations: ['monthly', 'yearly', 'lifetime', 'custom'],
            isActive: true,
          },
          {
            id: REVENUECAT_ENTITLEMENTS.PREMIUM,
            name: 'GetDockPay Premium',
            description: 'Premium subscription with advanced features',
            durations: ['monthly', 'yearly', 'lifetime', 'custom'],
            isActive: true,
          },
        ],
      };
    }
  }

  /**
   * Format entitlement ID to match RevenueCat exactly
   */
  private formatEntitlementId(entitlementId: string): string {
    if (!entitlementId) return entitlementId;

    const entitlementMap: Record<string, string> = {
      GetDockPayPro: REVENUECAT_ENTITLEMENTS.PRO,
      'GetDockPayPro ': REVENUECAT_ENTITLEMENTS.PRO,
      ' getdockpaypro': REVENUECAT_ENTITLEMENTS.PRO,
      getdockpaypro: REVENUECAT_ENTITLEMENTS.PRO,
      GETDOCKPAYPRO: REVENUECAT_ENTITLEMENTS.PRO,
      GETDOCKPAY_PRO: REVENUECAT_ENTITLEMENTS.PRO,
      getdockpay_pro: REVENUECAT_ENTITLEMENTS.PRO,
      GetDockPayPremium: REVENUECAT_ENTITLEMENTS.PREMIUM,
      getdockpaypremium: REVENUECAT_ENTITLEMENTS.PREMIUM,
      GETDOCKPAYPREMIUM: REVENUECAT_ENTITLEMENTS.PREMIUM,
      GETDOCKPAY_PREMIUM: REVENUECAT_ENTITLEMENTS.PREMIUM,
      getdockpay_premium: REVENUECAT_ENTITLEMENTS.PREMIUM,
    };

    if (entitlementMap[entitlementId]) {
      return entitlementMap[entitlementId];
    }

    if (
      entitlementId === REVENUECAT_ENTITLEMENTS.PRO ||
      entitlementId === REVENUECAT_ENTITLEMENTS.PREMIUM
    ) {
      return entitlementId;
    }

    if (entitlementId.includes('DockPay') && entitlementId.includes('Pro')) {
      return REVENUECAT_ENTITLEMENTS.PRO;
    }
    if (
      entitlementId.includes('DockPay') &&
      entitlementId.includes('Premium')
    ) {
      return REVENUECAT_ENTITLEMENTS.PREMIUM;
    }

    console.warn(`Unknown entitlement ID: "${entitlementId}". Using as-is.`);
    return entitlementId;
  }

  /**
   * Helper: Calculate expiry date based on duration
   */
  private calculateExpiryDate(duration: BillingCycle): Date {
    const now = new Date();
    switch (duration) {
      case BillingCycle.MONTHLY:
        return new Date(now.setMonth(now.getMonth() + 1));
      case BillingCycle.YEARLY:
        return new Date(now.setFullYear(now.getFullYear() + 1));
      case BillingCycle.LIFETIME:
        return new Date('2099-12-31T23:59:59Z');
      case BillingCycle.CUSTOM:
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return new Date(now.setMonth(now.getMonth() + 1));
    }
  }

  /**
   * Helper: Map duration to RevenueCat format
   */
  private mapDuration(duration: BillingCycle): BillingCycle {
    const durationMap: Record<string, BillingCycle> = {
      MONTHLY: BillingCycle.MONTHLY,
      YEARLY: BillingCycle.YEARLY,
      LIFETIME: BillingCycle.LIFETIME,
      CUSTOM: BillingCycle.CUSTOM,
    };
    return durationMap[duration] || BillingCycle.MONTHLY;
  }

  /**
   * Helper: Update user's active entitlements cache
   */
  private async updateUserEntitlementsCache(userId: string) {
    try {
      const details =
        await this.revenueCatService.getUserSubscriptionDetails(userId);
      const activeEntitlements: Record<string, any> = {};

      for (const [key, entitlement] of Object.entries(
        details.entitlements || {},
      )) {
        const ent: any = entitlement;
        let isActive = false;
        if (ent.expires_date) {
          isActive = new Date(ent.expires_date) > new Date();
        } else if (ent.is_active) {
          isActive = true;
        }

        if (isActive) {
          activeEntitlements[key] = {
            expires_date: ent.expires_date || null,
            purchase_date: ent.purchase_date || null,
            is_trial_period: ent.is_trial_period || false,
          };
        }
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          active_entitlements: activeEntitlements,
        },
      });
    } catch (error) {
      console.error('Failed to update user entitlements cache:', error);
    }
  }
}
