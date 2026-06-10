import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { RegisterUserDto } from './create-auth.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends PartialType(
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
    description: 'Avatar',
    type: 'string',
    format: 'binary',
    example: 'avatar.jpg',
    required: false,
  })
  avatar?: Express.Multer.File;
}
