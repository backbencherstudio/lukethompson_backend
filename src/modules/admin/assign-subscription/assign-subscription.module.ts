import { Module } from '@nestjs/common';
import { AssignSubscriptionController } from './assign-subscription.controller';
import { AssignSubscriptionService } from './assign-subscription.service';
import { RevenueCatModule } from 'src/common/webhook/revenuecat/revenuecat.module';

@Module({
  imports: [
    RevenueCatModule,
  ],
  controllers: [AssignSubscriptionController],
  providers: [AssignSubscriptionService],
  exports: [AssignSubscriptionService],
})
export class AssignSubscriptionModule {}
