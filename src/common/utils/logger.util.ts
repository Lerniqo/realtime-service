import { PinoLogger } from 'nestjs-pino';

export class LoggerUtil {
  private static formatMessage(
    context: string,
    action: string,
    details?: any,
  ): string {
    const baseMessage = `[${context}] ${action} | service: realtime-service`;
    if (details && typeof details === 'object') {
      const detailsStr = JSON.stringify(details, null, 0);
      return `${baseMessage} | ${detailsStr}`;
    }
    if (details) {
      return `${baseMessage} | ${details}`;
    }
    return baseMessage;
  }

  static logInfo(
    logger: PinoLogger,
    context: string,
    action: string,
    details?: any,
  ) {
    logger.info(this.formatMessage(context, action, details));
  }

  static logWarn(
    logger: PinoLogger,
    context: string,
    action: string,
    details?: any,
  ): void {
    logger.warn(this.formatMessage(context, action, details));
  }

  static logError(
    logger: PinoLogger,
    context: string,
    action: string,
    error: any,
    details?: any,
  ): void {
    const errorDetails = {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
              }),
            }
          : error,
      ...(details && { details }),
    };

    logger.error(errorDetails, this.formatMessage(context, action));
  }
  static logDebug(
    logger: PinoLogger,
    context: string,
    action: string,
    details?: any,
  ): void {
    logger.debug(this.formatMessage(context, action, details));
  }

  static logRequest(
    logger: PinoLogger,
    method: string,
    url: string,
    statusCode: number,
    userId?: string,
  ): void {
    const status = statusCode >= 400 ? '❌' : '✅';
    const userInfo = userId ? ` | User: ${userId}` : '';
    logger.info(`${status} ${method} ${url} → ${statusCode}${userInfo}`);
  }

  static sanitizeObject(
    obj: any,
    sensitiveFields: string[] = ['password', 'token', 'secret', 'key'],
  ): any {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = { ...obj };
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) sanitized[field] = '[REDACTED]';
    });

    return sanitized;
  }
}
