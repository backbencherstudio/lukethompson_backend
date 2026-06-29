import { ApiProperty } from '@nestjs/swagger';

export class AuthMeUserDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'avatar-12345.png' })
  avatar: string;

  @ApiProperty({ example: 'http://localhost:2004/storage/avatar/avatar-12345.png' })
  avatar_url: string;

  @ApiProperty({ example: '+1234567890' })
  phone_number: string;

  @ApiProperty({ example: 'user' })
  type: string;

  @ApiProperty({ example: '2026-06-10T14:32:09.000Z' })
  created_at: string;
}

export class AuthMeResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User found successfully' })
  message: string;

  @ApiProperty({ type: AuthMeUserDto })
  data: AuthMeUserDto;
}

export class AuthLoginAuthorizationDto {
  @ApiProperty({ example: 'bearer' })
  type: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6...' })
  access_token: string;
}

export class AuthLoginUserDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'avatar-12345.png' })
  avatar: string;

  @ApiProperty({ example: '+1234567890' })
  phone_number: string;

  @ApiProperty({ example: '2026-06-10T14:32:09.000Z' })
  created_at: string;

  @ApiProperty({ example: 'user' })
  type: string;
}

export class AuthLoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Logged in successfully' })
  message: string;

  @ApiProperty({ type: AuthLoginAuthorizationDto })
  authorization: AuthLoginAuthorizationDto;

  @ApiProperty({ type: AuthLoginUserDto })
  user: AuthLoginUserDto;
}

export class AuthOtpSentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'We have sent an OTP code to your email' })
  message: string;
}

export class AuthVerificationEmailSentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'We have sent a verification code to your email' })
  message: string;
}

export class AuthUserUpdatedResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User updated successfully' })
  message: string;
}

export class AuthEmailVerifiedResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Email verified successfully' })
  message: string;
}

export class AuthOtpValidResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'OTP code is valid' })
  message: string;
}

export class AuthPasswordUpdatedResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Password updated successfully' })
  message: string;
}

export class AuthEmailUpdatedResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Email updated successfully' })
  message: string;
}
