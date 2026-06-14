import { Module } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { ClaimController } from './claim.controller';

@Module({
  controllers: [ClaimController],
  providers: [ClaimService],
})
export class ClaimModule {}
