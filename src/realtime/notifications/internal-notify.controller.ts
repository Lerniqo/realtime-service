import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotifyDto } from './dto/notify.dto';
import { InternalAuthGuard } from './internal-auth.guard';

@Controller('api/realtime/internal')
export class InternalNotifyController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('notify')
  @UseGuards(InternalAuthGuard) // Protects this endpoint
  @HttpCode(202)
  notify(@Body() body: NotifyDto) {
    this.notificationsService.sendToUsers(body.userIds, body.payload);
    return { status: 'queued' };
  }
}
