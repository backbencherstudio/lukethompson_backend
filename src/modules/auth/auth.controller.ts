import {
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
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Get user details' })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@GetUser('id') user_id: string) {
    return this.authService.me(user_id);
  }

  @ApiOperation({
    summary: 'Register a user',
    description:
      'Creates a new user account and sends an OTP verification code to the registered email address.',
  })
  @ApiCreatedResponse({
    description: 'User registered successfully. OTP sent to email.',
    schema: {
      example: {
        success: true,
        message: 'We have sent an OTP code to your email',
      },
    },
  })
  @Post('register')
  create(@Body() data: RegisterUserDto) {
    return this.authService.register(data);
  }

  @ApiBody({ type: LoginDto })
  @ApiOperation({
    summary: 'Login user',
    description:
      'Logs in a user with their email and password. Returns an access token and user details if credentials are valid.',
  })
  @ApiResponse({
    status: 200,
    description:
      'User logged in successfully. Returns access token and user details.',
    schema: {
      example: {
        success: true,
        message: 'Logged in successfully',
        authorization: {
          type: 'bearer',
          access_token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwic3ViIjoiMSIsImlhdCI6MTY3ODc5OTM4MywiZXhwIjoxNjc4Nzk5MzgzfQ',
        },
        type: 'user',
      },
    },
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
    summary: 'Update user',
    description: 'Update user details',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully.',
    schema: {
      example: {
        success: true,
        message: 'User updated successfully',
      },
    },
  })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
  @UseGuards(JwtAuthGuard)
  @Patch('update')
  @UseInterceptors(
    FileInterceptor('image', {
      // storage: diskStorage({
      //   destination:
      //     appConfig().storageUrl.rootUrl + appConfig().storageUrl.avatar,
      //   filename: (req, file, cb) => {
      //     const randomName = Array(32)
      //       .fill(null)
      //       .map(() => Math.round(Math.random() * 16).toString(16))
      //       .join('');
      //     return cb(null, `${randomName}${file.originalname}`);
      //   },
      // }),
      storage: memoryStorage(),
    }),
  )
  updateUser(
    @Req() req: Request,
    @Body() data: UpdateUserDto,
    @UploadedFile() avatar: Express.Multer.File,
  ) {
    return this.authService.updateUser(req?.user?.id, data, avatar);
  }

  @ApiOperation({
    summary: 'Forgot password',
    description: "Sends a password reset link to the user's email address.",
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset link sent successfully.',
    schema: {
      example: {
        success: true,
        message: 'We have sent an OTP code to your email',
      },
    },
  })
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @ApiOperation({
    summary: 'Verify email',
    description: 'Verify email address',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
    schema: {
      example: {
        success: true,
        message: 'Email verified successfully',
      },
    },
  })
  @Post('verify-email')
  async verifyEmail(@Body() data: VerifyEmailDto) {
    return await this.authService.verifyEmail(data);
  }

  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Resend verification email to the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully.',
    schema: {
      example: {
        success: true,
        message: 'We have sent a verification code to your email',
      },
    },
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
    summary: 'Check OTP validity',
    description: 'Check OTP validity',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP validity checked successfully.',
    schema: {
      example: {
        success: true,
        message: 'OTP validity checked successfully',
      },
    },
  })
  @Post('check-otp')
  checkOTPValidity(@Body() data: VerifyEmailDto) {
    return this.authService.checkOTPValidity(data);
  }

  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully.',
    schema: {
      example: {
        success: true,
        message: 'Password updated successfully',
      },
    },
  })
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  @ApiOperation({
    summary: 'Change password',
    description: 'Change password for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated successfully.',
    schema: {
      example: {
        success: true,
        message: 'Password updated successfully',
      },
    },
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

  @ApiOperation({ summary: 'request email change' })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
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

  @ApiOperation({ summary: 'Change email address' })
  @ApiBearerAuth('user_token')
  @ApiBearerAuth('admin_token')
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
