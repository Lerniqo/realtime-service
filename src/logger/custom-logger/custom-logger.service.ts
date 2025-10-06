import { Injectable, LoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class CustomLoggerService implements LoggerService {
  constructor(private readonly pinoLogger: PinoLogger) {}

  log(message: any, context?: string) {
    this.pinoLogger.info({ context }, message);
  }

  error(message: any, trace?: string, context?: string) {
    this.pinoLogger.error({ context, trace }, message);
  }

  warn(message: any, context?: string) {
    this.pinoLogger.warn({ context }, message);
  }

  debug(message: any, context?: string) {
    this.pinoLogger.debug({ context }, message);
  }

  verbose(message: any, context?: string) {
    this.pinoLogger.trace({ context }, message);
  }

  // Custom methods for specific events
  logWebSocketConnection(userId: string, socketId: string) {
    this.pinoLogger.info(
      {
        event_type: 'websocket_connection',
        user_id: userId,
        socket_id: socketId,
      },
      'WebSocket client connected',
    );
  }

  logWebSocketDisconnection(userId: string, socketId: string, reason?: string) {
    this.pinoLogger.info(
      {
        event_type: 'websocket_disconnection',
        user_id: userId,
        socket_id: socketId,
        disconnect_reason: reason,
      },
      'WebSocket client disconnected',
    );
  }

  logWebSocketEvent(
    eventName: string,
    userId: string,
    socketId: string,
    data?: any,
  ) {
    this.pinoLogger.info(
      {
        event_type: 'websocket_event',
        event_name: eventName,
        user_id: userId,
        socket_id: socketId,
        event_data: data,
      },
      `WebSocket event received: ${eventName}`,
    );
  }
}
