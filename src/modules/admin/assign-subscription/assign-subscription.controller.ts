import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  GrantSubscriptionDto,
  RevokeSubscriptionDto,
  ExtendSubscriptionDto,
  QuerySubscriptionDto,
} from './dto/assign-subscription.dto';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssignSubscriptionService } from './assign-subscription.service';

@ApiBearerAuth('admin_token')
@ApiTags('Admin Assign Subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/assign-subscription')
export class AssignSubscriptionController {
  constructor(
    private readonly assignSubscriptionService: AssignSubscriptionService,
  ) {}

  @ApiOperation({
    summary: 'Grant subscription to user',
    description:
      'Admin grants a subscription entitlement to a specific user with custom duration.',
  })
  @Post('grant')
  async grantSubscription(@Body() grantDto: GrantSubscriptionDto) {
    try {
      if (!grantDto.userId) {
        throw new BadRequestException('userId is required');
      }
      if (!grantDto.entitlementId) {
        throw new BadRequestException('entitlementId is required');
      }
      const result =
        await this.assignSubscriptionService.grantSubscription(grantDto);
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({
    summary: 'Revoke subscription from user',
    description: 'Admin revokes an active subscription from a user.',
  })
  @Post('revoke')
  async revokeSubscription(@Body() revokeDto: RevokeSubscriptionDto) {
    try {
      if (!revokeDto.userId) {
        throw new BadRequestException('userId is required');
      }
      if (!revokeDto.entitlementId) {
        throw new BadRequestException('entitlementId is required');
      }
      const result =
        await this.assignSubscriptionService.revokeSubscription(revokeDto);
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({
    summary: 'Extend user subscription',
    description: 'Admin extends an existing subscription by a number of days.',
  })
  @Post('extend')
  async extendSubscription(@Body() extendDto: ExtendSubscriptionDto) {
    try {
      if (!extendDto.userId) {
        throw new BadRequestException('userId is required');
      }
      if (!extendDto.entitlementId) {
        throw new BadRequestException('entitlementId is required');
      }
      if (!extendDto.extensionDays || extendDto.extensionDays <= 0) {
        throw new BadRequestException('extensionDays must be greater than 0');
      }
      const result =
        await this.assignSubscriptionService.extendSubscription(extendDto);
      return result;
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({
    summary: 'Retrieve all subscriptions',
    description:
      'Fetches a list of all subscriptions. Supports query filtering by status and user.',
  })
  @Get()
  async findAll(@Query() query: QuerySubscriptionDto) {
    return await this.assignSubscriptionService.findAll(query);
  }

  @ApiOperation({
    summary: 'Retrieve subscription by ID',
    description:
      'Fetches detailed information for a specific subscription by its ID.',
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignSubscriptionService.findOne(id);
  }

  @ApiOperation({
    summary: 'Get all subscriptions for a user',
    description:
      'Get all subscriptions (active and expired) for a specific user.',
  })
  @Get('user/:userId')
  async getUserSubscriptions(@Param('userId') userId: string) {
    return this.assignSubscriptionService.getUserSubscriptions(userId);
  }

  @ApiOperation({
    summary: 'Get subscription history for a user',
    description: 'Get complete subscription history for a user.',
  })
  @Get('history/:userId')
  async getSubscriptionHistory(@Param('userId') userId: string) {
    return this.assignSubscriptionService.getSubscriptionHistory(userId);
  }

  @ApiOperation({
    summary: 'Check if user has active subscription',
    description:
      'Check if a user has an active subscription for a specific entitlement.',
  })
  @Get('check/:userId/:entitlementId')
  async checkUserSubscription(
    @Param('userId') userId: string,
    @Param('entitlementId') entitlementId: string,
  ) {
    return this.assignSubscriptionService.checkUserSubscription(
      userId,
      entitlementId,
    );
  }

  @ApiOperation({
    summary: 'Get available entitlements',
    description: 'Get list of all entitlements that can be granted.',
  })
  @Get('entitlements/list')
  async getAvailableEntitlements() {
    return this.assignSubscriptionService.getAvailableEntitlements();
  }
}
