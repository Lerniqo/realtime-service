import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { AuthJwtModule } from '../auth/jwt.module';

@Module({
    imports: [AuthJwtModule],
    providers: [RealtimeGateway],
})
export class GatewayModule{}