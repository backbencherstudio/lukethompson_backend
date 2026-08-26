// external imports
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

//internal imports
import appConfig from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { UcodeRepository } from '../../common/repository/ucode/ucode.repository';
import { MailService } from '../../mail/mail.service';
import { UpdateRegisteredUserDto } from './dto/update-user.dto';
import { NajimStorage } from '../../common/lib/Disk/NajimStorage';
import { StripePayment } from '../../common/lib/Payment/stripe/StripePayment';
import {
  ChangePasswordDto,
  RegisterUserDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
    private userRepository: UserRepository,
    private ucodeRepository: UcodeRepository,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone_number: true,
        rate_per_hour: true,
        free_wait_time: true,
        type: true,
        created_at: true,
        updated_at: true,
        // Include company info
        company_info: {
          select: {
            company_name: true,
            contact_name: true,
            phone_number: true,
            email: true,
            address_line1: true,
            address_line2: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prepare response object
    const response: any = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone_number: user.phone_number,
      rate_per_hour: user.rate_per_hour,
      free_wait_time: user.free_wait_time,
      type: user.type,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    // Add avatar URL if exists
    if (user.avatar) {
      response.avatar = NajimStorage.url(
        appConfig().storageUrl.avatar + user.avatar,
        { signed: true },
      );
    } else {
      response.avatar = null;
    }

    // Add company info if exists
    if (user.company_info) {
      response.company = {
        company_name: user.company_info.company_name,
        contact_name: user.company_info.contact_name,
        phone_number: user.company_info.phone_number,
        email: user.company_info.email,
        address: {
          address_line1: user.company_info.address_line1,
          address_line2: user.company_info.address_line2,
          city: user.company_info.city,
          state: user.company_info.state,
          postal_code: user.company_info.postal_code,
          country: user.company_info.country,
        },
      };
    } else {
      response.company = null;
    }

    return {
      success: true,
      message: 'User found successfully',
      data: response,
    };
  }

  async updateUser(
    userId: string,
    UpdateRegisteredUserDto: UpdateRegisteredUserDto,
    avatar?: Express.Multer.File,
  ) {
    const data: any = {};
    const companyData: any = {};

    // Handle user fields
    if (UpdateRegisteredUserDto.name) {
      data.name = UpdateRegisteredUserDto.name;
    }

    if (UpdateRegisteredUserDto.phone_number) {
      data.phone_number = UpdateRegisteredUserDto.phone_number;
    }

    if (UpdateRegisteredUserDto.free_wait_time !== undefined) {
      data.free_wait_time = UpdateRegisteredUserDto.free_wait_time;
    }

    if (UpdateRegisteredUserDto.rate_per_hour !== undefined) {
      data.rate_per_hour = UpdateRegisteredUserDto.rate_per_hour;
    }

    // Handle avatar
    if (avatar) {
      // delete old image from storage
      const oldImage = await this.prisma.user.findFirst({
        where: { id: userId },
        select: { avatar: true },
      });
      if (oldImage?.avatar) {
        await NajimStorage.delete(
          appConfig().storageUrl.avatar + oldImage.avatar,
        );
      }

      // upload file
      const fileName = NajimStorage.generateFilename(avatar.originalname);
      await NajimStorage.put(
        appConfig().storageUrl.avatar + fileName,
        avatar.buffer,
      );

      data.avatar = fileName;
    }

    // Handle company data
    if (UpdateRegisteredUserDto.company) {
      const company = UpdateRegisteredUserDto.company;
      if (company.company_name) companyData.company_name = company.company_name;
      if (company.contact_name) companyData.contact_name = company.contact_name;
      if (company.phone_number) companyData.phone_number = company.phone_number;
      if (company.email) companyData.email = company.email;
      if (company.address_line1)
        companyData.address_line1 = company.address_line1;
      if (company.address_line2)
        companyData.address_line2 = company.address_line2;
      if (company.city) companyData.city = company.city;
      if (company.state) companyData.state = company.state;
      if (company.postal_code) companyData.postal_code = company.postal_code;
      if (company.country) companyData.country = company.country;
    }

    const user = await this.userRepository.getUserDetails(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update user
    if (Object.keys(data).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: data,
      });
    }

    // Update or create company info
    if (Object.keys(companyData).length > 0) {
      await this.prisma.userCompany.upsert({
        where: {
          user_id: userId,
        },
        update: companyData,
        create: {
          user_id: userId,
          ...companyData,
        },
      });
    }

    return {
      success: true,
      message: 'User updated successfully',
    };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const _password = pass;
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    if (user) {
      const _isValidPassword = await this.userRepository.validatePassword({
        email: email,
        password: _password,
      });
      if (_isValidPassword) {
        const { password, ...result } = user;

        return result;
      } else {
        throw new UnauthorizedException('Password not matched');
      }
    } else {
      throw new NotFoundException('Email not found');
    }
  }

  async login({ email, userId }) {
    const payload = { email: email, sub: userId };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const user = await this.userRepository.getUserDetails(userId);
    return {
      success: true,
      message: 'Logged in successfully',
      authorization: {
        type: 'bearer',
        access_token: accessToken,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone_number: user.phone_number,
        created_at: user.created_at,
        type: user.type,
      },
    };
  }

  async register(registerUserDto: RegisterUserDto) {
    // Check if email already exist

    const { name, email, password, type, free_wait_time, rate_per_hour } =
      registerUserDto;
    const userEmailExist = await this.userRepository.exist({
      field: 'email',
      value: String(email),
    });

    if (userEmailExist) {
      throw new BadRequestException('Email already exist');
    }

    const user = await this.userRepository.createUser({
      name: name,
      email: email,
      password: password,
      free_wait_time,
      rate_per_hour,
      type,
    });

    // create stripe customer account
    let stripeCustomer = null;
    try {
      stripeCustomer = await StripePayment.createCustomer({
        user_id: user.id,
        email: email,
        name: name,
      });
    } catch (stripeError: any) {
      console.error('Stripe customer creation failed:', stripeError.message);
    }

    if (stripeCustomer) {
      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          billing_id: stripeCustomer.id,
        },
      });
    }

    // ----------------------------------------------------
    // // create otp code
    const token = await this.ucodeRepository.createToken({
      userId: user.id,
      isOtp: true,
    });

    // // send otp code to email
    await this.mailService.sendOtpCodeToEmail({
      email: email,
      name: name,
      otp: token,
    });

    return {
      success: true,
      message: 'We have sent an OTP code to your email',
    };

    // ----------------------------------------------------

    // Generate verification token
    // const token = await this.ucodeRepository.createVerificationToken({
    //   userId: user.data.id,
    //   email: email,
    // });

    // Send verification email with token
    // await this.mailService.sendVerificationLink({
    //   email,
    //   name: email,
    //   token: token.token,
    //   type: type,
    // });

    // return {
    //   success: true,
    //   message: 'We have sent a verification link to your email',
    // };
  }

  async forgotPassword(email) {
    const user = await this.userRepository.exist({
      field: 'email',
      value: email,
    });

    if (user) {
      const token = await this.ucodeRepository.createToken({
        userId: user.id,
        isOtp: true,
      });

      await this.mailService.sendOtpCodeToEmail({
        email: email,
        name: user.name,
        otp: token,
      });

      return {
        success: true,
        message: 'We have sent an OTP code to your email',
      };
    } else {
      throw new BadRequestException('Email not found');
    }
  }

  async resetPassword({ email, token, password }: ResetPasswordDto) {
    const user = await this.userRepository.exist({
      field: 'email',
      value: email,
    });

    if (user) {
      const existToken = await this.ucodeRepository.validateToken({
        email: email,
        token: token,
      });

      if (existToken) {
        await this.userRepository.changePassword({
          email: email,
          password: password,
        });

        // delete otp code
        await this.ucodeRepository.deleteToken({
          email: email,
          token: token,
        });

        return {
          success: true,
          message: 'Password updated successfully',
        };
      } else {
        throw new BadRequestException('Invalid token');
      }
    } else {
      throw new NotFoundException('Email not found');
    }
  }
  async checkOTPValidity({ email, token }: VerifyEmailDto) {
    const user = await this.userRepository.exist({
      field: 'email',
      value: email,
    });

    if (user) {
      const existToken = await this.ucodeRepository.validateToken({
        email: email,
        token: token,
      });

      if (existToken) {
        return {
          success: true,
          message: 'OTP code is valid',
        };
      } else {
        throw new BadRequestException('Invalid token');
      }
    } else {
      throw new NotFoundException('Email not found');
    }
  }

  async verifyEmail({ email, token }: VerifyEmailDto) {
    const user = await this.userRepository.exist({
      field: 'email',
      value: email,
    });

    if (user) {
      const existToken = await this.ucodeRepository.validateToken({
        email: email,
        token: token,
      });

      if (existToken) {
        await this.prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            email_verified_at: new Date(Date.now()),
          },
        });

        // delete otp code
        await this.ucodeRepository.deleteToken({
          email: email,
          token: token,
        });

        return {
          success: true,
          message: 'Email verified successfully',
        };
      } else {
        throw new BadRequestException('Invalid token');
      }
    } else {
      throw new NotFoundException('Email not found');
    }
  }

  async resendVerificationEmail(email: string) {
    const user = await this.userRepository.getUserByEmail(email);

    if (user) {
      // create otp code
      const token = await this.ucodeRepository.createToken({
        userId: user.id,
        isOtp: true,
      });

      // send otp code to email
      await this.mailService.sendOtpCodeToEmail({
        email: email,
        name: user.name,
        otp: token,
      });

      return {
        success: true,
        message: 'We have sent a verification code to your email',
      };
    } else {
      throw new NotFoundException('Email not found');
    }
  }

  async changePassword({
    user_id,
    old_password,
    new_password,
  }: ChangePasswordDto & { user_id: string }) {
    const user = await this.userRepository.getUserDetails(user_id);

    if (user) {
      const _isValidPassword = await this.userRepository.validatePassword({
        email: user.email,
        password: old_password,
      });
      if (_isValidPassword) {
        await this.userRepository.changePassword({
          email: user.email,
          password: new_password,
        });

        return {
          success: true,
          message: 'Password updated successfully',
        };
      } else {
        throw new BadRequestException('Invalid credentials');
      }
    } else {
      throw new BadRequestException('Invalid credentials');
    }
  }

  async requestEmailChange(user_id: string, email: string) {
    const user = await this.userRepository.getUserDetails(user_id);
    if (user) {
      const token = await this.ucodeRepository.createToken({
        userId: user.id,
        isOtp: true,
        email: email,
      });

      await this.mailService.sendOtpCodeToEmail({
        email: email,
        name: email,
        otp: token,
      });

      return {
        success: true,
        message: 'We have sent an OTP code to your email',
      };
    } else {
      throw new NotFoundException('User not found');
    }
  }

  async changeEmail({
    user_id,
    new_email,
    token,
  }: {
    user_id: string;
    new_email: string;
    token: string;
  }) {
    const user = await this.userRepository.getUserDetails(user_id);

    if (user) {
      const existToken = await this.ucodeRepository.validateToken({
        email: new_email,
        token: token,
        forEmailChange: true,
      });

      if (existToken) {
        await this.userRepository.changeEmail({
          user_id: user.id,
          new_email: new_email,
        });

        // delete otp code
        await this.ucodeRepository.deleteToken({
          email: new_email,
          token: token,
        });

        return {
          success: true,
          message: 'Email updated successfully',
        };
      } else {
        throw new BadRequestException('Invalid token');
      }
    } else {
      throw new NotFoundException('User not found');
    }
  }
}
