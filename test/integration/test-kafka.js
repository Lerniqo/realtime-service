/**
 * Kafka Integration Test
 * 
 * This test verifies that the Kafka setup works correctly with actual Kafka services.
 * It tests the basic connectivity and message production capabilities.
 * 
 * Prerequisites:
 * - Kafka must be running (e.g., via docker-compose or locally)
 * - Set KAFKA_BROKERS environment variable (defaults to localhost:9092)
 * 
 * Usage:
 *   node test/integration/test-kafka.js
 */

const { Kafka } = require('kafkajs');

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const TEST_TOPIC = 'test-realtime-service';
const TEST_CONSUMER_GROUP = 'test-realtime-service-consumer';

console.log('🚀 Starting Kafka Integration Test');
console.log(`📡 Connecting to Kafka brokers: ${KAFKA_BROKERS}`);

async function testKafkaIntegration() {
  // Create Kafka client
  const kafka = new Kafka({
    clientId: 'realtime-service-integration-test',
    brokers: KAFKA_BROKERS.split(','),
    retry: {
      initialRetryTime: 100,
      retries: 3,
    },
    connectionTimeout: 3000,
    requestTimeout: 5000,
  });

  let producer = null;
  let consumer = null;
  
  try {
    console.log('\n🔧 Creating producer and consumer...');
    
    // Create producer and consumer
    producer = kafka.producer();
    consumer = kafka.consumer({ 
      groupId: TEST_CONSUMER_GROUP,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    // Connect producer
    console.log('🔌 Connecting producer...');
    await producer.connect();
    console.log('✅ Producer connected successfully');

    // Connect consumer
    console.log('🔌 Connecting consumer...');
    await consumer.connect();
    console.log('✅ Consumer connected successfully');

    // Subscribe to test topic
    console.log(`📝 Subscribing to topic: ${TEST_TOPIC}`);
    await consumer.subscribe({ topic: TEST_TOPIC, fromBeginning: false });

    // Set up message handler
    let messageReceived = false;
    const messagePromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          console.log('📨 Message received:', {
            topic,
            partition,
            offset: message.offset,
            key: message.key?.toString(),
            value: message.value?.toString(),
            timestamp: message.timestamp,
          });
          messageReceived = true;
          resolve();
        },
      });
    });

    // Wait a moment for consumer to be ready
    console.log('⏳ Waiting for consumer to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send test message
    const testMessage = {
      type: 'integration-test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Hello from Kafka integration test!',
        service: 'realtime-service',
      },
    };

    console.log('📤 Sending test message...');
    await producer.send({
      topic: TEST_TOPIC,
      messages: [{
        key: 'integration-test',
        value: JSON.stringify(testMessage),
        timestamp: Date.now().toString(),
      }],
    });
    console.log('✅ Test message sent successfully');

    // Wait for message to be received (with timeout)
    console.log('⏳ Waiting for message to be received...');
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Message receive timeout')), 10000)
    );

    await Promise.race([messagePromise, timeout]);

    if (messageReceived) {
      console.log('✅ Message received successfully');
    }

    // Test admin operations
    console.log('\n🔧 Testing admin operations...');
    const admin = kafka.admin();
    await admin.connect();
    console.log('✅ Admin client connected');

    // List topics
    const topics = await admin.listTopics();
    console.log(`📋 Available topics: ${topics.join(', ')}`);

    // Get topic metadata
    if (topics.includes(TEST_TOPIC)) {
      const metadata = await admin.fetchTopicMetadata({ topics: [TEST_TOPIC] });
      console.log(`📊 Topic metadata for ${TEST_TOPIC}:`, {
        partitions: metadata.topics[0]?.partitions?.length || 'N/A',
      });
    }

    await admin.disconnect();
    console.log('✅ Admin client disconnected');

    console.log('\n🎉 All Kafka integration tests passed!');
    
  } catch (error) {
    console.error('\n❌ Kafka integration test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('getaddrinfo ENOTFOUND')) {
      console.error('\n💡 Connection failed. Please ensure:');
      console.error('   - Kafka is running (docker-compose up -d or local installation)');
      console.error('   - Correct broker address is set in KAFKA_BROKERS environment variable');
      console.error(`   - Current brokers: ${KAFKA_BROKERS}`);
    }
    
    if (error.message.includes('timeout')) {
      console.error('\n💡 Timeout occurred. This might indicate:');
      console.error('   - Kafka is slow to respond');
      console.error('   - Network connectivity issues');
      console.error('   - Topic creation/subscription delays');
    }
    
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up connections...');
    
    if (consumer) {
      try {
        await consumer.disconnect();
        console.log('✅ Consumer disconnected');
      } catch (e) {
        console.warn('⚠️ Error disconnecting consumer:', e.message);
      }
    }
    
    if (producer) {
      try {
        await producer.disconnect();
        console.log('✅ Producer disconnected');
      } catch (e) {
        console.warn('⚠️ Error disconnecting producer:', e.message);
      }
    }
  }
}

// Run the test
testKafkaIntegration()
  .then(() => {
    console.log('\n✨ Integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });