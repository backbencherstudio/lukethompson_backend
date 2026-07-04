-- Cleanup from partial previous run
-- ClaimStatus: column still uses _old type, fix it
ALTER TABLE claims ALTER COLUMN status DROP DEFAULT;
ALTER TABLE claims ALTER COLUMN status TYPE "ClaimStatus" USING status::text::"ClaimStatus";
ALTER TABLE claims ALTER COLUMN status SET DEFAULT 'DRAFT'::"ClaimStatus";
DROP TYPE IF EXISTS "ClaimStatus_old";

-- StopLogStatus: column still uses _old type, fix it
ALTER TABLE stop_logs ALTER COLUMN status DROP DEFAULT;
ALTER TABLE stop_logs ALTER COLUMN status TYPE "StopLogStatus" USING status::text::"StopLogStatus";
ALTER TABLE stop_logs ALTER COLUMN status SET DEFAULT 'DRAFT'::"StopLogStatus";
DROP TYPE IF EXISTS "StopLogStatus_old";

SELECT 'Enums fixed successfully' as result;
