import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { StopLogModule } from './stoplog/stoplog.module';
import { ClaimModule } from './claim/claim.module';
import { ShipperModule } from './shipper/shipper.module';

@Module({
  imports: [
    NotificationModule,
    ContactModule,
    StopLogModule,
    ClaimModule,
    ShipperModule,
  ],
})
export class ApplicationModule {}
