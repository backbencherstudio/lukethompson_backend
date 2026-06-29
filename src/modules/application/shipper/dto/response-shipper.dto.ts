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
