import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
  CUSTOM = 'custom',
  DAILY = 'daily',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export enum SubscriptionPlatform {
  REVENUECAT = 'revenuecat',
  STRIPE = 'stripe',
  MANUAL = 'manual',
  APPLE = 'apple',
  GOOGLE = 'google',
}

// ✅ RevenueCat Entitlement Constants
export const REVENUECAT_ENTITLEMENTS = {
  PRO: 'GetDockPay Pro',
  PREMIUM: 'GetDockPay Premium',
} as const;

export class GrantSubscriptionDto {
  @ApiProperty({
    description: 'User ID to grant subscription to',
    example: 'cmtld6c470000f5kgdy3oqxpe',
    required: true,
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Entitlement ID/Product ID to grant',
    example: REVENUECAT_ENTITLEMENTS.PRO, // ✅ Fixed: Now shows 'GetDockPay Pro' with space
    required: true,
  })
  @IsString()
  entitlementId: string;

  @ApiProperty({
    description: 'Billing cycle duration',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
    default: BillingCycle.MONTHLY,
    required: false,
  })
  @IsEnum(BillingCycle)
  @IsOptional()
  duration?: BillingCycle = BillingCycle.MONTHLY;

  @ApiProperty({
    description: 'Custom end date (required if duration is custom)',
    example: '2027-12-31T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @ValidateIf((o) => o.duration === BillingCycle.CUSTOM)
  customEndDate?: string;

  @ApiProperty({
    description: 'Admin notes about this grant',
    example: 'Customer loyalty reward for early adoption',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RevokeSubscriptionDto {
  @ApiProperty({
    description: 'User ID to revoke subscription from',
    example: 'cmtld6c470000f5kgdy3oqxpe',
    required: true,
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Entitlement ID to revoke',
    example: REVENUECAT_ENTITLEMENTS.PRO, // ✅ Fixed: Now shows 'GetDockPay Pro' with space
    required: true,
  })
  @IsString()
  entitlementId: string;

  @ApiProperty({
    description: 'Reason for revocation',
    example: 'User requested cancellation',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class ExtendSubscriptionDto {
  @ApiProperty({
    description: 'User ID to extend subscription',
    example: 'cmtld6c470000f5kgdy3oqxpe',
    required: true,
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Entitlement ID to extend',
    example: REVENUECAT_ENTITLEMENTS.PRO, // ✅ Fixed: Now shows 'GetDockPay Pro' with space
    required: true,
  })
  @IsString()
  entitlementId: string;

  @ApiProperty({
    description: 'Number of days to extend',
    example: 30,
    minimum: 1,
    maximum: 365,
    required: true,
  })
  @IsInt()
  @Min(1)
  @Max(365)
  extensionDays: number;

  @ApiProperty({
    description: 'Reason for extension',
    example: 'Goodwill gesture for service downtime',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class QuerySubscriptionDto {
  @ApiProperty({
    description: 'Filter by subscription status',
    enum: SubscriptionStatus,
    required: false,
  })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @ApiProperty({
    description: 'Filter by user ID',
    example: 'cmtld6c470000f5kgdy3oqxpe',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'Filter by entitlement ID',
    example: REVENUECAT_ENTITLEMENTS.PRO, // ✅ Fixed: Now shows 'GetDockPay Pro' with space
    required: false,
  })
  @IsString()
  @IsOptional()
  entitlementId?: string;

  @ApiProperty({
    description: 'Search by user name or email',
    example: 'john',
    required: false,
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Number of records to fetch',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({
    description: 'Number of records to skip',
    example: 0,
    default: 0,
    minimum: 0,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}

export class UpdateSubscriptionDto {
  @ApiProperty({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    required: false,
  })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @ApiProperty({
    description: 'New end date for the subscription',
    example: '2027-12-31T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Update notes',
    example: 'Extending subscription by 3 months',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkGrantSubscriptionDto {
  @ApiProperty({
    description: 'List of user IDs to grant subscription to',
    example: ['cmtld6c470000f5kgdy3oqxpe', 'cmtld88w00002f5kgj7ooccqq'],
    required: true,
    type: [String],
  })
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({
    description: 'Entitlement ID to grant',
    example: REVENUECAT_ENTITLEMENTS.PRO, // ✅ Fixed: Now shows 'GetDockPay Pro' with space
    required: true,
  })
  @IsString()
  entitlementId: string;

  @ApiProperty({
    description: 'Billing cycle duration',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
    default: BillingCycle.MONTHLY,
    required: false,
  })
  @IsEnum(BillingCycle)
  @IsOptional()
  duration?: BillingCycle = BillingCycle.MONTHLY;

  @ApiProperty({
    description: 'Admin notes about this bulk grant',
    example: 'Company-wide subscription for all employees',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RenewSubscriptionDto {
  @ApiProperty({
    description: 'Subscription ID to renew',
    example: 'sub_abc123def456',
    required: true,
  })
  @IsString()
  subscriptionId: string;

  @ApiProperty({
    description: 'Billing cycle for renewal',
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
    default: BillingCycle.MONTHLY,
    required: false,
  })
  @IsEnum(BillingCycle)
  @IsOptional()
  duration?: BillingCycle = BillingCycle.MONTHLY;

  @ApiProperty({
    description: 'Admin notes about the renewal',
    example: 'Annual renewal with discount',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class TransferSubscriptionDto {
  @ApiProperty({
    description: 'Current subscription ID to transfer',
    example: 'sub_abc123def456',
    required: true,
  })
  @IsString()
  subscriptionId: string;

  @ApiProperty({
    description: 'New user ID to transfer subscription to',
    example: 'cmtld6c470000f5kgdy3oqxpe',
    required: true,
  })
  @IsString()
  newUserId: string;

  @ApiProperty({
    description: 'Reason for transfer',
    example: 'Team member left, transferring to replacement',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    description: 'Whether to preserve the same end date',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  preserveEndDate?: boolean = true;

  @ApiProperty({
    description: 'New end date if not preserving',
    example: '2027-12-31T23:59:59.000Z',
    required: false,
  })
  @IsDateString()
  @ValidateIf((o) => !o.preserveEndDate)
  newEndDate?: string;
}
