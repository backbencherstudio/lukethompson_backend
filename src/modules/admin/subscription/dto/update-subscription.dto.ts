import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BillingInterval,
  FeatureValueType,
  PlanStatus,
  SubscriptionStatus,
  UsageResetPeriod,
} from 'prisma/generated/enums';
import { PlanFeatureInputDto } from './create-subscription.dto';

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ example: 'Premium Plan' })
  @IsOptional()
  @IsString()
  name?: string;


  @ApiPropertyOptional({ example: 'Premium access to all features' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 29.99 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: BillingInterval })
  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval;

  @ApiPropertyOptional({ enum: PlanStatus })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @ApiPropertyOptional({ example: 'apple_prod_123', nullable: true })
  @IsOptional()
  @IsString()
  apple_product_id?: string;

  @ApiPropertyOptional({ example: 'google_prod_123', nullable: true })
  @IsOptional()
  @IsString()
  google_product_id?: string;

  @ApiPropertyOptional({ type: [PlanFeatureInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureInputDto)
  features?: PlanFeatureInputDto[];
}

export class UpdateSubscriptionFeatureDto {
  @ApiPropertyOptional({ example: 'detention-logs-limit' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({ example: 'Detention Logs Limit' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'Maximum number of active stop logs allowed per month',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: FeatureValueType })
  @IsOptional()
  @IsEnum(FeatureValueType)
  type?: FeatureValueType;

  @ApiPropertyOptional({ example: 'logs', nullable: true })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ enum: UsageResetPeriod })
  @IsOptional()
  @IsEnum(UsageResetPeriod)
  reset_period?: UsageResetPeriod;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class UpdateUserSubscriptionDto {
  @ApiPropertyOptional({ example: 'user_id_123' })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({ example: 'plan_id_456' })
  @IsOptional()
  @IsString()
  plan_id?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: '2026-07-04T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  started_at?: Date;

  @ApiPropertyOptional({ example: '2026-08-04T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  expires_at?: Date;

  @ApiPropertyOptional({ example: '2026-07-04T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  canceled_at?: Date;

  @ApiPropertyOptional({ example: 'stripe', nullable: true })
  @IsOptional()
  @IsString()
  purchase_provider?: string;

  @ApiPropertyOptional({ example: 'sub_1234567890', nullable: true })
  @IsOptional()
  @IsString()
  purchase_id?: string;
}
