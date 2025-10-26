import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../gateway/realtime.gateway';
import { PinoLogger } from 'nestjs-pino';
import { LoggerUtil } from 'src/common/utils/logger.util';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly logger: PinoLogger,
  ) {}

  sendToUsers(userIds: string[], payload: any) {
    try {
      this.gateway.sendNotificationToUsers(userIds, payload);
      LoggerUtil.logInfo(this.logger, 'NotificationsService', 'sendToUsers', {
        userIds,
        payload,
      });
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'NotificationsService',
        'sendToUsers',
        error as Error,
      );
    }
  }
}
