import { ApiProperty } from '@nestjs/swagger';

// --- List Claims Response ---
export class ClaimListItemDto {
  @ApiProperty({ example: 'claim_id_1' })
  id: string;

  @ApiProperty({ example: 'Walmart DC Shelbyville' })
  facility_name: string;

  @ApiProperty({ example: '2026-06-28T05:27:44Z' })
  date: string;

  @ApiProperty({ example: 135 })
  amount: number;

  @ApiProperty({ example: 'PAID' })
  status: string;
}

export class ClaimListMetaFiltersDto {
  @ApiProperty({ example: 'ALL' })
  status: string;
}

export class ClaimListMetaCountsDto {
  @ApiProperty({ example: 12 })
  all: number;

  @ApiProperty({ example: 2 })
  draft: number;

  @ApiProperty({ example: 4 })
  submitted: number;

  @ApiProperty({ example: 6 })
  paid: number;

  @ApiProperty({ example: 0 })
  denied: number;
}

export class ClaimListMetaStatsDto {
  @ApiProperty({ example: '1240.00' })
  pending_claims_amount: string;

  @ApiProperty({ example: '4892.00' })
  settled_this_week_amount: string;
}

export class ClaimListMetaDto {
  @ApiProperty({ example: 'claim_id_10', required: false, nullable: true })
  next_cursor?: string;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 'Walmart', required: false, nullable: true })
  search?: string;

  @ApiProperty({ type: ClaimListMetaFiltersDto })
  filters: ClaimListMetaFiltersDto;

  @ApiProperty({ type: ClaimListMetaCountsDto })
  counts: ClaimListMetaCountsDto;

  @ApiProperty({ type: ClaimListMetaStatsDto })
  stats: ClaimListMetaStatsDto;
}

export class ClaimListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Claims fetched successfully' })
  message: string;

  @ApiProperty({ type: [ClaimListItemDto] })
  data: ClaimListItemDto[];

  @ApiProperty({ type: ClaimListMetaDto })
  meta_data: ClaimListMetaDto;
}

// --- Action Response ---
export class ClaimActionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

export class ClaimSubmitDataDto {
  @ApiProperty({ example: 'claim_id_1' })
  claim_id: string;

  @ApiProperty({ example: 'SUBMITTED' })
  status: string;

  @ApiProperty({ example: '2026-06-28T05:27:44Z' })
  sent_at: string;

  @ApiProperty({
    example: 'Hello, this is a formal request for payment...',
    required: false,
    description: 'The copyable claim message, if method was MESSAGE',
  })
  claim_message?: string;
}

export class ClaimSubmitResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Claim submitted successfully via email' })
  message: string;

  @ApiProperty({ type: ClaimSubmitDataDto })
  data: ClaimSubmitDataDto;
}

// --- Detail Response ---
export class ClaimDetailAttachmentDto {
  @ApiProperty({ example: 'att_1' })
  id: string;

  @ApiProperty({ example: 'bol.pdf' })
  file_name: string;

  @ApiProperty({ example: 'https://...' })
  file_url: string;

  @ApiProperty({ example: 'application/pdf' })
  mime_type: string;

  @ApiProperty({ example: 'OTHER' })
  type: string;

  @ApiProperty({ example: 102400 })
  size_bytes: number;
}

export class ClaimDetailEventDto {
  @ApiProperty({ example: 'event_1' })
  id: string;

  @ApiProperty({ example: '2026-06-28T05:27:44Z' })
  created_at: Date;

  @ApiProperty({ example: 'CLAIM_SENT' })
  type: string;

  @ApiProperty({ example: 1, required: false })
  recourse_level?: number;

  @ApiProperty({ example: 1, required: false })
  followup_level?: number;

  @ApiProperty({ example: 'Claim submitted via EMAIL to broker@example.com' })
  description: string;
}

export class ClaimDetailDataDto {
  @ApiProperty({ example: 'claim_1' })
  id: string;

  @ApiProperty({ example: 'SUBMITTED' })
  status: string;

  @ApiProperty({ example: 150 })
  claim_amount: number;

  @ApiProperty({ example: 150, required: false, nullable: true })
  paid_amount?: number;

  @ApiProperty({
    example: '2026-06-28T05:27:44Z',
    required: false,
    nullable: true,
  })
  sent_at?: Date;

  @ApiProperty({
    example: '2026-06-30T10:00:00Z',
    required: false,
    nullable: true,
  })
  paid_at?: Date;

  @ApiProperty({
    example: '2026-06-29T08:00:00Z',
    required: false,
    nullable: true,
  })
  denied_at?: Date;

  @ApiProperty({ example: 'Broker API', required: false, nullable: true })
  denied_by?: string;

  @ApiProperty({
    example: 'No proof of detention',
    required: false,
    nullable: true,
  })
  denial_reason?: string;

  @ApiProperty({
    example: 'broker@example.com',
    required: false,
    nullable: true,
  })
  recipient_email?: string;

  @ApiProperty({
    example: 'carrier-sales@choptank.com',
    required: false,
    nullable: true,
  })
  broker_email?: string;

  @ApiProperty({ example: 'EMAIL' })
  send_method: string;

  @ApiProperty({ example: 1 })
  recourse_level: number;

  @ApiProperty({ example: 'Soft follow-ups' })
  recourse_level_name: string;

  @ApiProperty({ example: 1 })
  followup_count: number;

  @ApiProperty({
    example: '2026-07-05T05:27:44Z',
    required: false,
    nullable: true,
  })
  last_follow_up_at?: Date;

  @ApiProperty({
    example: '2026-07-12T05:27:44Z',
    required: false,
    nullable: true,
  })
  followup_due_at?: Date;

  @ApiProperty({ example: 'USPS-123456789', required: false, nullable: true })
  usps_tracking_number?: string;

  @ApiProperty({ example: 'FMCSA-987654', required: false, nullable: true })
  fmcsa_complaint_number?: string;

  @ApiProperty({ example: 'SC-54321', required: false, nullable: true })
  small_claims_case_number?: string;

  @ApiProperty({
    example: '2026-07-01T10:00:00Z',
    required: false,
    nullable: true,
  })
  broker_escalation_at?: Date;

  @ApiProperty({
    example: '2026-07-07T10:00:00Z',
    required: false,
    nullable: true,
  })
  demand_letter_at?: Date;

  @ApiProperty({
    example: '2026-07-11T10:00:00Z',
    required: false,
    nullable: true,
  })
  bond_claim_at?: Date;

  @ApiProperty({
    example: '2026-07-16T10:00:00Z',
    required: false,
    nullable: true,
  })
  credit_report_at?: Date;

  @ApiProperty({
    example: '2026-07-21T10:00:00Z',
    required: false,
    nullable: true,
  })
  fmcsa_complaint_at?: Date;

  @ApiProperty({
    example: '2026-07-26T10:00:00Z',
    required: false,
    nullable: true,
  })
  load_board_report_at?: Date;

  @ApiProperty({
    example: '2026-07-31T10:00:00Z',
    required: false,
    nullable: true,
  })
  small_claims_filed_at?: Date;

  @ApiProperty({
    example: '2026-08-15T10:00:00Z',
    required: false,
    nullable: true,
  })
  collections_referred_at?: Date;

  @ApiProperty({
    type: ClaimDetailAttachmentDto,
    required: false,
    nullable: true,
  })
  detention_summary_pdf?: ClaimDetailAttachmentDto;

  @ApiProperty({ type: [ClaimDetailAttachmentDto] })
  attachments: ClaimDetailAttachmentDto[];

  @ApiProperty({ type: [ClaimDetailEventDto] })
  timeline: ClaimDetailEventDto[];
}

export class ClaimDetailResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Claim fetched successfully' })
  message: string;

  @ApiProperty({ type: ClaimDetailDataDto })
  data: ClaimDetailDataDto;
}
