import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { KafkaClientService } from '../kafka/kafka-client.service';

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  constructor(private readonly kafkaClientService: KafkaClientService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Try to list topics as a health check
      const topics = (await Promise.race([
        this.kafkaClientService.listTopics(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000),
        ),
      ])) as string[];

      const isHealthy = Array.isArray(topics) && topics.length >= 0;

      const result = this.getStatus(key, isHealthy, {
        topicCount: topics.length,
        status: 'connected',
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Kafka health check failed', result);
    } catch (error) {
      const result = this.getStatus(key, false, {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new HealthCheckError('Kafka health check failed', result);
    }
  }
}
