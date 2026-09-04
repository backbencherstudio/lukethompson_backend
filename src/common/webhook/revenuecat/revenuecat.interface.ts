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
