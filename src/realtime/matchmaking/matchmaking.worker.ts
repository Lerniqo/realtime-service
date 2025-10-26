import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from 'src/redis/redis.service';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { PinoLogger } from 'nestjs-pino';
import { GameType } from './dto/game-type.enum';
import { RealtimeGateway } from '../gateway/realtime.gateway';
import { AiServiceClient } from 'src/ai-service/ai-service.client';

@Injectable()
export class MatchmakingWorker {
  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RealtimeRoomsService,
    private readonly logger: PinoLogger,
    private readonly gateway: RealtimeGateway,
    private readonly aiServiceClient: AiServiceClient,
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

          // Prevent matching a user with themselves
          if (userId1 === userId2 || clientId1 === clientId2) {
            LoggerUtil.logWarn(
              this.logger,
              'matchmaking-worker',
              'Attempted to match user with themselves, removing duplicate from queue',
              {
                userId: userId1,
                clientId1,
                clientId2,
              },
            );
            // Remove the duplicate entry
            await redisClient.lrem(queueKey, 1, entry2);
            continue; // Skip this iteration and check queue again
          }

          // Remove them from the queue
          await redisClient.lrem(queueKey, 1, entry1);
          await redisClient.lrem(queueKey, 1, entry2);

          // Generate unique match ID
          const matchId = `match:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const topics = [
            'Maths General Knowledge',
            'O/L Geometry',
            'O/L Algebra',
            'O/L Statistics',
            'O/L Trigonometry',
            'O/L Graphs',
            'O/L Probability',
            'O/L Number Theory',
            'O/L Basic Arithmetic',
            'O/L Areas and Volumes',
            'O/L Ratios and Proportions',
            'O/L Functions',
            'O/L Sequences and Series',
            'O/L Coordinate Geometry',
            'O/L Mensuration',
            'O/L Sets and Venn Diagrams',
            'O/L Logic and Reasoning',
            'O/L Time and Work',
            'O/L Speed, Distance, and Time',
            'O/L Percentages and Interest',
            'O/L Data Interpretation',
          ];

          //pick a random 3 topics and combine them
          const selectedTopics: string[] = [];
          while (selectedTopics.length < 3) {
            const randomTopic =
              topics[Math.floor(Math.random() * topics.length)];
            if (!selectedTopics.includes(randomTopic)) {
              selectedTopics.push(randomTopic);
            }
          }

          // Get questions from AI service
          const questions = await this.aiServiceClient.generateQuestions(
            selectedTopics.join(', '),
            5,
            {
              question_types: ['multiple_choice'],
              difficulty: 'medium',
            },
          );

          const questionList = questions.questions.map((q: any) => ({
            id: q.question_id,
            question: q.question_text,
            options: q.options.map((opt: any) => opt.text),
            concepts: q.concepts,
          }));

          const answerList = questions.questions.map((q: any) => {
            return q.options.find((opt: any) => opt.is_correct).text;
          });

          const matchContent = {
            questions: questionList,
            answers: answerList,
          };

          // Store match data in Redis
          await this.storeMatchDataInRedis(
            matchId,
            matchContent,
            clientId1,
            clientId2,
            userId1,
            userId2,
          );

          // Get socket objects for the client IDs
          const socket1 = this.gateway.server.sockets.sockets.get(clientId1);
          const socket2 = this.gateway.server.sockets.sockets.get(clientId2);

          // Ensure both players are still connected before creating match
          if (!socket1 || !socket2) {
            LoggerUtil.logWarn(
              this.logger,
              'matchmaking-worker',
              'One or both players disconnected before match could be created',
              {
                clientId1,
                clientId2,
                socket1Connected: !!socket1,
                socket2Connected: !!socket2,
              },
            );
            // Don't create the match if either player is disconnected
            continue;
          }

          // Join both players to the match room
          await this.roomsService.joinRoom(socket1, matchId);
          await this.roomsService.joinRoom(socket2, matchId);

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
    playerAUserId: string,
    playerBUserId: string,
  ) {
    const redisClient = this.redisService.getClient();

    try {
      // Store questions (without answers)
      const questionsOnly = matchContent.questions.map((q: any) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        concepts: q.concepts,
      }));
      await redisClient.set(
        `${matchId}:questions`,
        JSON.stringify(questionsOnly),
      );

      // Store answers as a JSON object with question IDs as keys
      const answersObject: { [key: number]: string } = {};
      matchContent.questions.forEach((q: any, index: number) => {
        answersObject[q.id] = matchContent.answers[index];
      });
      await redisClient.set(
        `${matchId}:answers`,
        JSON.stringify(answersObject),
      );

      // Store player socket IDs
      await redisClient.set(`${matchId}:playerASocketId`, playerASocketId);
      await redisClient.set(`${matchId}:playerBSocketId`, playerBSocketId);

      // Store player user IDs for reference
      await redisClient.set(`${matchId}:playerAUserId`, playerAUserId);
      await redisClient.set(`${matchId}:playerBUserId`, playerBUserId);

      // Store player status data
      const initialPlayerStatus = {
        score: 0,
        activeQuestionIndex: 0,
        timer: 0,
      };

      await redisClient.set(
        `${matchId}:playerAStatus`,
        JSON.stringify(initialPlayerStatus),
      );
      await redisClient.set(
        `${matchId}:playerBStatus`,
        JSON.stringify(initialPlayerStatus),
      );

      LoggerUtil.logInfo(
        this.logger,
        'matchmaking-worker',
        `Match data stored in Redis for match: ${matchId}`,
        {
          matchId,
          playerASocketId,
          playerBSocketId,
          playerAUserId,
          playerBUserId,
          questionsCount: questionsOnly.length,
          initialPlayerStatus,
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
