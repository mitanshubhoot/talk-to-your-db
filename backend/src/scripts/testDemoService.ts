import dotenv from 'dotenv';
import { ConnectionManager } from '../services/connectionManager.js';
import { DemoConnectionService } from '../services/demoConnectionService.js';

// Load environment variables
dotenv.config();

async function testDemoService() {
  console.log('=== Testing Demo Connection Service ===\n');

  const connectionManager = new ConnectionManager();
  const demoService = new DemoConnectionService(connectionManager);

  // Test 1: Check if demo is configured
  console.log('Test 1: Check if demo is configured');
  const isConfigured = demoService.isDemoConfigured();
  console.log('Demo configured:', isConfigured);
  console.log('');

  if (!isConfigured) {
    console.log('Demo database not configured. Set environment variables:');
    console.log('- DEMO_DB_HOST');
    console.log('- DEMO_DB_PORT');
    console.log('- DEMO_DB_NAME');
    console.log('- DEMO_DB_USER');
    console.log('- DEMO_DB_PASSWORD');
    console.log('- DEMO_DB_SSL');
    return;
  }

  // Test 2: Get demo config
  console.log('Test 2: Get demo config');
  const config = demoService.getDemoConfig();
  console.log('Demo config:', {
    host: config?.host,
    port: config?.port,
    database: config?.database,
    username: config?.username,
    ssl: config?.ssl,
    password: config?.password ? '***' : undefined
  });
  console.log('');

  // Test 3: Validate demo database
  console.log('Test 3: Validate demo database');
  const isValid = await demoService.validateDemoDatabase();
  console.log('Demo database valid:', isValid);
  console.log('');

  if (!isValid) {
    console.log('Demo database validation failed. Check credentials and connectivity.');
    return;
  }

  // Test 4: Initialize demo connection
  console.log('Test 4: Initialize demo connection');
  const connection = await demoService.initializeDemoConnection();
  if (connection) {
    console.log('Demo connection initialized:', {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      host: connection.host,
      database: connection.database
    });
  } else {
    console.log('Failed to initialize demo connection');
  }
  console.log('');

  // Test 5: Check if connection is demo
  if (connection) {
    console.log('Test 5: Check if connection is demo');
    const isDemo = demoService.isDemoConnection(connection.id);
    console.log('Is demo connection:', isDemo);
    console.log('');
  }

  // Test 6: Get demo metadata
  console.log('Test 6: Get demo metadata');
  const metadata = demoService.getDemoMetadata();
  console.log('Demo metadata:', {
    isDemo: metadata.isDemo,
    demoVersion: metadata.demoVersion,
    readOnly: metadata.readOnly,
    exampleQueriesCount: metadata.exampleQueries.length
  });
  console.log('Example queries:');
  metadata.exampleQueries.forEach((query, index) => {
    console.log(`  ${index + 1}. ${query}`);
  });
  console.log('');

  // Test 7: Check user connections
  console.log('Test 7: Check user connections');
  const hasUserConnections = await connectionManager.hasUserConnections();
  console.log('Has user connections:', hasUserConnections);
  console.log('');

  // Test 8: List all connections
  console.log('Test 8: List all connections');
  const allConnections = await connectionManager.listConnections();
  console.log('Total connections:', allConnections.length);
  allConnections.forEach(conn => {
    const isDemo = demoService.isDemoConnection(conn.id);
    console.log(`  - ${conn.name} (${conn.type}) ${isDemo ? '[DEMO]' : ''}`);
  });
  console.log('');

  console.log('=== Demo Connection Service Test Complete ===');
}

testDemoService().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
