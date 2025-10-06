import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  checkHealth(): string {
    return JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'realtime-service',
    });
  }
}
