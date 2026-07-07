import { Module } from '@nestjs/common';
import { ContactModule } from './contact/contact.module';
import { StopLogModule } from './stoplog/stoplog.module';
import { ClaimModule } from './claim/claim.module';
import { ShipperModule } from './shipper/shipper.module';
import { SubscriptionModule } from './subscription/subscription.module';

@Module({
  imports: [
    ContactModule,
    StopLogModule,
    ClaimModule,
    ShipperModule,
    SubscriptionModule,
  ],
})
export class ApplicationModule {}
