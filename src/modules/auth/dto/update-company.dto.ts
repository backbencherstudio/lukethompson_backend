import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @ApiProperty({
    description: 'Company name',
    example: 'Nexus Logistics Inc.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company_name?: string;

  @ApiProperty({
    description: 'Contact person name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contact_name?: string;

  @ApiProperty({
    description: 'Company phone number',
    example: '+1 214-555-0199',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone_number?: string;

  @ApiProperty({
    description: 'Company email address',
    example: 'contact@nexuslogistics.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    description: 'Mailing address line 1',
    example: '123 Main Street',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line1?: string;

  @ApiProperty({
    description: 'Mailing address line 2 (optional)',
    example: 'Suite 100',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiProperty({
    description: 'City',
    example: 'Dallas',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({
    description: 'State/Province',
    example: 'Texas',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiProperty({
    description: 'Postal/ZIP code',
    example: '75201',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}
