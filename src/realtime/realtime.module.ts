import { Module } from '@nestjs/common';
import { RealtimeGateway } from './gateway/realtime.gateway';
import { AuthJwtModule } from '../auth/jwt.module';
import { ConnectionService } from './gateway/connection.service';
import { RealtimeRoomsService } from './rooms/rooms.service';
import { RedisModule } from 'src/redis/redis.module';

/**
 * RealtimeModule
 *  - Aggregates all real-time related providers (gateway, connection tracking, rooms)
 *  - Future expansion: presence, matchmaking, tutoring, collaborative editing, etc.
 *  - Keep this module focused: external modules should depend only on exported services (e.g. RoomsService)
 */
@Module({
  imports: [AuthJwtModule, RedisModule],
  providers: [RealtimeGateway, ConnectionService, RealtimeRoomsService],
  exports: [RealtimeRoomsService], // export if other modules need to emit to rooms
})
export class RealtimeModule {}
