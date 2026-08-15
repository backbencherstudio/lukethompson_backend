import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';



export class CreateShipperDto {
  @ApiProperty({
    example: 'ABC Logistics Center',
    description: 'Name of the shipper facility',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Facility name is required' })
  @IsString({ message: 'Facility name must be a string' })
  @MaxLength(255, { message: 'Facility name cannot exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({
    example: '123 Main Street',
    description: 'Street address of the facility',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
  address?: string;

  @ApiPropertyOptional({
    example: 'New York',
    description: 'City of the facility',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'City must be a string' })
  @MaxLength(100, { message: 'City cannot exceed 100 characters' })
  city?: string;

  @ApiPropertyOptional({
    example: 'NY',
    description: 'State of the facility',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'State must be a string' })
  @MaxLength(50, { message: 'State cannot exceed 50 characters' })
  state?: string;

  @ApiPropertyOptional({
    example: '10001',
    description: 'ZIP/Postal code of the facility',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'ZIP code must be a string' })
  @MaxLength(20, { message: 'ZIP code cannot exceed 20 characters' })
  zip?: string;

  @ApiPropertyOptional({
    example: 'USA',
    description: 'Country of the facility',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Country must be a string' })
  @MaxLength(100, { message: 'Country cannot exceed 100 characters' })
  country?: string;

  @ApiPropertyOptional({
    example: 40.7128,
    description: 'Latitude of the facility location',
    minimum: -90,
    maximum: 90,
  })
  @IsOptional()
  @IsLatitude({ message: 'Invalid latitude value' })
  lat?: number;

  @ApiPropertyOptional({
    example: -74.006,
    description: 'Longitude of the facility location',
    minimum: -180,
    maximum: 180,
  })
  @IsOptional()
  @IsLongitude({ message: 'Invalid longitude value' })
  lng?: number;
}
export class CreateShipperRatingDto {
  @ApiProperty({ example: 85, description: 'Rating score (0 to 100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}