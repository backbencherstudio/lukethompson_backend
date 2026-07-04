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
