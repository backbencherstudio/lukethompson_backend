import { Module } from '@nestjs/common';
import { SpotlogService } from './spotlog.service';
import { SpotlogController } from './spotlog.controller';

@Module({
  controllers: [SpotlogController],
  providers: [SpotlogService],
})
export class SpotlogModule {}
