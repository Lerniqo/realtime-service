import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchmakingWorker } from './matchmaking.worker';
import { RedisModule } from 'src/redis/redis.module';
import { RealtimeRoomsService } from '../rooms/rooms.service';

@Module({
  imports: [ScheduleModule.forRoot(), RedisModule],
  providers: [MatchmakingWorker, RealtimeRoomsService],
  exports: [MatchmakingWorker],
})
export class MatchmakingModule {}
