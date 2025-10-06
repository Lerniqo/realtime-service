import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { AuthJwtModule } from './auth/jwt.module';
// import { RealtimeGateway } from './gateway/realtime.gateway';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
// import { CustomLoggerService } from './logger/custom-logger/custom-logger.service';
import { CustomLoggerModule } from './logger/custom-logger/custom-logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
        base: {
          service_name: 'realtime-service',
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        formatters: {
          level: (label) => {
            return { log_level: label };
          },
        },
      },
    }),
    AuthJwtModule,
    GatewayModule,
    HealthModule,
    CustomLoggerModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisService],
})
export class AppModule {}
