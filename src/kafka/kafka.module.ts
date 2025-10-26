import { Module, forwardRef } from '@nestjs/common';
import { KafkaController } from './kafka.controller';
import { KafkaService } from './kafka.service';
import { KafkaClientService } from './kafka-client.service';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [KafkaController],
  providers: [KafkaClientService, KafkaService],
  exports: [KafkaClientService, KafkaService],
})
export class KafkaModule {}
