import { Module } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { ClaimController } from './claim.controller';
import { ClaimProcessCron } from './claim-process.cron';

@Module({
  controllers: [ClaimController],
  providers: [ClaimService, ClaimProcessCron],
})
export class ClaimModule {}
