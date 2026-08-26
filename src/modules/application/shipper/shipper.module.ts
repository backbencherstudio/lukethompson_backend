import { Module } from '@nestjs/common';
import { ShipperService } from './shipper.service';
import { ShipperController } from './shipper.controller';
import { BrokerModule } from './brokers/broker.module';

@Module({
  imports: [BrokerModule],
  controllers: [ShipperController],
  providers: [ShipperService],
  exports: [BrokerModule],
})
export class ShipperModule {}
