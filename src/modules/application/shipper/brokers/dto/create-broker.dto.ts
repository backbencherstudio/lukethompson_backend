// dto/create-broker.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBrokerDto {
  @ApiProperty({
    description: 'Broker company name',
    example: 'Smith Logistics Inc.',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Broker email address',
    example: 'contact@smithlogistics.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Broker phone number',
    example: '+1-555-123-4567',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Broker ID (MC number or internal identifier)',
    example: 'MC-123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  brokerId?: string;

  @ApiProperty({
    description: 'Broker address',
    example: '123 Logistics Blvd',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Broker city',
    example: 'Dallas',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'Broker state',
    example: 'Texas',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Broker postal code',
    example: '75201',
    required: false,
  })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiProperty({
    description: 'Broker country',
    example: 'United States',
    default: 'USA',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;
}
