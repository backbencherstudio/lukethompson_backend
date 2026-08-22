import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum QueryShipperStatus {
  ALL = 'ALL',
  GOOD_PAYERS = 'GOOD_PAYERS',
  AVERAGE = 'AVERAGE',
  POOR_PAYERS = 'POOR_PAYERS',
}

export enum QueryType {
  SHIPPER = 'shipper',
  BROKER = 'broker',
}

export class QueryShipperDto {
  @ApiPropertyOptional({
    enum: QueryType,
    default: QueryType.SHIPPER,
    description: 'Type of entity to fetch: shipper or broker',
  })
  @IsOptional()
  @IsEnum(QueryType)
  type?: QueryType = QueryType.SHIPPER;

  @ApiPropertyOptional({
    example: 'cl0b7e6d5f4g3h2i1j0k9l8m',
    description: 'Cursor for pagination',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Walmart',
    description: 'Search by facility name or broker name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: QueryShipperStatus,
    default: QueryShipperStatus.ALL,
    description: 'Filter by rating category (only applies to shippers)',
  })
  @IsOptional()
  @IsEnum(QueryShipperStatus)
  status?: QueryShipperStatus = QueryShipperStatus.ALL;
}

export class SearchShipperDto {
  @ApiPropertyOptional({
    enum: QueryType,
    default: QueryType.SHIPPER,
    description: 'Type of entity to search: shipper or broker',
  })
  @IsOptional()
  @IsEnum(QueryType)
  type?: QueryType = QueryType.SHIPPER;

  @ApiPropertyOptional({
    example: 'Walmart',
    description: 'Search keyword for facility name, address, or broker name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'cl0b7e6d5f4g3h2i1j0k9l8m',
    description: 'Cursor for pagination',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;
}
