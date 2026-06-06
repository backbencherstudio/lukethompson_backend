import { Module } from '@nestjs/common';
import { StopLogService } from './stoplog.service';
import { StopLogController } from './stoplog.controller';

@Module({
  controllers: [StopLogController],
  providers: [StopLogService],
})
export class StopLogModule {}
