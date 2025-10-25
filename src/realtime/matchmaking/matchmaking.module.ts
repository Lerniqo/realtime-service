import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchmakingWorker } from './matchmaking.worker';
import { RedisModule } from 'src/redis/redis.module';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { ContentModule } from 'src/content/content.module';

@Module({
  imports: [ScheduleModule.forRoot(), RedisModule, ContentModule],
  providers: [MatchmakingWorker, RealtimeRoomsService],
  exports: [MatchmakingWorker],
})
export class MatchmakingModule {}
