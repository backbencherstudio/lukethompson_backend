import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class PlanFeatureInputDto {
  @ApiProperty({ example: 'feature_id_123' })
  @IsString()
  feature_id: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  enabled?: boolean = true;

  @ApiPropertyOptional({ example: 100, nullable: true })
  @IsOptional()
  @IsNumber()
  limit_value?: number;
}

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Premium Plan' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'premium-plan' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ example: 'Premium access to all features' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @ApiProperty({ enum: BillingInterval, example: BillingInterval.MONTHLY })
  @IsEnum(BillingInterval)
  interval: BillingInterval;

  @ApiPropertyOptional({ enum: PlanStatus, default: PlanStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus = PlanStatus.ACTIVE;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsNumber()
  sort_order?: number = 0;

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

export class CreateSubscriptionFeatureDto {
  @ApiProperty({ example: 'detention-logs-limit' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Detention Logs Limit' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Maximum number of active stop logs allowed per month',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: FeatureValueType,
    default: FeatureValueType.BOOLEAN,
  })
  @IsOptional()
  @IsEnum(FeatureValueType)
  type?: FeatureValueType = FeatureValueType.BOOLEAN;

  @ApiPropertyOptional({ example: 'logs', nullable: true })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    enum: UsageResetPeriod,
    default: UsageResetPeriod.NEVER,
  })
  @IsOptional()
  @IsEnum(UsageResetPeriod)
  reset_period?: UsageResetPeriod = UsageResetPeriod.NEVER;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsNumber()
  sort_order?: number = 0;
}

export class CreateUserSubscriptionDto {
  @ApiProperty({ example: 'user_id_123' })
  @IsString()
  user_id: string;

  @ApiProperty({ example: 'plan_id_456' })
  @IsString()
  plan_id: string;

  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus = SubscriptionStatus.ACTIVE;

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
