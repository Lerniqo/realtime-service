import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchmakingWorker } from './matchmaking.worker';
import { RedisModule } from 'src/redis/redis.module';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { AiServiceModule } from 'src/ai-service/ai-service.module';

@Module({
  imports: [ScheduleModule.forRoot(), RedisModule, AiServiceModule],
  providers: [MatchmakingWorker, RealtimeRoomsService],
  exports: [MatchmakingWorker],
})
export class MatchmakingModule {}
