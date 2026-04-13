import { Module } from '@nestjs/common';
import { ContactModule } from './contact/contact.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { SpotlogModule } from './spotlog/spotlog.module';

@Module({
  imports: [
    ContactModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    SpotlogModule,
  ],
})
export class AdminModule {}
