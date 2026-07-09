import { ApiProperty } from '@nestjs/swagger';

export class AdminShipperRatingUserDto {
  @ApiProperty({ example: 'usr_123456789' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'johndoe@example.com' })
  email: string;

  @ApiProperty({
    example: 'https://storage.googleapis.com/bucket/avatar.jpg',
    nullable: true,
  })
  avatar: string | null;
}

export class AdminShipperRatingItemDto {
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

  @ApiProperty({ type: AdminShipperRatingUserDto, nullable: true })
  user: AdminShipperRatingUserDto | null;
}

export class AdminShipperRatingMetaDto {
  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class AdminShipperRatingListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'Ratings retrieved successfully',
    required: false,
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    type: [AdminShipperRatingItemDto],
    required: false,
    nullable: true,
  })
  data?: AdminShipperRatingItemDto[];

  @ApiProperty({
    type: AdminShipperRatingMetaDto,
    required: false,
    nullable: true,
  })
  meta_data?: AdminShipperRatingMetaDto;
}

export class AdminShipperStatsDataDto {
  @ApiProperty({ example: 100 })
  total_users: number;

  @ApiProperty({ example: 50 })
  total_reviews: number;

  @ApiProperty({ example: 10 })
  total_facilities: number;
}

export class AdminShipperStatsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'Shipper statistics retrieved successfully',
    required: false,
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    type: AdminShipperStatsDataDto,
    required: false,
    nullable: true,
  })
  data?: AdminShipperStatsDataDto;
}

export class AdminShipperRatingDeleteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Rating deleted successfully' })
  message: string;
}
