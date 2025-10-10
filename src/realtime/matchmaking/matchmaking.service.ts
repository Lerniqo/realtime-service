import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/redis/redis.service';
import { GameType } from './dto/game-type.enum';

// TO-DO - Implement actual matchmaking logic and add logger
@Injectable()
export class MatchmakingService {
  constructor(private readonly redisService: RedisService) {}

  async addToMatchingQueue(clientId: string, gameType: string): Promise<void> {
    if (gameType === GameType.ONE_V_ONE_RAPID_QUIZ) {
      const redisClient = this.redisService.getClient();
      await redisClient.lpush(`matchmaking:queue:${gameType}`, clientId);
    } else {
      throw new Error('Unsupported game type');
    }
  }

  // Add matchmaking logic here
}
