import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly logger: PinoLogger) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['internal-api-key'] as string;
    const expectedKey = process.env.INTERNAL_API_KEY;

    const result = apiKey === expectedKey;

    // Log error if authentication fails
    if (!result) {
      const errorContext = {
        receivedApiKey: apiKey ? 'provided' : 'missing',
        expectedKeyExists: !!expectedKey,
        requestPath: req.url as string,
        requestMethod: req.method as string,
        userAgent: req.headers['user-agent'] as string,
        ip: (req.ip || req.connection?.remoteAddress) as string,
      };

      if (!apiKey) {
        LoggerUtil.logError(
          this.logger,
          'InternalAuthGuard',
          'Internal API authentication failed: Missing API key',
          errorContext,
        );
      } else {
        LoggerUtil.logError(
          this.logger,
          'InternalAuthGuard',
          'Internal API authentication failed: Invalid API key',
          errorContext,
        );
      }
    } else {
      // Optional: Log successful authentication
      LoggerUtil.logInfo(
        this.logger,
        'InternalAuthGuard',
        'Internal API authentication successful',
        {
          requestPath: req.url as string,
          requestMethod: req.method as string,
        },
      );
    }

    return result;
  }
}
