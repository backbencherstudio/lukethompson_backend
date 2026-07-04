import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionSyncCron } from './subscription-sync.cron';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionSyncCron],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
