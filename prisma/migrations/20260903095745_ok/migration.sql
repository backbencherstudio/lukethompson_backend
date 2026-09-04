/*
  Warnings:

  - A unique constraint covering the columns `[subscription_customer_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active_entitlements" JSONB,
ADD COLUMN     "subscription_customer_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_subscription_customer_id_key" ON "users"("subscription_customer_id");

-- CreateIndex
CREATE INDEX "users_subscription_customer_id_idx" ON "users"("subscription_customer_id");
