import { Module } from '@nestjs/common';
import { NotificationModule } from './notification/notification.module';
import { ContactModule } from './contact/contact.module';
import { SpotlogModule } from './spotlog/spotlog.module';

@Module({
  imports: [NotificationModule, ContactModule, SpotlogModule],
})
export class ApplicationModule {}
