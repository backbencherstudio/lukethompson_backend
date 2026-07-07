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
