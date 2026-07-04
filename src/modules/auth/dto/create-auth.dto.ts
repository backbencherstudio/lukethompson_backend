import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/guard/role/role.enum';
import { Type } from 'class-transformer';

export class RegisterUserDto {
  @ApiProperty({
    type: String,
    description: 'Name',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    description: 'Password',
    example: '12345678',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  password: string;

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
    type: String,
    description: 'Role',
    enum: Role,
    examples: [Role.ADMIN, Role.USER],
    default: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  type?: Role;
}

export class LoginDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    description: 'Password',
    example: '12345678',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    description: 'Token',
    example: '123456',
  })
  @IsNotEmpty()
  @MinLength(6, { message: 'Token should be minimum 6' })
  token: string;

  @ApiProperty({
    type: String,
    description: 'Password',
    example: '12345678',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8' })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    type: String,
    description: 'Old password',
    example: '12345678',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'Old password should be minimum 8' })
  old_password: string;

  @ApiProperty({
    type: String,
    description: 'New password',
    example: '12345678',
  })
  @IsNotEmpty()
  @MinLength(8, { message: 'New password should be minimum 8' })
  new_password: string;
}

export class ResendVerificationEmailDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    description: 'Token',
    example: '123456',
  })
  @IsNotEmpty()
  @MinLength(6, { message: 'OTP should be minimum 6' })
  token: string;
}

export class EmailChangeRequestDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ChangeEmailAddressDto {
  @ApiProperty({
    type: String,
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    description: 'Token',
    example: '123456',
  })
  @IsNotEmpty()
  @MinLength(6, { message: 'Token should be minimum 6' })
  token: string;
}
