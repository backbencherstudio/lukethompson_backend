import { ApiProperty } from '@nestjs/swagger';

export class AdminSubscriptionFeatureDataDto {
  @ApiProperty() id: string;
  @ApiProperty() key: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string;
  @ApiProperty() type: string;
  @ApiProperty({ nullable: true }) unit: string;
  @ApiProperty({ required: false }) limit_value?: number;
  @ApiProperty({ required: false }) enabled?: boolean;
  @ApiProperty({ required: false }) reset_period?: string;
  @ApiProperty({ required: false }) is_active?: boolean;
  @ApiProperty({ required: false }) sort_order?: number;
  @ApiProperty({ required: false }) created_at?: Date;
  @ApiProperty({ required: false }) updated_at?: Date;
}

export class AdminSubscriptionPlanDataDto {
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
  @ApiProperty({ type: [AdminSubscriptionFeatureDataDto] }) features: AdminSubscriptionFeatureDataDto[];
}

export class AdminUserDataDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) avatar: string;
  @ApiProperty() type: string;
}

export class UserAdminSubscriptionPlanDataDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() price: number;
  @ApiProperty() currency: string;
  @ApiProperty() interval: string;
}

export class AdminUserSubscriptionDataDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiProperty() started_at: Date;
  @ApiProperty() expires_at: Date;
  @ApiProperty({ nullable: true }) canceled_at: Date;
  @ApiProperty({ nullable: true }) purchase_provider: string;
  @ApiProperty({ nullable: true }) purchase_id: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
  @ApiProperty({ type: AdminUserDataDto }) user: AdminUserDataDto;
  @ApiProperty({ type: UserAdminSubscriptionPlanDataDto, nullable: true }) plan: UserAdminSubscriptionPlanDataDto;
}

export class AdminSubscriptionPlanResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Operation completed successfully' }) message?: string;
  @ApiProperty({ type: AdminSubscriptionPlanDataDto }) data: AdminSubscriptionPlanDataDto;
}

export class AdminSubscriptionPlanListResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Operation completed successfully' }) message?: string;
  @ApiProperty({ type: [AdminSubscriptionPlanDataDto] }) data: AdminSubscriptionPlanDataDto[];
}

export class AdminSubscriptionFeatureResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Operation completed successfully' }) message?: string;
  @ApiProperty({ type: AdminSubscriptionFeatureDataDto }) data: AdminSubscriptionFeatureDataDto;
}

export class AdminSubscriptionFeatureListResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Operation completed successfully' }) message?: string;
  @ApiProperty({ type: [AdminSubscriptionFeatureDataDto] }) data: AdminSubscriptionFeatureDataDto[];
}

export class AdminUserSubscriptionResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Operation completed successfully' }) message?: string;
  @ApiProperty({ type: AdminUserSubscriptionDataDto }) data: AdminUserSubscriptionDataDto;
}

export class AdminUserSubscriptionListResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Operation completed successfully' }) message?: string;
  @ApiProperty({ type: [AdminUserSubscriptionDataDto] }) data: AdminUserSubscriptionDataDto[];
}
