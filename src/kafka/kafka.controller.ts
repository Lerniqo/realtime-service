import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class KafkaController {
  @MessagePattern('SessionStartingSoon')
  handleSessionStartingSoon(@Payload() payload: any) {
    console.log('Received SessionStartingSoon event in controller:', payload);
  }
}
