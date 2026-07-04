import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { RegisterUserDto } from './create-auth.dto';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @ApiProperty({
    description: 'Avatar image file',
    type: 'string',
    format: 'binary',
    required: false,
  })
  image?: Express.Multer.File;
}
