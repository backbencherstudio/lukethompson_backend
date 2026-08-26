import { Module } from '@nestjs/common';
import { BrokerService } from './broker.service';
import { BrokerController } from './brokers.controller';

@Module({
  controllers: [BrokerController],
  providers: [BrokerService],
  exports: [BrokerService],
})
export class BrokerModule {}
