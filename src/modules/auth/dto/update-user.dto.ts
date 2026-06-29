import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { RegisterUserDto } from './create-auth.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRegisteredUserDto extends PartialType(
  OmitType(RegisterUserDto, ['type', 'password', 'email']),
) {
  @ApiProperty({
    description: 'Phone number',
    example: '+91 9876543210',
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
