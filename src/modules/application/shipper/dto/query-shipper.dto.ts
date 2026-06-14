import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum QueryShipperStatus {
  ALL = 'ALL',
  GOOD_PAYERS = 'GOOD_PAYERS',
  AVERAGE = 'AVERAGE',
  POOR_PAYERS = 'POOR_PAYERS',
}

export class QueryShipperDto {
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
    description: 'Search by facility name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: QueryShipperStatus,
    default: QueryShipperStatus.ALL,
    description: 'Filter by rating category',
  })
  @IsOptional()
  @IsEnum(QueryShipperStatus)
  status?: QueryShipperStatus = QueryShipperStatus.ALL;
}
