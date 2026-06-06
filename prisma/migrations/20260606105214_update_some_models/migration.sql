/*
  Warnings:

  - You are about to drop the column `spot_log_id` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the `spot_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FeatureValueType" AS ENUM ('BOOLEAN', 'LIMIT', 'METERED');

-- CreateEnum
CREATE TYPE "UsageResetPeriod" AS ENUM ('NEVER', 'DAILY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "StopLogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CLAIM_DRAFTED', 'CLAIM_SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DetentionRateConfirmed" AS ENUM ('YES', 'NO', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('BOL', 'RATE_CONFIRMATION', 'ELD_SCREENSHOT', 'FACILITY_STAMP_PHOTO', 'PROOF_PACKAGE', 'DEMAND_LETTER', 'BOND_CLAIM_PACKET', 'COURT_FILING_PACKET', 'COMPLETE_CASE_FILE', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FOLLOW_UP', 'IN_RECOURSE', 'PAID', 'DENIED', 'UNCOLLECTABLE', 'IN_COLLECTIONS');

-- CreateEnum
CREATE TYPE "ClaimSendMethod" AS ENUM ('EMAIL', 'SMS', 'SHARE');

-- CreateEnum
CREATE TYPE "ClaimEventType" AS ENUM ('CLAIM_SENT', 'FOLLOW_UP_SENT', 'BROKER_ESCALATION_SENT', 'DEMAND_LETTER_MAILED', 'BOND_CLAIM_FILED', 'CREDIT_REPORT_SUBMITTED', 'FMCSA_COMPLAINT_FILED', 'LOAD_BOARD_REVIEW_POSTED', 'SMALL_CLAIMS_FILED', 'COLLECTIONS_REFERRED', 'ATTORNEY_REFERRED', 'MARKED_PAID', 'MARKED_DENIED', 'MARKED_UNCOLLECTABLE');

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_spot_log_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_receiver_id_fkey";

-- DropForeignKey
ALTER TABLE "spot_logs" DROP CONSTRAINT "spot_logs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ucodes" DROP CONSTRAINT "ucodes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_payment_methods" DROP CONSTRAINT "user_payment_methods_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_setting_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_user_id_fkey";

-- AlterTable
ALTER TABLE "locations" DROP COLUMN "spot_log_id";

-- DropTable
DROP TABLE "spot_logs";

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" "BillingInterval" NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "apple_product_id" TEXT,
    "google_product_id" TEXT,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_features" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FeatureValueType" NOT NULL DEFAULT 'BOOLEAN',
    "unit" TEXT,
    "reset_period" "UsageResetPeriod" NOT NULL DEFAULT 'NEVER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "subscription_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_features" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "plan_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,

    CONSTRAINT "subscription_plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "purchase_provider" TEXT,
    "purchase_id" TEXT,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_usages" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stop_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "arrival_location_id" TEXT,
    "facility_address_id" TEXT,
    "user_id" TEXT,
    "shipper_facility_id" TEXT,
    "facility_name" TEXT NOT NULL,
    "shipper_name" TEXT,
    "load_number" TEXT,
    "bol_number" TEXT,
    "broker_name" TEXT,
    "broker_email" TEXT,
    "broker_mc_number" TEXT,
    "free_time_minutes" INTEGER NOT NULL DEFAULT 120,
    "detention_rate_pence" INTEGER NOT NULL DEFAULT 0,
    "arrived_at" TIMESTAMP(3) NOT NULL,
    "docked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "departed_at" TIMESTAMP(3),
    "notice_sent_at" TIMESTAMP(3),
    "notice_method" TEXT,
    "rate_con_detention_confirmed" "DetentionRateConfirmed",
    "status" "StopLogStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "stop_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "stop_log_id" TEXT,
    "claim_id" TEXT,
    "type" "AttachmentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipper_facilities" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "location_id" TEXT,

    CONSTRAINT "shipper_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipper_facility_ratings" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rating" DECIMAL(5,2) NOT NULL,
    "review" TEXT,
    "user_id" TEXT NOT NULL,
    "shipper_facility_id" TEXT NOT NULL,
    "stop_log_id" TEXT NOT NULL,

    CONSTRAINT "shipper_facility_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "claim_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER,
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "denied_at" TIMESTAMP(3),
    "recourse_started_at" TIMESTAMP(3),
    "collections_referred_at" TIMESTAMP(3),
    "denied_by" TEXT,
    "denial_reason" TEXT,
    "recipient_email" TEXT,
    "send_method" TEXT NOT NULL DEFAULT 'EMAIL',
    "followup_due_at" TIMESTAMP(3),
    "last_follow_up_at" TIMESTAMP(3),
    "followup_count" INTEGER NOT NULL DEFAULT 0,
    "proof_package_generated_at" TIMESTAMP(3),
    "proof_package_url" TEXT,
    "proof_package_version" INTEGER NOT NULL DEFAULT 1,
    "recourse_level" INTEGER NOT NULL DEFAULT 0,
    "usps_tracking_number" TEXT,
    "fmcsa_complaint_number" TEXT,
    "small_claims_case_number" TEXT,
    "user_id" TEXT NOT NULL,
    "shipper_facility_id" TEXT NOT NULL,
    "stop_log_id" TEXT NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE INDEX "subscription_plans_status_idx" ON "subscription_plans"("status");

-- CreateIndex
CREATE INDEX "subscription_plans_sort_order_idx" ON "subscription_plans"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_features_key_key" ON "subscription_features"("key");

-- CreateIndex
CREATE INDEX "subscription_features_is_active_idx" ON "subscription_features"("is_active");

-- CreateIndex
CREATE INDEX "subscription_features_sort_order_idx" ON "subscription_features"("sort_order");

-- CreateIndex
CREATE INDEX "subscription_plan_features_plan_id_idx" ON "subscription_plan_features"("plan_id");

-- CreateIndex
CREATE INDEX "subscription_plan_features_feature_id_idx" ON "subscription_plan_features"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_features_plan_id_feature_id_key" ON "subscription_plan_features"("plan_id", "feature_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_user_id_idx" ON "user_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_plan_id_idx" ON "user_subscriptions"("plan_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions"("status");

-- CreateIndex
CREATE INDEX "user_subscriptions_purchase_provider_purchase_id_idx" ON "user_subscriptions"("purchase_provider", "purchase_id");

-- CreateIndex
CREATE INDEX "feature_usages_user_id_feature_id_idx" ON "feature_usages"("user_id", "feature_id");

-- CreateIndex
CREATE INDEX "feature_usages_subscription_id_idx" ON "feature_usages"("subscription_id");

-- CreateIndex
CREATE INDEX "feature_usages_period_start_period_end_idx" ON "feature_usages"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "stop_logs_arrival_location_id_key" ON "stop_logs"("arrival_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "stop_logs_facility_address_id_key" ON "stop_logs"("facility_address_id");

-- CreateIndex
CREATE INDEX "stop_logs_user_id_idx" ON "stop_logs"("user_id");

-- CreateIndex
CREATE INDEX "stop_logs_created_at_idx" ON "stop_logs"("created_at");

-- CreateIndex
CREATE INDEX "stop_logs_shipper_facility_id_idx" ON "stop_logs"("shipper_facility_id");

-- CreateIndex
CREATE INDEX "attachments_stop_log_id_idx" ON "attachments"("stop_log_id");

-- CreateIndex
CREATE INDEX "attachments_claim_id_idx" ON "attachments"("claim_id");

-- CreateIndex
CREATE INDEX "attachments_type_idx" ON "attachments"("type");

-- CreateIndex
CREATE UNIQUE INDEX "shipper_facilities_normalized_name_key" ON "shipper_facilities"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "shipper_facility_ratings_stop_log_id_key" ON "shipper_facility_ratings"("stop_log_id");

-- CreateIndex
CREATE INDEX "shipper_facility_ratings_user_id_idx" ON "shipper_facility_ratings"("user_id");

-- CreateIndex
CREATE INDEX "shipper_facility_ratings_shipper_facility_id_idx" ON "shipper_facility_ratings"("shipper_facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_stop_log_id_key" ON "claims"("stop_log_id");

-- CreateIndex
CREATE INDEX "claims_shipper_facility_id_idx" ON "claims"("shipper_facility_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "contacts_created_at_idx" ON "contacts"("created_at");

-- CreateIndex
CREATE INDEX "notifications_sender_id_idx" ON "notifications"("sender_id");

-- CreateIndex
CREATE INDEX "notifications_receiver_id_idx" ON "notifications"("receiver_id");

-- CreateIndex
CREATE INDEX "notifications_notification_event_id_idx" ON "notifications"("notification_event_id");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "payment_transactions_user_id_idx" ON "payment_transactions"("user_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

-- CreateIndex
CREATE INDEX "permission_roles_permission_id_idx" ON "permission_roles"("permission_id");

-- CreateIndex
CREATE INDEX "permission_roles_role_id_idx" ON "permission_roles"("role_id");

-- CreateIndex
CREATE INDEX "role_users_role_id_idx" ON "role_users"("role_id");

-- CreateIndex
CREATE INDEX "role_users_user_id_idx" ON "role_users"("user_id");

-- CreateIndex
CREATE INDEX "roles_user_id_idx" ON "roles"("user_id");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE INDEX "ucodes_user_id_idx" ON "ucodes"("user_id");

-- CreateIndex
CREATE INDEX "ucodes_token_idx" ON "ucodes"("token");

-- CreateIndex
CREATE INDEX "user_payment_methods_user_id_idx" ON "user_payment_methods"("user_id");

-- CreateIndex
CREATE INDEX "user_settings_user_id_idx" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "user_settings_setting_id_idx" ON "user_settings"("setting_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- AddForeignKey
ALTER TABLE "ucodes" ADD CONSTRAINT "ucodes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_payment_methods" ADD CONSTRAINT "user_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_features" ADD CONSTRAINT "subscription_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_features" ADD CONSTRAINT "subscription_plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "subscription_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_usages" ADD CONSTRAINT "feature_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_usages" ADD CONSTRAINT "feature_usages_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "subscription_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_usages" ADD CONSTRAINT "feature_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_logs" ADD CONSTRAINT "stop_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_logs" ADD CONSTRAINT "stop_logs_shipper_facility_id_fkey" FOREIGN KEY ("shipper_facility_id") REFERENCES "shipper_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_logs" ADD CONSTRAINT "stop_logs_arrival_location_id_fkey" FOREIGN KEY ("arrival_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stop_logs" ADD CONSTRAINT "stop_logs_facility_address_id_fkey" FOREIGN KEY ("facility_address_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_stop_log_id_fkey" FOREIGN KEY ("stop_log_id") REFERENCES "stop_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipper_facilities" ADD CONSTRAINT "shipper_facilities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipper_facility_ratings" ADD CONSTRAINT "shipper_facility_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipper_facility_ratings" ADD CONSTRAINT "shipper_facility_ratings_shipper_facility_id_fkey" FOREIGN KEY ("shipper_facility_id") REFERENCES "shipper_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipper_facility_ratings" ADD CONSTRAINT "shipper_facility_ratings_stop_log_id_fkey" FOREIGN KEY ("stop_log_id") REFERENCES "stop_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_shipper_facility_id_fkey" FOREIGN KEY ("shipper_facility_id") REFERENCES "shipper_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_stop_log_id_fkey" FOREIGN KEY ("stop_log_id") REFERENCES "stop_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
