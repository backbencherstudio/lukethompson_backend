import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Express } from 'express';

export class LocationDto {
  @ApiPropertyOptional({ example: 'Dhaka', description: 'City name' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: 'Dhaka Division',
    description: 'State or division',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'BD', description: 'Country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    example: 'Warehouse A, Williamsburg Bridge',
    description: 'Full address',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '10001', description: 'Zip or postal code' })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional({ example: 40.7128, description: 'Latitude' })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: -74.006, description: 'Longitude' })
  @IsOptional()
  @IsNumber()
  lng?: number;
}

export enum LogStopStep {
  ARRIVAL_TIME = 'arrival_time',
  DOCK_IN_TIME = 'dock_in_time',
  COMPLETED_TIME = 'completed_time',
  DEPARTURE_TIME = 'departure_time',
}

export class PutStopLogDto {
  @ApiPropertyOptional({
    example: 'cl0a1b2c3d4e5f6g7h8i9j0k',
    description:
      'Existing stop log id to update (required for steps other than arrival_time).',
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({
    example: 'cmabc123shipper',
    description: 'Existing shipper facility id.',
  })
  @IsString()
  @IsOptional()
  shipper_id?: string;

  @ApiPropertyOptional({
    example: 'Acme Warehouse',
    description: 'Shipper facility name snapshot for the stop log.',
  })
  @ValidateIf((o) => o.step === LogStopStep.ARRIVAL_TIME && !o.shipper_id)
  @IsString()
  facility_name?: string;

  @ApiPropertyOptional({
    type: LocationDto,
    description: 'Location details (optional for update)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiProperty({
    enum: LogStopStep,
    enumName: 'LogStopStep',
    example: LogStopStep.ARRIVAL_TIME,
    description: 'Step to complete',
  })
  @IsEnum(LogStopStep)
  step: LogStopStep;

  @ApiPropertyOptional({
    description: 'Attachment URL',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  @IsOptional()
  attachments?: Express.Multer.File[];

  @ApiPropertyOptional({
    example: '123456789',
    description: 'BOL number',
  })
  @IsOptional()
  @IsString()
  bol_number?: string;
}
