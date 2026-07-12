import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateClaimDto {
  @ApiPropertyOptional({ example: 135 })
  @IsOptional()
  @IsNumber()
  paid_amount?: number;

  @ApiPropertyOptional({ example: 'Broker Name' })
  @IsOptional()
  @IsString()
  denied_by?: string;

  @ApiPropertyOptional({ example: 'Reason for denial' })
  @IsOptional()
  @IsString()
  denial_reason?: string;
}

export class MarkPaidDto {
  @ApiPropertyOptional({
    example: 135,
    description: 'The amount actually paid',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paid_amount?: number;
}

export class MarkDeniedDto {
  @ApiProperty({
    example: 'Broker John Doe',
    description: 'Who denied the claim',
  })
  @IsOptional()
  @IsString()
  denied_by: string;

  @ApiProperty({
    example: 'Rate confirmation was not signed.',
    description: 'The reason for denial',
  })
  @IsOptional()
  @IsString()
  denial_reason: string;
}

export class SubmitClaimDto {
  @ApiProperty({
    example: 'EMAIL',
    enum: ['EMAIL', 'MESSAGE'],
    description: 'Submission method: EMAIL or MESSAGE',
  })
  @IsNotEmpty()
  @IsString()
  claim_method: string;

  @ApiProperty({
    example: 'broker@example.com',
    description: 'The email address of the recipient',
  })
  @IsNotEmpty()
  @IsString()
  recipient_email: string;

  @ApiPropertyOptional({
    example: 'broker-cc@example.com',
    description: 'Broker email to CC (optional)',
  })
  @IsOptional()
  @IsString()
  broker_email?: string;
}
