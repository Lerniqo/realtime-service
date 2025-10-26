import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { KafkaClientService } from '../kafka/kafka-client.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  constructor(
    private readonly kafkaClientService: KafkaClientService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Try to list topics as a health check
      const topics = await this.kafkaClientService.listTopics();
      const isHealthy = Array.isArray(topics);

      const result = super.getStatus(key, isHealthy, {
        topicCount: topics.length,
        status: 'connected',
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Kafka health check failed', result);
    } catch (error) {
      this.logger.error('Kafka health check failed', error);
      const result = super.getStatus(key, false, {
        status: 'disconnected',
        error: error.message,
      });
      throw new HealthCheckError('Kafka health check failed', result);
    }
  }
}
