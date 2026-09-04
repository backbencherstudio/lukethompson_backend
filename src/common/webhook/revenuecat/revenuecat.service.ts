// revenuecat.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import appConfig from 'src/config/app.config';
import { BillingCycle } from 'src/modules/admin/assign-subscription/dto/assign-subscription.dto';

export interface CreateCustomerDto {
  userId: string;
  email?: string;
  name?: string;
  attributes?: Record<string, any>;
}

export interface ManageEntitlementDto {
  grant: boolean;
  entitlementIdentifier: string;
  duration?: BillingCycle;
  startDate?: Date;
  endDate?: Date;
}

export interface SubscriptionStatusResponse {
  subscriber: {
    id: string;
    entitlements: Record<string, any>;
    subscriptions: Record<string, any>;
    non_subscriptions: Record<string, any>;
    original_app_user_id: string;
    original_application_id: string;
    first_seen: string;
    last_seen: string;
    management_url: string;
  };
}

@Injectable()
export class RevenueCatService {
  private readonly v1ApiKey: string;
  private readonly v2ApiKey: string;
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly v2BaseUrl: string;

  constructor() {
    const config = appConfig().payment.reveneuecat;

    this.v1ApiKey = config.v1_api_key;
    this.v2ApiKey = config.v2_api_key;
    this.projectId = config.project_id;
    this.baseUrl = 'https://api.revenuecat.com/v1';
    this.v2BaseUrl = 'https://api.revenuecat.com/v2';

    console.log('RevenueCat Configuration:', {
      hasV1Key: !!this.v1ApiKey,
      v1KeyPrefix: this.v1ApiKey
        ? this.v1ApiKey.substring(0, 8) + '...'
        : 'not set',
      hasV2Key: !!this.v2ApiKey,
      v2KeyPrefix: this.v2ApiKey
        ? this.v2ApiKey.substring(0, 8) + '...'
        : 'not set',
      projectId: this.projectId || 'not set',
    });
  }

  private get v1AuthHeaders() {
    if (!this.v1ApiKey) {
      throw new UnauthorizedException(
        'RevenueCat V1 API key is not configured. Please set REVENUECAT_API_KEY_V1 in your environment variables.',
      );
    }
    return {
      Authorization: `Bearer ${this.v1ApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private get v2AuthHeaders() {
    if (!this.v2ApiKey) {
      throw new UnauthorizedException(
        'RevenueCat V2 API key is not configured. Please set REVENUECAT_API_KEY_V2 in your environment variables.',
      );
    }
    return {
      Authorization: `Bearer ${this.v2ApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private handleApiError(error: any, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;

      console.error(`RevenueCat API Error (${context}):`, {
        status,
        data,
        message: axiosError.message,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
      });

      if (status === 401) {
        throw new UnauthorizedException(
          `Invalid RevenueCat API key. Error: ${data?.message || 'Authentication failed'}`,
        );
      }

      if (status === 403) {
        throw new ForbiddenException(
          `RevenueCat API key does not have permission. Error: ${data?.message || 'Forbidden'}`,
        );
      }

      if (status === 404) {
        throw new NotFoundException(
          `Resource not found: ${data?.message || 'Unknown resource'}`,
        );
      }

      if (status === 400) {
        throw new BadRequestException(
          `Invalid request: ${data?.message || 'Invalid request'}`,
        );
      }

      if (status === 429) {
        throw new InternalServerErrorException(
          'RevenueCat rate limit exceeded. Please try again later.',
        );
      }

      throw new InternalServerErrorException(
        `RevenueCat error: ${data?.message || axiosError.message}`,
      );
    }

    throw new InternalServerErrorException(
      `Failed to ${context}: ${error.message || 'Unknown error'}`,
    );
  }

  /**
   * ==========================================
   * 1. CUSTOMER MANAGEMENT (V1 API)
   * ==========================================
   */

  async createCustomer(params: CreateCustomerDto): Promise<string> {
    const { userId, email, name, attributes = {} } = params;
    const encodedId = encodeURIComponent(userId);

    try {
      await this.getCustomer(userId);

      if (email || name || Object.keys(attributes).length > 0) {
        await this.updateCustomerAttributes(userId, {
          ...(email && { $email: { value: email } }),
          ...(name && { $displayName: { value: name } }),
          ...attributes,
        });
      }

      console.log(`RevenueCat customer verified (V1): ${userId}`);
      return userId;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        try {
          const attr: Record<string, any> = {};
          if (email) attr.$email = { value: email };
          if (name) attr.$displayName = { value: name };

          await axios.post(
            `${this.baseUrl}/subscribers/${encodedId}/attributes`,
            { attributes: attr },
            { headers: this.v1AuthHeaders },
          );

          console.log(`RevenueCat customer created (V1): ${userId}`);
          return userId;
        } catch (createError: any) {
          this.handleApiError(createError, 'create customer (V1)');
        }
      }

      this.handleApiError(error, 'verify customer (V1)');
    }
  }

  async getCustomer(userId: string): Promise<any> {
    const encodedId = encodeURIComponent(userId);
    try {
      const response = await axios.get(
        `${this.baseUrl}/subscribers/${encodedId}`,
        { headers: this.v1AuthHeaders },
      );
      return response.data;
    } catch (error: any) {
      this.handleApiError(error, 'get customer (V1)');
    }
  }

  async updateCustomerAttributes(
    userId: string,
    attributes: Record<string, { value: any }>,
  ): Promise<void> {
    const encodedId = encodeURIComponent(userId);
    try {
      await axios.post(
        `${this.baseUrl}/subscribers/${encodedId}/attributes`,
        { attributes },
        { headers: this.v1AuthHeaders },
      );
    } catch (error: any) {
      this.handleApiError(error, 'update customer attributes (V1)');
    }
  }

  /**
   * ==========================================
   * 2. CUSTOMER MANAGEMENT (V2 API)
   * ==========================================
   */

  async getAllCustomers(
    limit: number = 20,
    offset: number = 0,
    filters?: {
      search?: string;
      status?: string;
      subscriptionStatus?: string;
    },
  ): Promise<any> {
    try {
      let url = `${this.v2BaseUrl}/projects/${this.projectId}/customers?limit=${limit}&offset=${offset}`;

      if (filters?.search) {
        url += `&search=${encodeURIComponent(filters.search)}`;
      }
      if (filters?.status) {
        url += `&status=${filters.status}`;
      }
      if (filters?.subscriptionStatus) {
        url += `&subscription_status=${filters.subscriptionStatus}`;
      }

      console.log(`Fetching customers (V2): ${url}`);

      const response = await axios.get(url, {
        headers: this.v2AuthHeaders,
      });

      console.log(
        `Successfully fetched ${response.data?.customers?.length || 0} customers (V2)`,
      );
      return response.data;
    } catch (error: any) {
      this.handleApiError(error, 'fetch customers (V2)');
    }
  }

  async getCustomerV2(userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.v2BaseUrl}/projects/${this.projectId}/customers/${encodeURIComponent(userId)}`,
        { headers: this.v2AuthHeaders },
      );
      return response.data;
    } catch (error: any) {
      this.handleApiError(error, 'get customer (V2)');
    }
  }

  /**
   * ==========================================
   * 3. ENTITLEMENT MANAGEMENT (V1 API)
   * ==========================================
   */

  async grantEntitlement(
    userId: string,
    entitlementIdentifier: string,
    duration: BillingCycle = BillingCycle.MONTHLY,
    startDate?: Date,
    endDate?: Date,
  ): Promise<SubscriptionStatusResponse> {
    const encodedUserId = encodeURIComponent(userId);
    const encodedEntitlement = encodeURIComponent(entitlementIdentifier);

    try {
      await this.getCustomer(userId);

      // ✅ CORRECT ENDPOINT: '/promotional' (not '/promotions')
      const endpoint = `${this.baseUrl}/subscribers/${encodedUserId}/entitlements/${encodedEntitlement}/promotional`;
      const rcDuration = this.mapToRevenueCatDuration(duration);
      const payload: any = { duration: rcDuration };

      if (startDate) {
        payload.start_date = startDate.toISOString();
      }
      if (endDate) {
        payload.end_date = endDate.toISOString();
      }

      console.log(`Granting entitlement (V1): ${endpoint}`);
      console.log('Payload:', payload);
      console.log(`Entitlement ID: "${entitlementIdentifier}"`);

      const response = await axios.post(endpoint, payload, {
        headers: this.v1AuthHeaders,
      });

      return {
        subscriber: response.data.subscriber,
      };
    } catch (error: any) {
      this.handleApiError(error, 'grant entitlement (V1)');
    }
  }

  async revokeEntitlement(
    userId: string,
    entitlementIdentifier: string,
  ): Promise<SubscriptionStatusResponse> {
    const encodedUserId = encodeURIComponent(userId);
    const encodedEntitlement = encodeURIComponent(entitlementIdentifier);

    try {
      await this.getCustomer(userId);

      // ✅ CORRECT ENDPOINT: '/promotional' (not '/promotions')
      const endpoint = `${this.baseUrl}/subscribers/${encodedUserId}/entitlements/${encodedEntitlement}/promotional`;

      console.log(`Revoking entitlement (V1): ${endpoint}`);
      console.log(`Entitlement ID: "${entitlementIdentifier}"`);

      const response = await axios.post(
        endpoint,
        { duration: 'daily' },
        { headers: this.v1AuthHeaders },
      );

      return {
        subscriber: response.data.subscriber,
      };
    } catch (error: any) {
      this.handleApiError(error, 'revoke entitlement (V1)');
    }
  }

  async manageEntitlement(
    userId: string,
    dto: ManageEntitlementDto,
  ): Promise<SubscriptionStatusResponse> {
    const { grant, entitlementIdentifier, duration, startDate, endDate } = dto;

    if (grant) {
      return this.grantEntitlement(
        userId,
        entitlementIdentifier,
        duration,
        startDate,
        endDate,
      );
    } else {
      return this.revokeEntitlement(userId, entitlementIdentifier);
    }
  }

  private mapToRevenueCatDuration(duration: BillingCycle): string {
    const durationMap: Record<BillingCycle, string> = {
      [BillingCycle.MONTHLY]: 'monthly',
      [BillingCycle.YEARLY]: 'yearly',
      [BillingCycle.LIFETIME]: 'lifetime',
      [BillingCycle.CUSTOM]: 'monthly',
      [BillingCycle.DAILY]: 'daily',
    };
    return durationMap[duration] || 'monthly';
  }

  /**
   * ==========================================
   * 4. SUBSCRIPTION MANAGEMENT (V1 API)
   * ==========================================
   */

  async getSubscriberEntitlements(userId: string): Promise<any> {
    try {
      const response = await this.getCustomer(userId);
      return response.subscriber?.entitlements || {};
    } catch (error: any) {
      this.handleApiError(error, 'get subscriber entitlements (V1)');
    }
  }

  async hasActiveEntitlement(
    userId: string,
    entitlementId: string,
  ): Promise<boolean> {
    try {
      const entitlements = await this.getSubscriberEntitlements(userId);
      const entitlement = entitlements[entitlementId];

      if (!entitlement) return false;

      if (entitlement.expires_date) {
        return new Date(entitlement.expires_date) > new Date();
      }

      return entitlement.is_active || false;
    } catch (error) {
      console.error('Failed to check entitlement:', error);
      return false;
    }
  }

  async getUserSubscriptionDetails(userId: string): Promise<any> {
    try {
      const response = await this.getCustomer(userId);
      const subscriber = response.subscriber;

      return {
        id: subscriber.original_app_user_id,
        entitlements: subscriber.entitlements || {},
        subscriptions: subscriber.subscriptions || {},
        nonSubscriptions: subscriber.non_subscriptions || {},
        managementUrl: subscriber.management_url,
        firstSeen: subscriber.first_seen,
        lastSeen: subscriber.last_seen,
      };
    } catch (error: any) {
      this.handleApiError(error, 'get subscription details (V1)');
    }
  }

  async getActiveSubscriptions(userId: string): Promise<any[]> {
    try {
      const details = await this.getUserSubscriptionDetails(userId);
      const activeSubscriptions: any[] = [];

      for (const [key, subscription] of Object.entries(
        details.subscriptions || {},
      )) {
        const sub: any = subscription;
        if (sub.expires_date && new Date(sub.expires_date) > new Date()) {
          activeSubscriptions.push({
            id: key,
            type: 'subscription',
            ...sub,
          });
        }
      }

      for (const [key, entitlement] of Object.entries(
        details.entitlements || {},
      )) {
        const ent: any = entitlement;
        if (ent.expires_date && new Date(ent.expires_date) > new Date()) {
          activeSubscriptions.push({
            id: key,
            type: 'entitlement',
            ...ent,
          });
        } else if (!ent.expires_date && ent.is_active) {
          activeSubscriptions.push({
            id: key,
            type: 'entitlement',
            isLifetime: true,
            ...ent,
          });
        }
      }

      return activeSubscriptions;
    } catch (error: any) {
      this.handleApiError(error, 'get active subscriptions (V1)');
    }
  }

  /**
   * ==========================================
   * 5. TRANSACTION MANAGEMENT (V2 API)
   * ==========================================
   */

  async getTransactionHistory(
    userId: string,
    limit: number = 50,
  ): Promise<any> {
    try {
      const response = await axios.get(
        `${this.v2BaseUrl}/projects/${this.projectId}/customers/${encodeURIComponent(userId)}/transactions?limit=${limit}`,
        { headers: this.v2AuthHeaders },
      );
      return response.data;
    } catch (error: any) {
      this.handleApiError(error, 'get transaction history (V2)');
    }
  }

  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.v2BaseUrl}/projects/${this.projectId}/transactions/${encodeURIComponent(transactionId)}`,
        { headers: this.v2AuthHeaders },
      );
      return response.data;
    } catch (error: any) {
      this.handleApiError(error, 'get transaction (V2)');
    }
  }

  /**
   * ==========================================
   * 6. WEBHOOK HANDLING
   * ==========================================
   */

  async handleWebhookEvent(payload: any): Promise<any> {
    const event = payload;
    const eventType = event.type;
    const subscriber = event.subscriber;

    console.log(
      `RevenueCat Webhook: ${eventType} for user ${subscriber?.original_app_user_id}`,
    );

    switch (eventType) {
      case 'INITIAL_PURCHASE':
        return await this.handleInitialPurchase(event);
      case 'RENEWAL':
        return await this.handleRenewal(event);
      case 'CANCELLATION':
        return await this.handleCancellation(event);
      case 'EXPIRATION':
        return await this.handleExpiration(event);
      case 'UNCANCELLATION':
        return await this.handleUncancellation(event);
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
        return { success: true, message: 'Event received but not processed' };
    }
  }

  private async handleInitialPurchase(event: any): Promise<any> {
    return { success: true, type: 'initial_purchase' };
  }

  private async handleRenewal(event: any): Promise<any> {
    return { success: true, type: 'renewal' };
  }

  private async handleCancellation(event: any): Promise<any> {
    return { success: true, type: 'cancellation' };
  }

  private async handleExpiration(event: any): Promise<any> {
    return { success: true, type: 'expiration' };
  }

  private async handleUncancellation(event: any): Promise<any> {
    return { success: true, type: 'uncancellation' };
  }

  /**
   * ==========================================
   * 7. UTILITY METHODS
   * ==========================================
   */

  async getAvailableEntitlements(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.v2BaseUrl}/projects/${this.projectId}/entitlements`,
        { headers: this.v2AuthHeaders },
      );
      return response.data?.entitlements || [];
    } catch (error: any) {
      console.error('Failed to get available entitlements:', error.message);
      return [
        { id: 'GetDockPay Pro', name: 'GetDockPay Pro', isActive: true },
        {
          id: 'GetDockPay Premium',
          name: 'GetDockPay Premium',
          isActive: true,
        },
      ];
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
    v1Status?: string;
    v2Status?: string;
  }> {
    const results: any = {
      success: false,
      message: '',
      details: {},
      v1Status: 'untested',
      v2Status: 'untested',
    };

    try {
      console.log('Testing RevenueCat V1 API...');
      const testUserId = 'test_user_' + Date.now();
      await axios.post(
        `${this.baseUrl}/subscribers/${encodeURIComponent(testUserId)}/attributes`,
        { attributes: { $email: { value: 'test@example.com' } } },
        { headers: this.v1AuthHeaders },
      );
      results.v1Status = 'success';
      console.log('✅ V1 API connection successful');
    } catch (error: any) {
      results.v1Status = 'failed';
      results.details.v1Error = error.message;
      console.log('❌ V1 API connection failed:', error.message);
    }

    try {
      console.log('Testing RevenueCat V2 API...');
      const response = await axios.get(
        `${this.v2BaseUrl}/projects/${this.projectId}/customers?limit=1`,
        { headers: this.v2AuthHeaders },
      );
      results.v2Status = 'success';
      results.details.hasCustomers = response.data?.customers?.length > 0;
      results.details.totalCustomers = response.data?.total || 0;
      console.log('✅ V2 API connection successful');
    } catch (error: any) {
      results.v2Status = 'failed';
      results.details.v2Error = error.message;
      console.log('❌ V2 API connection failed:', error.message);
    }

    if (results.v1Status === 'success' || results.v2Status === 'success') {
      results.success = true;
      results.message =
        'RevenueCat connection successful (at least one API version works)';
    } else {
      results.success = false;
      results.message =
        'Failed to connect to RevenueCat with either API version';
    }

    return results;
  }
}
