import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { KafkaHealthIndicator } from './kafka-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private kafkaHealthIndicator: KafkaHealthIndicator,
    private redisHealthIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.kafkaHealthIndicator.isHealthy('kafka'),
      () => this.redisHealthIndicator.isHealthy('redis'),
    ]);
  }

  @Get('liveness')
  getLiveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @HealthCheck()
  async getReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.kafkaHealthIndicator.isHealthy('kafka'),
      () => this.redisHealthIndicator.isHealthy('redis'),
    ]);
  }
}
