import { Module } from '@nestjs/common';
import { RealtimeGateway } from './gateway/realtime.gateway';
import { AuthJwtModule } from '../auth/jwt.module';
import { ConnectionService } from './gateway/connection.service';
import { RoomsService } from './rooms/rooms.service';

/**
 * RealtimeModule
 *  - Aggregates all real-time related providers (gateway, connection tracking, rooms)
 *  - Future expansion: presence, matchmaking, tutoring, collaborative editing, etc.
 *  - Keep this module focused: external modules should depend only on exported services (e.g. RoomsService)
 */
@Module({
  imports: [AuthJwtModule],
  providers: [RealtimeGateway, ConnectionService, RoomsService],
  exports: [RoomsService], // export if other modules need to emit to rooms
})
export class RealtimeModule {}
