import { Module } from '@nestjs/common';
import { RealtimeGateway } from './gateway/realtime.gateway';
import { ConnectionService } from './gateway/connection.service';
import { RealtimeRoomsService } from './rooms/rooms.service';
import { RedisModule } from 'src/redis/redis.module';
import { NotificationsService } from './notifications/notifications.service';
import { InternalNotifyController } from './notifications/internal-notify.controller';
import { MatchmakingService } from './matchmaking/matchmaking.service';
import { MatchmakingWorker } from './matchmaking/matchmaking.worker';
import { ScheduleModule } from '@nestjs/schedule';
import { ContentModule } from 'src/content/content.module';
import { SecretCodeService } from 'src/auth/secret-code.service';

/**
 * RealtimeModule
 *  - Aggregates all real-time related providers (gateway, connection tracking, rooms, notifications)
 *  - Future expansion: presence, matchmaking, tutoring, collaborative editing, etc.
 *  - Keep this module focused: external modules should depend only on exported services (e.g. RoomsService)
 */
@Module({
  imports: [
    RedisModule,
    ScheduleModule.forRoot(),
    ContentModule,
  ],
  controllers: [InternalNotifyController],
  providers: [
    RealtimeGateway,
    ConnectionService,
    RealtimeRoomsService,
    NotificationsService,
    MatchmakingService,
    MatchmakingWorker,
    SecretCodeService,
  ],
  exports: [RealtimeRoomsService, NotificationsService, RealtimeGateway], // export if other modules need to emit to rooms or send notifications
})
export class RealtimeModule {}
