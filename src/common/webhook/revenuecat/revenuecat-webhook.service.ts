import { Injectable, Logger } from '@nestjs/common';

export interface RevenueCatEvent {
  api_version: string;
  event: {
    id: string;
    type: string;
    product_id: string;
    purchase_date: string;
    expiration_date?: string;
    app_user_id: string;
    transaction_id: string;
    original_transaction_id: string;
    store: string;
    environment: string;
    auto_renew: boolean;
    price_in_purchased_currency?: number;
    currency?: string;
    subscriber_attributes?: {
      [key: string]: {
        value: string;
        updated_at_ms: number;
      };
    };
    entitlement_id?: string;
    period_type?: string;
    is_trial_conversion?: boolean;
    offer_code?: string;
  };
  webhook_id: string;
}

@Injectable()
export class RevenueCatWebhookService {
  private readonly logger = new Logger(RevenueCatWebhookService.name);

  async processWebhook(event: RevenueCatEvent): Promise<void> {
    try {
      const { event: eventData } = event;
      const eventType = eventData.type;

      // Console log with colors for better visibility
      console.log('\n' + '='.repeat(80));
      console.log(`🔄 REVENUECAT WEBHOOK EVENT: ${eventType}`);
      console.log('='.repeat(80));

      // Log event details
      console.log(`📋 Event ID: ${eventData.id}`);
      console.log(`👤 App User ID: ${eventData.app_user_id}`);
      console.log(`📦 Product ID: ${eventData.product_id}`);
      console.log(
        `💰 Price: ${eventData.price_in_purchased_currency || 'N/A'} ${eventData.currency || ''}`,
      );
      console.log(`🏪 Store: ${eventData.store}`);
      console.log(`🌍 Environment: ${eventData.environment}`);
      console.log(`🔄 Auto Renew: ${eventData.auto_renew}`);
      console.log(`📅 Purchase Date: ${eventData.purchase_date}`);
      console.log(`⏰ Expiration Date: ${eventData.expiration_date || 'N/A'}`);
      console.log(`🔑 Transaction ID: ${eventData.transaction_id}`);
      console.log(
        `📎 Original Transaction ID: ${eventData.original_transaction_id}`,
      );
      console.log(`🎯 Entitlement ID: ${eventData.entitlement_id || 'N/A'}`);
      console.log(`📊 Period Type: ${eventData.period_type || 'N/A'}`);
      console.log(
        `🔄 Trial Conversion: ${eventData.is_trial_conversion || false}`,
      );
      console.log(`🎫 Offer Code: ${eventData.offer_code || 'N/A'}`);

      // Log subscriber attributes if present
      if (
        eventData.subscriber_attributes &&
        Object.keys(eventData.subscriber_attributes).length > 0
      ) {
        console.log('\n📝 Subscriber Attributes:');
        Object.entries(eventData.subscriber_attributes).forEach(
          ([key, value]) => {
            console.log(
              `  - ${key}: ${value.value} (updated: ${new Date(value.updated_at_ms).toISOString()})`,
            );
          },
        );
      }

      // Handle different event types with specific logging
      console.log('\n📌 Event Specific Details:');
      switch (eventType) {
        case 'INITIAL_PURCHASE':
          console.log('💳 New subscription purchase detected!');
          break;
        case 'RENEWAL':
          console.log('🔄 Subscription renewed successfully!');
          break;
        case 'CANCELLATION':
          console.log('❌ Subscription cancelled!');
          break;
        case 'EXPIRATION':
          console.log('⏰ Subscription expired!');
          break;
        case 'REFUND':
          console.log('💰 Refund processed!');
          break;
        case 'NON_RENEWING_PURCHASE':
          console.log('🛒 One-time purchase detected!');
          break;
        case 'PRODUCT_CHANGE':
          console.log('🔄 Product changed!');
          break;
        case 'SUBSCRIBED':
          console.log('✅ User subscribed!');
          break;
        case 'UNSUBSCRIBE':
          console.log('👋 User unsubscribed!');
          break;
        case 'BILLING_ISSUE':
          console.log('⚠️ Billing issue detected!');
          break;
        default:
          console.log(`ℹ️ Unhandled event type: ${eventType}`);
      }

      // Log webhook metadata
      console.log('\n🔗 Webhook Metadata:');
      console.log(`  API Version: ${event.api_version}`);
      console.log(`  Webhook ID: ${event.webhook_id}`);

      console.log('\n' + '='.repeat(80));
      console.log('✅ Webhook processing completed (console logging only)');
      console.log('='.repeat(80) + '\n');

      this.logger.log(
        `Processed ${eventType} event for user ${eventData.app_user_id}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Error processing RevenueCat webhook: ${error.message}`,
      );
      console.error('❌ Error processing webhook:', error);
      throw error;
    }
  }

  // Helper method to log event summary
  logEventSummary(event: RevenueCatEvent): void {
    const { event: eventData } = event;
    console.log(
      `📊 Summary: ${eventData.type} | User: ${eventData.app_user_id} | Product: ${eventData.product_id} | Store: ${eventData.store}`,
    );
  }

  // Method to validate webhook signature (optional)
  async validateSignature(signature: string, body: any): Promise<boolean> {
    // For now, return true (skip validation)
    console.log('🔐 Signature validation skipped (development mode)');
    return true;
  }
}
