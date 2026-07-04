import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import {
  CreateSubscriptionPlanDto,
  CreateUserSubscriptionDto,
} from './dto/create-subscription.dto';
import {
  UpdateSubscriptionPlanDto,
  UpdateUserSubscriptionDto,
} from './dto/update-subscription.dto';

@ApiBearerAuth()
@ApiTags('Admin Subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ==========================================
  // PLANS ENDPOINTS
  // ==========================================

  @ApiOperation({ summary: 'Create a new subscription plan' })
  @Post('plans')
  createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionService.createPlan(dto);
  }

  @ApiOperation({ summary: 'Get all subscription plans' })
  @Get('plans')
  findAllPlans() {
    return this.subscriptionService.findAllPlans();
  }

  @ApiOperation({ summary: 'Get single subscription plan by ID' })
  @Get('plans/:plan_id')
  findOnePlan(@Param('plan_id') plan_id: string) {
    return this.subscriptionService.findOnePlan(plan_id);
  }

  @ApiOperation({ summary: 'Update a subscription plan' })
  @Patch('plans/:plan_id')
  updatePlan(
    @Param('plan_id') plan_id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionService.updatePlan(plan_id, dto);
  }

  @ApiOperation({ summary: 'Delete a subscription plan' })
  @Delete('plans/:plan_id')
  removePlan(@Param('plan_id') plan_id: string) {
    return this.subscriptionService.removePlan(plan_id);
  }

  // ==========================================
  // FEATURES ENDPOINTS
  // ==========================================

  @ApiOperation({ summary: 'Get all subscription features' })
  @Get('features')
  findAllFeatures() {
    return this.subscriptionService.findAllFeatures();
  }

  @ApiOperation({ summary: 'Get single subscription feature by ID' })
  @Get('features/:feature_id')
  findOneFeature(@Param('feature_id') feature_id: string) {
    return this.subscriptionService.findOneFeature(feature_id);
  }

  // ==========================================
  // USER SUBSCRIPTIONS ENDPOINTS
  // ==========================================

  @ApiOperation({ summary: 'Assign a subscription to a user' })
  @Post('user-subscriptions')
  createUserSubscription(@Body() dto: CreateUserSubscriptionDto) {
    return this.subscriptionService.createUserSubscription(dto);
  }

  @ApiOperation({ summary: 'Get all user subscriptions' })
  @Get('user-subscriptions')
  findAllUserSubscriptions() {
    return this.subscriptionService.findAllUserSubscriptions();
  }

  @ApiOperation({ summary: 'Get single user subscription by ID' })
  @Get('user-subscriptions/:user_subscription_id')
  findOneUserSubscription(
    @Param('user_subscription_id') user_subscription_id: string,
  ) {
    return this.subscriptionService.findOneUserSubscription(
      user_subscription_id,
    );
  }

  @ApiOperation({ summary: 'Update user subscription status or dates' })
  @Patch('user-subscriptions/:user_subscription_id')
  updateUserSubscription(
    @Param('user_subscription_id') user_subscription_id: string,
    @Body() dto: UpdateUserSubscriptionDto,
  ) {
    return this.subscriptionService.updateUserSubscription(
      user_subscription_id,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a user subscription' })
  @Delete('user-subscriptions/:user_subscription_id')
  removeUserSubscription(
    @Param('user_subscription_id') user_subscription_id: string,
  ) {
    return this.subscriptionService.removeUserSubscription(
      user_subscription_id,
    );
  }
}
