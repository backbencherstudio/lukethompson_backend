import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum BillingCycle {
  LIFETIME = 'lifetime',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class ManageEntitlementDto {
  @ApiProperty({
    description: 'Grant entitlement (true) or revoke entitlement (false)',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  grant: boolean;

  @ApiProperty({
    description: 'Identifier of the entitlement configured in RevenueCat',
    example: 'pro',
  })
  @IsString()
  @IsNotEmpty()
  entitlementIdentifier: string;

  @ApiPropertyOptional({
    description:
      'Billing duration. Lifetime sets a 100-year expiration in RevenueCat',
    enum: BillingCycle,
    default: BillingCycle.LIFETIME,
  })
  @IsEnum(BillingCycle)
  @IsOptional()
  duration?: BillingCycle = BillingCycle.LIFETIME;
}
