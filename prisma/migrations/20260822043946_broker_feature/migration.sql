-- AlterTable
ALTER TABLE "shipper_facilities" ADD COLUMN     "broker_id" TEXT;

-- CreateTable
CREATE TABLE "brokers" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_ratings" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "rating" DECIMAL(5,2) NOT NULL,
    "review" TEXT,
    "user_id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "stop_log_id" TEXT,

    CONSTRAINT "broker_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broker_ratings_user_id_idx" ON "broker_ratings"("user_id");

-- CreateIndex
CREATE INDEX "broker_ratings_broker_id_idx" ON "broker_ratings"("broker_id");

-- AddForeignKey
ALTER TABLE "shipper_facilities" ADD CONSTRAINT "shipper_facilities_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_ratings" ADD CONSTRAINT "broker_ratings_stop_log_id_fkey" FOREIGN KEY ("stop_log_id") REFERENCES "stop_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
