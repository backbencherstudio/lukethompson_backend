import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import {
  ChangeEmailAddressDto,
  ChangePasswordDto,
  RegisterUserDto,
  EmailChangeRequestDto,
  ForgotPasswordDto,
  LoginDto,
  ResendVerificationEmailDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/create-auth.dto';
import { UpdateRegisteredUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import {
  AuthMeResponseDto,
  AuthLoginResponseDto,
  AuthOtpSentResponseDto,
  AuthVerificationEmailSentResponseDto,
  AuthUserUpdatedResponseDto,
  AuthEmailVerifiedResponseDto,
  AuthOtpValidResponseDto,
  AuthPasswordUpdatedResponseDto,
  AuthEmailUpdatedResponseDto,
} from './dto/response-auth.dto';
import { ParseCompanyPipe } from 'src/common/pipe/parseCompanyPipe';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: 'Get current user profile details',
    description:
      'Fetches profile information of the currently logged-in user. Requires a valid JWT token (either user_token or admin_token) in the Authorization header. Returns user identity, avatar path, role type, and metadata.',
  })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully.',
    type: AuthMeResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@GetUser('id') user_id: string) {
    return this.authService.me(user_id);
  }

  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a new user account in the system database. Performs a check to ensure email uniqueness. Upon successful creation, it automatically initializes a customer profile in Stripe for billing purposes and sends an OTP verification code to the registered email address.',
  })
  @ApiCreatedResponse({
    description: 'User registered successfully. OTP sent to email.',
    type: AuthOtpSentResponseDto,
  })
  @Post('register')
  create(@Body() data: RegisterUserDto) {
    return this.authService.register(data);
  }

  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary: 'Authenticate / Login user',
    description:
      'Logs in a user or administrator using their registered email and password credentials. On success, returns a JWT access token and the user profile summary.',
  })
  @ApiResponse({
    status: 201,
    description:
      'User logged in successfully. Returns access token and user details.',
    type: AuthLoginResponseDto,
  })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Req() req: Request) {
    return this.authService.login({
      userId: req?.user?.id,
      email: req?.user?.email,
    });
  }

  @ApiOperation({
    summary: 'Update profile info',
    description:
      'Updates basic user details (name, phone number, and avatar image) and company information. Note: Avatar images are uploaded to the S3 bucket, and any previous avatar image file is automatically cleaned up/deleted from the storage driver. Requires JWT authorization.',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully.',
    type: AuthUserUpdatedResponseDto,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateRegisteredUserDto })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  async updateUser(
    @Req() req: Request,
    @Body(ParseCompanyPipe) data: UpdateRegisteredUserDto,
    @UploadedFile() avatar: Express.Multer.File,
  ) {
    // Parse company if it's a string
    if (data.company && typeof data.company === 'string') {
      try {
        data.company = JSON.parse(data.company);
      } catch (e) {
        throw new BadRequestException('Invalid company data format');
      }
    }

    return this.authService.updateUser(req?.user?.id, data, avatar);
  }

  @ApiOperation({
    summary: 'Request password reset OTP',
    description:
      'Initiates password recovery. If the email exists in the database, generates a password reset OTP verification code and sends it via email.',
  })
  @ApiResponse({
    status: 201,
    description: 'Password reset link sent successfully.',
    type: AuthOtpSentResponseDto,
  })
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @ApiOperation({
    summary: 'Verify user email address',
    description:
      'Verifies the user email address using the registration OTP token. On success, sets the email_verified_at timestamp and deletes the OTP code.',
  })
  @ApiResponse({
    status: 201,
    description: 'Email verified successfully.',
    type: AuthEmailVerifiedResponseDto,
  })
  @Post('verify-email')
  async verifyEmail(@Body() data: VerifyEmailDto) {
    return await this.authService.verifyEmail(data);
  }

  @ApiOperation({
    summary: 'Resend registration verification OTP',
    description:
      'Generates and sends a new registration verification OTP code to the requested email if the user exists.',
  })
  @ApiResponse({
    status: 201,
    description: 'Verification email sent successfully.',
    type: AuthVerificationEmailSentResponseDto,
  })
  @Post('resend-verification-email')
  async resendVerificationEmail(
    @Body() resendVerificationEmailDto: ResendVerificationEmailDto,
  ) {
    return await this.authService.resendVerificationEmail(
      resendVerificationEmailDto.email,
    );
  }

  @ApiOperation({
    summary: 'Verify OTP validity',
    description:
      'Verifies whether the provided OTP token is valid and active for the specified email without performing any final operations (e.g. email verification or password reset). Useful for front-end multi-step wizard checks.',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP validity checked successfully.',
    type: AuthOtpValidResponseDto,
  })
  @Post('check-otp')
  checkOTPValidity(@Body() data: VerifyEmailDto) {
    return this.authService.checkOTPValidity(data);
  }

  @ApiOperation({
    summary: 'Reset password using OTP',
    description:
      "Resets the user's password. Validates the recovery OTP code and applies the new password. Deletes the OTP code on success.",
  })
  @ApiResponse({
    status: 201,
    description: 'Password updated successfully.',
    type: AuthPasswordUpdatedResponseDto,
  })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  @ApiOperation({
    summary: 'Change account password',
    description:
      'Allows logged-in users to update their password. Validates their current password before saving the new one. Requires JWT authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Password updated successfully.',
    type: AuthPasswordUpdatedResponseDto,
  })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword({
      ...changePasswordDto,
      user_id: req.user.id,
    });
  }

  @ApiOperation({
    summary: 'Request email address change',
    description:
      'Initiates an email address change flow. Generates an OTP verification code and sends it to the newly requested email address to verify its ownership. Requires JWT authorization.',
  })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @ApiResponse({
    status: 201,
    description: 'Request email change OTP code sent successfully.',
    type: AuthOtpSentResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Post('request-email-change')
  async requestEmailChange(
    @Req() req: Request,
    @Body() emailChangeRequestDto: EmailChangeRequestDto,
  ) {
    const user_id = req.user.id;
    return await this.authService.requestEmailChange(
      user_id,
      emailChangeRequestDto.email,
    );
  }

  @ApiOperation({
    summary: 'Confirm email address change',
    description:
      "Confirms the email address change request. Validates the OTP verification token sent to the new email address. If valid, updates the user's email to the new address and deletes the OTP code. Requires JWT authorization.",
  })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @ApiResponse({
    status: 201,
    description: 'Email updated successfully.',
    type: AuthEmailUpdatedResponseDto,
  })
  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  async changeEmail(
    @Req() req: Request,
    @Body() changeEmailAddressDto: ChangeEmailAddressDto,
  ) {
    const user_id = req.user.id;
    return await this.authService.changeEmail({
      user_id,
      new_email: changeEmailAddressDto.email,
      token: changeEmailAddressDto.token,
    });
  }
}
