import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClaimService } from './claim.service';

@Injectable()
export class ClaimProcessCron {
  private readonly logger = new Logger(ClaimProcessCron.name);

  constructor(private readonly claimService: ClaimService) {}

  // Run every night at 3 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async processClaims() {
    this.logger.log('Starting nightly claim follow-up count auto-increment...');
    try {
      await this.claimService.processNightlyClaims();
      this.logger.log(
        'Nightly claim follow-up count auto-increment completed.',
      );
    } catch (error) {
      this.logger.error(
        `Error during nightly claim follow-up count auto-increment: ${error.message}`,
      );
    }
  }
}
