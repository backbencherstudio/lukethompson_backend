import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { StopLogModule } from './stoplog/stoplog.module';

@Module({
  imports: [NotificationModule, ContactModule, StopLogModule],
})
export class ApplicationModule {}
