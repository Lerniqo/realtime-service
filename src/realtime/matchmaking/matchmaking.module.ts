import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchmakingWorker } from './matchmaking.worker';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [MatchmakingWorker],
  exports: [MatchmakingWorker],
})
export class MatchmakingModule {}
