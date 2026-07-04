import { ApiProperty } from '@nestjs/swagger';

// --- List Ratings Response ---
export class ShipperRatingItemDto {
  @ApiProperty({ example: 'shipper_id_1' })
  id: string;

  @ApiProperty({ example: 'Walmart DC - Memphis' })
  facility_name: string;

  @ApiProperty({ example: 84 })
  rating: number;

  @ApiProperty({ example: 'Known good payer • Avg. 5 days to pay' })
  status_subtext: string;

  @ApiProperty({ example: 127 })
  claims_count: number;

  @ApiProperty({ example: 5, required: false, nullable: true })
  avg_pay_days?: number;

  @ApiProperty({ example: 107 })
  paid_claims_count: number;
}

export class ShipperRatingMetaFiltersDto {
  @ApiProperty({ example: 'ALL' })
  status: string;
}

export class ShipperRatingMetaDto {
  @ApiProperty({ example: 'shipper_id_10', required: false, nullable: true })
  next_cursor?: string;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 'Walmart', required: false, nullable: true })
  search?: string;

  @ApiProperty({ type: ShipperRatingMetaFiltersDto })
  filters: ShipperRatingMetaFiltersDto;
}

export class ShipperRatingsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Shipper ratings fetched successfully' })
  message: string;

  @ApiProperty({ type: [ShipperRatingItemDto] })
  data: ShipperRatingItemDto[];

  @ApiProperty({ type: ShipperRatingMetaDto })
  meta_data: ShipperRatingMetaDto;
}

// --- Single Rating Details Response ---
export class ShipperRatingDetailsDto {
  @ApiProperty({ example: 'shipper_id_1' })
  id: string;

  @ApiProperty({ example: 'Walmart DC - Memphis' })
  facility_name: string;

  @ApiProperty({ example: 84 })
  rating: number;

  @ApiProperty({ example: 127 })
  total_claims_submitted: number;

  @ApiProperty({ example: 5, required: false, nullable: true })
  avg_pay_days?: number;

  @ApiProperty({ example: 107 })
  total_paid: number;

  @ApiProperty({ example: 20 })
  total_denied: number;
}

export class ShipperRatingDetailsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Shipper rating details fetched successfully' })
  message: string;

  @ApiProperty({ type: ShipperRatingDetailsDto })
  data: ShipperRatingDetailsDto;
}

// --- Search Shipper Response ---
export class ShipperSearchItemDto {
  @ApiProperty({ example: 'shipper_id_1' })
  id: string;

  @ApiProperty({ example: 'Walmart DC - Memphis' })
  name: string;

  @ApiProperty({ example: '123 Main St, Memphis, TN 38101', nullable: true })
  address: string | null;

  @ApiProperty({ example: 85 })
  rating: number;
}

export class ShipperSearchResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Shipper facilities searched successfully' })
  message: string;

  @ApiProperty({ type: [ShipperSearchItemDto] })
  data: ShipperSearchItemDto[];

  @ApiProperty({ type: ShipperRatingMetaDto })
  meta_data: ShipperRatingMetaDto;
}

// --- Create Rating Response ---
export class ShipperCreateRatingDataDto {
  @ApiProperty({ example: 'cl0b7e6d5f4g3h2i1j0k9l8m' })
  id: string;

  @ApiProperty({ example: '2026-07-04T05:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-07-04T05:00:00.000Z' })
  updated_at: Date;

  @ApiProperty({ example: '85.00' })
  rating: string;

  @ApiProperty({ example: null, nullable: true })
  review: string | null;

  @ApiProperty({ example: 'user_id_123' })
  user_id: string;

  @ApiProperty({ example: 'shipper_id_456' })
  shipper_facility_id: string;

  @ApiProperty({ example: 'stop_log_id_789' })
  stop_log_id: string;
}

export class ShipperCreateRatingResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Rating submitted successfully' })
  message: string;

  @ApiProperty({ type: ShipperCreateRatingDataDto })
  data: ShipperCreateRatingDataDto;
}
