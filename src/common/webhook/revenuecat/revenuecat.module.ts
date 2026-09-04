import { Module } from '@nestjs/common';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';
import { RevenueCatService } from './revenuecat.service';

@Module({
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatWebhookService, RevenueCatService],
  exports: [RevenueCatWebhookService, RevenueCatService],
})
export class RevenueCatModule {}
