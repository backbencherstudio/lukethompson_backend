CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ClaimEventType enum if not exists
DO $$ BEGIN
  CREATE TYPE "ClaimEventType" AS ENUM (
    'CLAIM_SENT',
    'FOLLOW_UP_SENT',
    'BROKER_ESCALATION_SENT',
    'DEMAND_LETTER_MAILED',
    'BOND_CLAIM_FILED',
    'CREDIT_REPORT_SUBMITTED',
    'FMCSA_COMPLAINT_FILED',
    'LOAD_BOARD_REVIEW_POSTED',
    'SMALL_CLAIMS_FILED',
    'COLLECTIONS_REFERRED',
    'ATTORNEY_REFERRED',
    'MARKED_PAID',
    'MARKED_DENIED',
    'MARKED_UNCOLLECTABLE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "claim_events" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  claim_id TEXT NOT NULL,
  type "ClaimEventType" NOT NULL,
  recourse_level INTEGER,
  followup_level INTEGER,
  description TEXT,
  CONSTRAINT "claim_events_claim_id_fkey" FOREIGN KEY (claim_id) REFERENCES "claims"(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "claim_events_claim_id_idx" ON "claim_events" (claim_id);
