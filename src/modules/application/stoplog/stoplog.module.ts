import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StopLogService } from './stoplog.service';
import { StopLogController } from './stoplog.controller';
import { PdfProcessor } from './processors/pdf.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pdf-queue',
    }),
  ],
  controllers: [StopLogController],
  providers: [StopLogService, PdfProcessor],
})
export class StopLogModule {}
