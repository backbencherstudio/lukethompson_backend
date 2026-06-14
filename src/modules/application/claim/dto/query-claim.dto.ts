import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum QueryClaimStatus {
  ALL = 'ALL',
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PAID = 'PAID',
  DENIED = 'DENIED',
}


export class QueryClaimDto {
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
    description: 'Search by facility name, BOL, or load number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: QueryClaimStatus,
    default: QueryClaimStatus.ALL,
    description: 'Filter by claim status',
  })
  @IsOptional()
  @IsEnum(QueryClaimStatus)
  status?: QueryClaimStatus = QueryClaimStatus.ALL;
}
