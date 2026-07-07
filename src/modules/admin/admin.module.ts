import { Module } from '@nestjs/common';
import { ContactModule } from './contact/contact.module';
import { TransactionModule } from './transaction/transaction.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { UserModule } from './user/user.module';
import { StopLogModule } from './stoplog/stoplog.module';
import { SettingModule } from './setting/setting.module';
import { OverviewModule } from './overview/overview.module';
import { ShipperModule } from './shipper/shipper.module';

@Module({
  imports: [
    ContactModule,
    TransactionModule,
    SubscriptionModule,
    UserModule,
    StopLogModule,
    SettingModule,
    OverviewModule,
    ShipperModule,
  ],
})
export class AdminModule {}
