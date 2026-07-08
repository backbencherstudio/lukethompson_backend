-- AlterTable
ALTER TABLE "claims" ADD COLUMN     "bond_claim_at" TIMESTAMP(3),
ADD COLUMN     "broker_escalation_at" TIMESTAMP(3),
ADD COLUMN     "credit_report_at" TIMESTAMP(3),
ADD COLUMN     "demand_letter_at" TIMESTAMP(3),
ADD COLUMN     "fmcsa_complaint_at" TIMESTAMP(3),
ADD COLUMN     "load_board_report_at" TIMESTAMP(3),
ADD COLUMN     "small_claims_filed_at" TIMESTAMP(3);
