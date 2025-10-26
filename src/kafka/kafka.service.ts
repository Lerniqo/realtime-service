import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from 'src/realtime/gateway/realtime.gateway';
import { PinoLogger } from 'nestjs-pino';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { KafkaClientService } from './kafka-client.service';

@Injectable()
export class KafkaService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logger: PinoLogger,
    private readonly kafkaClientService: KafkaClientService,
  ) {}

  // Producer methods for sending messages to Kafka topics
  async sendToTopic(topic: string, message: any, key?: string) {
    try {
      const messageValue =
        typeof message === 'string' ? message : JSON.stringify(message);
      await this.kafkaClientService.sendMessage(topic, [
        {
          key,
          value: messageValue,
        },
      ]);

      LoggerUtil.logInfo(this.logger, 'KafkaService', 'Message sent to topic', {
        topic,
        key,
        messageLength: messageValue.length,
      });
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaService',
        'Error sending message to topic',
        { topic, key, error },
      );
      throw error;
    }
  }

  async sendBatchToTopic(
    topic: string,
    messages: Array<{ key?: string; value: any }>,
  ) {
    try {
      const formattedMessages = messages.map((msg) => ({
        key: msg.key,
        value:
          typeof msg.value === 'string' ? msg.value : JSON.stringify(msg.value),
      }));

      await this.kafkaClientService.sendMessage(topic, formattedMessages);

      LoggerUtil.logInfo(
        this.logger,
        'KafkaService',
        'Batch messages sent to topic',
        { topic, messageCount: messages.length },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaService',
        'Error sending batch messages to topic',
        { topic, messageCount: messages.length, error },
      );
      throw error;
    }
  }

  // Consumer handlers (existing functionality)

  sendSessionStartSoonNotification(userIds: string[], message: string) {
    try {
      this.realtimeGateway.sendNotificationToUsers(userIds, message);
      LoggerUtil.logInfo(
        this.logger,
        'KafkaNotificationService',
        'Send session start soon notification',
        {
          userIds,
          message,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaNotificationService',
        'Error while sending session start soon notification',
        error,
      );
    }
  }
  sendConceptMasteredNotification(userIds: string[], message: string) {
    try {
      this.realtimeGateway.sendNotificationToUsers(userIds, message);
      LoggerUtil.logInfo(
        this.logger,
        'KafkaNotificationService',
        'Send concept mastered notification',
        {
          userIds,
          message,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaNotificationService',
        'Error while sending concept mastered notification',
        error,
      );
    }
  }
}
