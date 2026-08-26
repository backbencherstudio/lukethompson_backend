-- AlterTable
ALTER TABLE "stop_logs" ADD COLUMN     "broker_id" TEXT;

-- CreateIndex
CREATE INDEX "stop_logs_broker_id_idx" ON "stop_logs"("broker_id");

-- AddForeignKey
ALTER TABLE "stop_logs" ADD CONSTRAINT "stop_logs_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
