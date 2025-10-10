import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MatchmakingWorker {
  @Cron('*/2 * * * * *') // Run every 2 seconds
  handleMatchmaking() {
    console.log('New Match is made');
  }
}
