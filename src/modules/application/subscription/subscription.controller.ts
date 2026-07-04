import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { GetUser } from '../../../modules/auth/decorators/get-user.decorator';
import {
  CreateCheckoutSessionDto,
  CheckoutSessionResponseDto,
} from './dto/subscription.dto';

@ApiBearerAuth('user_token')
@ApiTags('Application Subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('application/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiOperation({ summary: 'Get all active subscription plans' })
  @Get('plans')
  findAllPlans() {
    return this.subscriptionService.findAllPlans();
  }

  @ApiOperation({ summary: 'Get driver current active subscription status' })
  @Get('current')
  getCurrentSubscription(@GetUser('id') user_id: string) {
    return this.subscriptionService.getCurrentSubscription(user_id);
  }

  @ApiOperation({ summary: 'Create checkout session for subscription' })
  @ApiResponse({
    status: 200,
    description: 'Checkout session created successfully',
    type: CheckoutSessionResponseDto,
  })
  @Post('checkout-session')
  createCheckoutSession(
    @GetUser('id') user_id: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.subscriptionService.createCheckoutSession(user_id, dto);
  }
}
