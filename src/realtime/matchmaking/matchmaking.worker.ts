import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { PinoLogger } from 'nestjs-pino';
import { GameType } from './dto/game-type.enum';
import { RealtimeGateway } from '../gateway/realtime.gateway';
import { ContentService } from 'src/content/content.service';

@Injectable()
export class MatchmakingWorker {
  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RealtimeRoomsService,
    private readonly logger: PinoLogger,
    private readonly gateway: RealtimeGateway,
    private readonly contentService: ContentService,
  ) {}

  @Cron('*/2 * * * * *') // Run every 2 seconds
  async handleMatchmaking() {
    try {
      const redisClient = this.redisService.getClient();

      // Get all game types and check their queues
      const gameTypes = Object.values(GameType);

      for (const gameType of gameTypes) {
        const queueKey = `matchmaking:queue:${gameType}`;

        // Get all queue entries in this queue
        const queueEntries = await redisClient.lrange(queueKey, 0, -1);

        // If we have 2 or more clients, create a match
        if (queueEntries.length >= 2) {
          // Take the first 2 entries and parse them
          const [entry1, entry2] = queueEntries.slice(0, 2);
          const player1 = JSON.parse(entry1);
          const player2 = JSON.parse(entry2);

          const { clientId: clientId1, userId: userId1 } = player1;
          const { clientId: clientId2, userId: userId2 } = player2;

          // Remove them from the queue
          await redisClient.lrem(queueKey, 1, entry1);
          await redisClient.lrem(queueKey, 1, entry2);

          // Generate unique match ID
          const matchId = `match:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          // Get questions from content service
          const matchContent = await this.contentService.getMatchQuestions();

          // Store match data in Redis
          await this.storeMatchDataInRedis(
            matchId,
            matchContent,
            clientId1,
            clientId2,
          );

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

          // Prepare questions for sending (without answers)
          const questionsForMatch = matchContent.questions.map((q: any) => ({
            id: q.id,
            question: q.question,
            options: q.options,
          }));

          // Notify both players that a match has been found
          this.gateway.notifyMatchFound(
            matchId,
            clientId1,
            clientId2,
            userId1,
            userId2,
            questionsForMatch,
          );

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

  private async storeMatchDataInRedis(
    matchId: string,
    matchContent: any,
    playerASocketId: string,
    playerBSocketId: string,
  ) {
    const redisClient = this.redisService.getClient();

    try {
      // Store questions (without answers)
      const questionsOnly = matchContent.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
      }));
      await redisClient.set(
        `match:${matchId}:questions`,
        JSON.stringify(questionsOnly),
      );

      // Store answers as a JSON object with question IDs as keys
      const answersObject: { [key: number]: string } = {};
      matchContent.questions.forEach((q: any, index: number) => {
        answersObject[q.id] = matchContent.answers[index];
      });
      await redisClient.set(
        `match:${matchId}:answers`,
        JSON.stringify(answersObject),
      );

      // Store player socket IDs
      await redisClient.set(
        `match:${matchId}:playerASocketId`,
        playerASocketId,
      );
      await redisClient.set(
        `match:${matchId}:playerBSocketId`,
        playerBSocketId,
      );

      LoggerUtil.logInfo(
        this.logger,
        'matchmaking-worker',
        `Match data stored in Redis for match: ${matchId}`,
        {
          matchId,
          playerASocketId,
          playerBSocketId,
          questionsCount: questionsOnly.length,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'matchmaking-worker',
        `Error storing match data in Redis for match: ${matchId}`,
        error,
      );
      throw error;
    }
  }
}
