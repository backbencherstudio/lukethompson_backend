import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCheckoutSessionDto {
  @ApiProperty({ example: 'plan_id_123' })
  @IsString()
  plan_id: string;
}

export class CheckoutSessionDataDto {
  @ApiProperty({ example: 'cs_test_12345' })
  id: string;

  @ApiProperty({ example: 'https://checkout.stripe.com/...' })
  url: string;
}

export class CheckoutSessionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Checkout session created successfully' })
  message: string;

  @ApiProperty({ type: CheckoutSessionDataDto })
  data: CheckoutSessionDataDto;
}

export class SubscriptionFeatureDataDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) unit: string;
  @ApiProperty({ required: false }) limit_value?: number;
  @ApiProperty({ required: false }) enabled?: boolean;
}

export class SubscriptionPlanDataDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string;
  @ApiProperty() price: number;
  @ApiProperty() currency: string;
  @ApiProperty() interval: string;
  @ApiProperty() status: string;
  @ApiProperty() sort_order: number;
  @ApiProperty({ nullable: true }) product_id: string;
  @ApiProperty({ nullable: true }) price_id: string;
  @ApiProperty({ nullable: true }) apple_product_id: string;
  @ApiProperty({ nullable: true }) google_product_id: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
  @ApiProperty({ type: [SubscriptionFeatureDataDto] }) features: SubscriptionFeatureDataDto[];
}

export class UserDataDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) avatar: string;
  @ApiProperty() type: string;
}

export class UserSubscriptionPlanDataDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() price: number;
  @ApiProperty() currency: string;
  @ApiProperty() interval: string;
}

export class UserSubscriptionDataDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiProperty() started_at: Date;
  @ApiProperty() expires_at: Date;
  @ApiProperty({ nullable: true }) canceled_at: Date;
  @ApiProperty({ nullable: true }) purchase_provider: string;
  @ApiProperty({ nullable: true }) purchase_id: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
  @ApiProperty({ type: UserDataDto }) user: UserDataDto;
  @ApiProperty({ type: UserSubscriptionPlanDataDto, nullable: true }) plan: UserSubscriptionPlanDataDto;
}

export class SubscriptionPlanResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Active subscription plans retrieved successfully' }) message: string;
  @ApiProperty({ type: SubscriptionPlanDataDto }) data: SubscriptionPlanDataDto;
}

export class SubscriptionPlanListResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Active subscription plans retrieved successfully' }) message: string;
  @ApiProperty({ type: [SubscriptionPlanDataDto] }) data: SubscriptionPlanDataDto[];
}

export class UserSubscriptionResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Current user subscription retrieved successfully' }) message: string;
  @ApiProperty({ type: UserSubscriptionDataDto }) data: UserSubscriptionDataDto;
}
