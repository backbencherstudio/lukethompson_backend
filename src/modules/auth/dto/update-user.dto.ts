import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { UpdateCompanyDto } from './update-company.dto';

export class UpdateRegisteredUserDto {
  @ApiProperty({
    description: 'Name',
    example: 'user',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: Number,
    description: 'Free wait time in hours',
    example: 2,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  free_wait_time?: number;

  @ApiProperty({
    type: Number,
    description: 'Rate per hour after free wait time',
    example: 100,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  rate_per_hour?: number;

  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiProperty({
    description: 'Avatar image file',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  image?: Express.Multer.File;

  @ApiProperty({
    description: 'Company information (JSON string)',
    type: String, // Change to String since it's sent as JSON string
    required: false,
    example:
      '{"company_name":"Nexus Logistics Inc.","contact_name":"John Doe","phone_number":"+1 214-555-0199","email":"contact@nexuslogistics.com","address_line1":"123 Main Street","address_line2":"Suite 100","city":"Dallas","state":"Texas","postal_code":"75201","country":"United States"}',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        // Return original value, will be caught by validation
        return value;
      }
    }
    return value;
  })
  @ValidateNested()
  @Type(() => UpdateCompanyDto)
  company?: UpdateCompanyDto;
}
