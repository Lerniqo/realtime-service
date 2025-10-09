import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1️⃣ Create a Kafka microservice
  const kafkaMicroservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'], // Kafka broker URL
      },
      consumer: {
        groupId: 'my-consumer-group', // unique consumer group id
      },
    },
  });

  // 2️⃣ Start microservices and REST API together
  await app.startAllMicroservices(); // starts Kafka microservice
  await app.listen(process.env.PORT ?? 3000); // starts HTTP server

  logger.log(
    '[Bootstrap] | Application is listening on port ' +
      (process.env.PORT ?? 3000),
  );
  logger.log('[Bootstrap] | Kafka microservice is running...');
}
bootstrap();
