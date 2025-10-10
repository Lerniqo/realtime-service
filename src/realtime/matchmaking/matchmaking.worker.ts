import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { PinoLogger } from 'nestjs-pino';
import { GameType } from './dto/game-type.enum';
import { RealtimeGateway } from '../gateway/realtime.gateway';

@Injectable()
export class MatchmakingWorker {
  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RealtimeRoomsService,
    private readonly logger: PinoLogger,
    private readonly gateway: RealtimeGateway,
  ) {}

  @Cron('*/2 * * * * *') // Run every 2 seconds
  async handleMatchmaking() {
    try {
      const redisClient = this.redisService.getClient();

      // Get all game types and check their queues
      const gameTypes = Object.values(GameType);

      for (const gameType of gameTypes) {
        const queueKey = `matchmaking:queue:${gameType}`;

        // Get all client IDs in this queue
        const clientIds = await redisClient.lrange(queueKey, 0, -1);

        // If we have 2 or more clients, create a match
        if (clientIds.length >= 2) {
          // Take the first 2 clients
          const [clientId1, clientId2] = clientIds.slice(0, 2);

          // Remove them from the queue
          await redisClient.lrem(queueKey, 1, clientId1);
          await redisClient.lrem(queueKey, 1, clientId2);

          // Generate unique match ID
          const matchId = `match:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Get socket objects for the client IDs
          const socket1 = this.gateway.server.sockets.sockets.get(clientId1);
          const socket2 = this.gateway.server.sockets.sockets.get(clientId2);

          // Join both players to the match room if sockets are found
          if (socket1) {
            await this.roomsService.joinRoom(socket1, matchId);
          }
          if (socket2) {
            await this.roomsService.joinRoom(socket2, matchId);
          }

          // Notify both players that a match has been found
          this.gateway.notifyMatchFound(matchId, clientId1, clientId2);

          LoggerUtil.logInfo(
            this.logger,
            'matchmaking-worker',
            `New match room created: ${matchId} between ${clientId1} & ${clientId2}`,
            {
              roomId: matchId,
              clientIds: [clientId1, clientId2],
              gameType: gameType,
              socketsFound: { socket1: !!socket1, socket2: !!socket2 },
            },
          );
        }
      }
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'matchmaking-worker',
        'Error in handleMatchmaking',
        error,
      );
    }
  }
}
