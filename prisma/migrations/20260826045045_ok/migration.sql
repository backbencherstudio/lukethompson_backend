/*
  Warnings:

  - A unique constraint covering the columns `[brokerId]` on the table `brokers` will be added. If there are existing duplicate values, this will fail.
  - Made the column `email` on table `brokers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "brokers" ADD COLUMN     "brokerId" TEXT,
ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "brokers_brokerId_key" ON "brokers"("brokerId");

-- AddForeignKey
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
