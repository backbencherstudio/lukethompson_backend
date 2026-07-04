import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionPlanResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message?: string;

  @ApiProperty()
  data: any;
}

export class SubscriptionFeatureResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message?: string;

  @ApiProperty()
  data: any;
}

export class UserSubscriptionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message?: string;

  @ApiProperty()
  data: any;
}
