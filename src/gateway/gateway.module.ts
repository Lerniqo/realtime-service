import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { AuthJwtModule } from '../auth/jwt.module';
import { ConnectionService } from './connection.service';

@Module({
  imports: [AuthJwtModule],
  providers: [RealtimeGateway, ConnectionService],
})
export class GatewayModule {}
