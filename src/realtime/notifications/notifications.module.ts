import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
// import { RealtimeGateway } from './realtime.gateway';
import { InternalNotifyController } from './internal-notify.controller';
import { RealtimeModule } from '../realtime.module';
import { InternalAuthGuard } from './internal-auth.guard';
// import { InternalAuthGuard } from './internal-auth.guard';

@Module({
  imports: [RealtimeModule],
  providers: [NotificationsService, InternalAuthGuard],
  controllers: [InternalNotifyController],
  exports: [NotificationsService], // optional, in case other modules need it
})
export class NotificationsModule {}
