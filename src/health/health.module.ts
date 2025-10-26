import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { KafkaHealthIndicator } from './kafka-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';
import { KafkaModule } from '../kafka/kafka.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TerminusModule, KafkaModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService, KafkaHealthIndicator, RedisHealthIndicator],
  exports: [HealthService, KafkaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
