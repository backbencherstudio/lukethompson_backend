import { Module } from '@nestjs/common';
import { ContactModule } from './contact/contact.module';
import { PaymentTransactionModule } from './payment-transaction/payment-transaction.module';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { StopLogModule } from './stoplog/stoplog.module';

@Module({
  imports: [
    ContactModule,
    PaymentTransactionModule,
    UserModule,
    NotificationModule,
    StopLogModule,
  ],
})
export class AdminModule {}



