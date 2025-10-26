import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer, Admin, Partitioners } from 'kafkajs';
import { PinoLogger } from 'nestjs-pino';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { getKafkaConfig } from './kafka.config';

@Injectable()
export class KafkaClientService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;

  constructor(private readonly logger: PinoLogger) {
    this.kafka = new Kafka(getKafkaConfig());
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    this.consumer = this.kafka.consumer({
      groupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'realtime-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    this.admin = this.kafka.admin();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      await this.admin.connect();
      LoggerUtil.logInfo(
        this.logger,
        'KafkaClientService',
        'Kafka producer and admin connected successfully',
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaClientService',
        'Failed to connect to Kafka',
        error,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      await this.admin.disconnect();
      LoggerUtil.logInfo(
        this.logger,
        'KafkaClientService',
        'Kafka connections closed successfully',
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaClientService',
        'Error closing Kafka connections',
        error,
      );
    }
  }

  async sendMessage(
    topic: string,
    messages: Array<{ key?: string; value: string; partition?: number }>,
  ) {
    try {
      const result = await this.producer.send({
        topic,
        messages,
      });

      LoggerUtil.logInfo(
        this.logger,
        'KafkaClientService',
        'Message sent successfully',
        { topic, messageCount: messages.length, result },
      );

      return result;
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaClientService',
        'Failed to send message',
        { topic, error },
      );
      throw error;
    }
  }

  async createTopics(
    topics: Array<{
      topic: string;
      numPartitions?: number;
      replicationFactor?: number;
    }>,
  ) {
    try {
      const result = await this.admin.createTopics({
        topics,
        waitForLeaders: true,
        timeout: 30000,
      });

      LoggerUtil.logInfo(
        this.logger,
        'KafkaClientService',
        'Topics created successfully',
        { topics, result },
      );

      return result;
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaClientService',
        'Failed to create topics',
        { topics, error },
      );
      throw error;
    }
  }

  async listTopics() {
    try {
      const topics = await this.admin.listTopics();
      LoggerUtil.logInfo(
        this.logger,
        'KafkaClientService',
        'Listed topics successfully',
        { topicCount: topics.length },
      );
      return topics;
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'KafkaClientService',
        'Failed to list topics',
        error,
      );
      throw error;
    }
  }

  getProducer(): Producer {
    return this.producer;
  }

  getConsumer(): Consumer {
    return this.consumer;
  }

  getAdmin(): Admin {
    return this.admin;
  }
}
