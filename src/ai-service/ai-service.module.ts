import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiServiceClient } from './ai-service.client';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds timeout for AI responses
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [AiServiceClient],
  exports: [AiServiceClient],
})
export class AiServiceModule {}
