import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Ping Redis with timeout
      const pingResult = await Promise.race([
        this.redisService.getClient().ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 3000),
        ),
      ]);

      const isHealthy = pingResult === 'PONG';

      const result = this.getStatus(key, isHealthy, {
        status: 'connected',
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Redis health check failed', result);
    } catch (error) {
      const result = this.getStatus(key, false, {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new HealthCheckError('Redis health check failed', result);
    }
  }
}
