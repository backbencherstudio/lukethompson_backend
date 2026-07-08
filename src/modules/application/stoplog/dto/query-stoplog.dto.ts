import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum StopLogStatus {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export class QueryStopLogDto {
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

export enum ReportPeriod {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum ReportTab {
  WEEKLY_SUMMARY = 'WEEKLY_SUMMARY',
  TAX_REPORT = 'TAX_REPORT',
}

export class QueryReportDto {
  @ApiPropertyOptional({
    enum: ReportTab,
    default: ReportTab.WEEKLY_SUMMARY,
    description: 'Report tab to fetch (WEEKLY_SUMMARY or TAX_REPORT)',
  })
  @IsOptional()
  @IsEnum(ReportTab)
  tab?: ReportTab = ReportTab.WEEKLY_SUMMARY;

  @ApiPropertyOptional({
    enum: ReportPeriod,
    default: ReportPeriod.MONTHLY,
    description: 'Tax report chart period (MONTHLY or YEARLY)',
  })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod = ReportPeriod.MONTHLY;
}
