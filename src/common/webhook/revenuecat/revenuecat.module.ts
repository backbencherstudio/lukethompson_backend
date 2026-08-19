import { Module } from '@nestjs/common';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Module({
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatWebhookService],
  exports: [RevenueCatWebhookService],
})
export class RevenueCatModule {}
