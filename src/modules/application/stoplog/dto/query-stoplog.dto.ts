import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum StopLogStatus {
  ALL = 'ALL',
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
}

export class QueryStopLogDto {
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
    enum: StopLogStatus,
    default: StopLogStatus.ALL,
    description: 'Filter by status (ALL, PROGRESS, COMPLETED)',
  })
  @IsOptional()
  @IsEnum(StopLogStatus)
  status?: StopLogStatus = StopLogStatus.ALL;
}

export enum Period {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class QueryHomeDataDto {
  @ApiPropertyOptional({
    enum: Period,
    default: Period.TODAY,
    description: 'Filter by period (TODAY, WEEK, MONTH, YEAR)',
  })
  @IsOptional()
  @IsEnum(Period)
  period?: Period = Period.TODAY;
}
