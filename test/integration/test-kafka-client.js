#!/usr/bin/env node

/**
 * Manual Integration Test for Kafka Setup
 * 
 * This script can be used to manually test the Kafka setup when a Kafka instance is running.
 * 
 * Prerequisites:
 * 1. Start Kafka locally (docker-compose up kafka)
 * 2. Ensure KAFKA_BROKERS environment variable is set
 * 
 * Usage:
 * node test/integration/test-kafka-client.js
 */

const { Kafka, logLevel } = require('kafkajs');

async function testKafkaConnection() {
  console.log('🚀 Starting Kafka Integration Test...');
  
  const kafka = new Kafka({
    clientId: 'test-kafka-client',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    logLevel: logLevel.INFO,
  });

  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId: 'test-group' });
  const admin = kafka.admin();

  try {
    // Test 1: Connect to Kafka
    console.log('📡 Connecting to Kafka...');
    await producer.connect();
    await admin.connect();
    console.log('✅ Connected to Kafka successfully');

    // Test 2: List existing topics
    console.log('📋 Listing topics...');
    const topics = await admin.listTopics();
    console.log(`✅ Found ${topics.length} topics:`, topics);

    // Test 3: Create a test topic
    const testTopic = 'test-realtime-service';
    console.log(`🔨 Creating topic: ${testTopic}`);
    await admin.createTopics({
      topics: [{
        topic: testTopic,
        numPartitions: 1,
        replicationFactor: 1,
      }],
    });
    console.log('✅ Topic created successfully');

    // Test 4: Send a test message
    console.log('📤 Sending test message...');
    const testMessage = {
      timestamp: new Date().toISOString(),
      service: 'realtime-service',
      test: true,
      message: 'Hello from Kafka integration test!'
    };

    await producer.send({
      topic: testTopic,
      messages: [{
        key: 'test-key',
        value: JSON.stringify(testMessage),
      }],
    });
    console.log('✅ Message sent successfully');

    // Test 5: Consume the message
    console.log('📥 Consuming test message...');
    await consumer.connect();
    await consumer.subscribe({ topic: testTopic, fromBeginning: true });

    const messageReceived = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          console.log('✅ Message received:', {
            topic,
            partition,
            key: message.key?.toString(),
            value: message.value?.toString(),
          });
          resolve(true);
        },
      });
    });

    // Wait for message or timeout
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Message consumption timeout')), 10000)
    );

    await Promise.race([messageReceived, timeout]);
    console.log('✅ Message consumed successfully');

    console.log('🎉 All Kafka tests passed!');

  } catch (error) {
    console.error('❌ Kafka test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up connections...');
    await producer.disconnect();
    await consumer.disconnect();
    await admin.disconnect();
    console.log('✅ Cleanup completed');
  }
}

// Run the test
testKafkaConnection().catch(console.error);