import { ApiProperty } from '@nestjs/swagger';

export class ShipperRatingUserDto {
  @ApiProperty({ example: 'usr_123456789' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'johndoe@example.com' })
  email: string;

  @ApiProperty({ example: 'https://storage.googleapis.com/bucket/avatar.jpg', nullable: true })
  avatar: string | null;
}

export class ShipperRatingItemDto {
  @ApiProperty({ example: 'rating_123456789' })
  id: string;

  @ApiProperty({ example: 'fac_123456789', nullable: true })
  shipper_facility_id: string | null;

  @ApiProperty({ example: 'Acme Logistics Facility', nullable: true })
  shipper_facility_name: string | null;

  @ApiProperty({ example: 4.5 })
  rate: number;

  @ApiProperty({ example: 'Great facility, fast loading.', nullable: true })
  review: string | null;

  @ApiProperty({ example: '2023-10-27T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ type: ShipperRatingUserDto, nullable: true })
  user: ShipperRatingUserDto | null;
}

export class ShipperRatingMetaDto {
  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class ShipperRatingListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [ShipperRatingItemDto] })
  data: ShipperRatingItemDto[];

  @ApiProperty({ type: ShipperRatingMetaDto })
  meta_data: ShipperRatingMetaDto;
}

export class ShipperStatsDataDto {
  @ApiProperty({ example: 100 })
  total_users: number;

  @ApiProperty({ example: 50 })
  total_reviews: number;

  @ApiProperty({ example: 10 })
  total_facilities: number;
}

export class ShipperStatsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: ShipperStatsDataDto })
  data: ShipperStatsDataDto;
}
