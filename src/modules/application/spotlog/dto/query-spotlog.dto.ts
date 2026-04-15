import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum SpotLogStatus {
  ALL = 'ALL',
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class QuerySpotLogDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Dhaka',
    description: 'Search by location address or city',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: SpotLogStatus,
    default: SpotLogStatus.ALL,
    description: 'Filter by status (ALL, PROGRESS, COMPLETED)',
  })
  @IsOptional()
  @IsEnum(SpotLogStatus)
  status?: SpotLogStatus = SpotLogStatus.ALL;
}
