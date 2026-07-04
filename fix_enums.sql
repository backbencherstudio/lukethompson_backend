-- Fix ClaimStatus: remove extra variants
ALTER TYPE "ClaimStatus" RENAME TO "ClaimStatus_old";
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAID', 'DENIED');
ALTER TABLE claims ALTER COLUMN status DROP DEFAULT;
ALTER TABLE claims ALTER COLUMN status TYPE "ClaimStatus" USING status::text::"ClaimStatus";
ALTER TABLE claims ALTER COLUMN status SET DEFAULT 'DRAFT'::"ClaimStatus";
DROP TYPE "ClaimStatus_old";

-- Fix StopLogStatus: remove extra variants
ALTER TYPE "StopLogStatus" RENAME TO "StopLogStatus_old";
CREATE TYPE "StopLogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
ALTER TABLE stop_logs ALTER COLUMN status DROP DEFAULT;
ALTER TABLE stop_logs ALTER COLUMN status TYPE "StopLogStatus" USING status::text::"StopLogStatus";
ALTER TABLE stop_logs ALTER COLUMN status SET DEFAULT 'DRAFT'::"StopLogStatus";
DROP TYPE "StopLogStatus_old";
