import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Logger } from 'nestjs-pino';
import { PinoLogger } from 'nestjs-pino/PinoLogger';
import { LoggerUtil } from 'src/common/utils/logger.util';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readyPromise: Promise<void>;
  private readyResolve: () => void;
  private readyReject: (error: any) => void;

  constructor(
    private configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('ready', () => {
      LoggerUtil.logInfo(this.logger, 'RedisService', 'Redis client ready');
      this.readyResolve(); // ✅ mark ready
    });

    this.client.on('error', (err) => {
      LoggerUtil.logError(
        this.logger,
        'RedisService',
        'Redis client error',
        err,
      );
      // Don't reject the promise on error, let retry strategy handle it
    });

    this.client.on('connect', () => {
      LoggerUtil.logInfo(this.logger, 'RedisService', 'Connected to Redis');
    });

    try {
      await this.client.ping();
      LoggerUtil.logInfo(this.logger, 'RedisService', 'Redis ping successful');
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RedisService',
        'Redis connection failed',
        error,
      );
      // Don't rethrow, let the retry strategy handle it
    }
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
