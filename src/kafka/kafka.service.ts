import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from 'src/realtime/gateway/realtime.gateway';
import { PinoLogger } from 'nestjs-pino';
import { LoggerUtil } from 'src/common/utils/logger.util';

@Injectable()
export class KafkaService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly logger: PinoLogger,
  ) {}
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
