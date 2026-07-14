/*
  Warnings:

  - You are about to drop the column `slug` on the `subscription_plans` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "subscription_plans_slug_key";

-- AlterTable
ALTER TABLE "subscription_plans" DROP COLUMN "slug";
