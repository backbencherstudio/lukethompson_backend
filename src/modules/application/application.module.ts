import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { StopLogModule } from './stoplog/stoplog.module';
import { ClaimModule } from './claim/claim.module';

@Module({
  imports: [NotificationModule, ContactModule, StopLogModule, ClaimModule],
})
export class ApplicationModule {}
