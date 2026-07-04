import { Module } from '@nestjs/common';
import { ContactModule } from './contact/contact.module';
import { TransactionModule } from './transaction/transaction.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { StopLogModule } from './stoplog/stoplog.module';
import { SettingModule } from './setting/setting.module';
import { OverviewModule } from './overview/overview.module';

@Module({
  imports: [
    ContactModule,
    TransactionModule,
    SubscriptionModule,
    UserModule,
    NotificationModule,
    StopLogModule,
    SettingModule,
    OverviewModule,
  ],
})
export class AdminModule {}
