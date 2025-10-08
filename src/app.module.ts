import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './redis/redis.service';
import { AuthJwtModule } from './auth/jwt.module';
// Replaced GatewayModule with consolidated RealtimeModule
import { RealtimeModule } from './realtime/realtime.module';
import { HealthModule } from './health/health.module';
import { LoggerModule } from 'nestjs-pino';
import { RedisModule } from './redis/redis.module';
// RoomsService is re-exported via RealtimeModule; direct import removed

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
    RealtimeModule,
    HealthModule,
    RedisModule,
  ],
  controllers: [AppController],
  // RoomsService now provided by RealtimeModule
  providers: [AppService, RedisService],
})
export class AppModule {}
