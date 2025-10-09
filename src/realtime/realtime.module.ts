import { Module } from '@nestjs/common';
import { RealtimeGateway } from './gateway/realtime.gateway';
import { AuthJwtModule } from '../auth/jwt.module';
import { ConnectionService } from './gateway/connection.service';
import { RealtimeRoomsService } from './rooms/rooms.service';
import { RedisModule } from 'src/redis/redis.module';
import { NotificationsService } from './notifications/notifications.service';
import { InternalNotifyController } from './notifications/internal-notify.controller';

/**
 * RealtimeModule
 *  - Aggregates all real-time related providers (gateway, connection tracking, rooms, notifications)
 *  - Future expansion: presence, matchmaking, tutoring, collaborative editing, etc.
 *  - Keep this module focused: external modules should depend only on exported services (e.g. RoomsService)
 */
@Module({
  imports: [AuthJwtModule, RedisModule],
  controllers: [InternalNotifyController],
  providers: [
    RealtimeGateway,
    ConnectionService,
    RealtimeRoomsService,
    NotificationsService,
  ],
  exports: [RealtimeRoomsService, NotificationsService], // export if other modules need to emit to rooms or send notifications
})
export class RealtimeModule {}
