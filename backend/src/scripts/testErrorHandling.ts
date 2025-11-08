/**
 * Test script to verify comprehensive error handling for demo database
 * Tests retry logic and write operation blocking
 */

import { ConnectionManager } from '../services/connectionManager.js';
import { DemoConnectionService } from '../services/demoConnectionService.js';

async function testErrorHandling() {
  console.log('=== Testing Demo Database Error Handling ===\n');

  const connectionManager = new ConnectionManager();
  const demoService = new DemoConnectionService(connectionManager);

  // Test 1: Check if demo is configured
  console.log('Test 1: Checking demo configuration...');
  const isConfigured = demoService.isDemoConfigured();
  console.log(`Demo configured: ${isConfigured}`);
  
  if (!isConfigured) {
    console.log('⚠️  Demo database not configured. Set environment variables to test.');
    console.log('Required: DEMO_DB_HOST, DEMO_DB_PORT, DEMO_DB_NAME, DEMO_DB_USER, DEMO_DB_PASSWORD\n');
  }

  // Test 2: Test connection validation with retry
  if (isConfigured) {
    console.log('\nTest 2: Testing connection validation with retry logic...');
    const isValid = await demoService.validateDemoDatabase(3);
    console.log(`Demo database validation result: ${isValid ? '✅ Success' : '❌ Failed'}\n`);

    // Test 3: Initialize demo connection
    if (isValid) {
      console.log('Test 3: Initializing demo connection...');
      const connection = await demoService.initializeDemoConnection();
      
      if (connection) {
        console.log(`✅ Demo connection initialized: ${connection.id}\n`);

        // Test 4: Test write operation blocking
        console.log('Test 4: Testing write operation blocking...');
        
        const writeQueries = [
          'INSERT INTO products (name, price) VALUES (\'Test\', 10.00)',
          'UPDATE products SET price = 20.00 WHERE id = 1',
          'DELETE FROM products WHERE id = 1',
          'CREATE TABLE test_table (id INT)',
          'DROP TABLE products',
          'ALTER TABLE products ADD COLUMN test VARCHAR(50)',
          'TRUNCATE TABLE products',
          'GRANT ALL ON products TO public',
        ];

        for (const query of writeQueries) {
          const operation = query.split(' ')[0];
          const validationError = connectionManager.validateQueryForConnection(query, connection.id);
          
          if (validationError) {
            console.log(`✅ ${operation} blocked: ${validationError.substring(0, 80)}...`);
          } else {
            console.log(`❌ ${operation} NOT blocked (should have been blocked!)`);
          }
        }

        // Test 5: Test allowed operations
        console.log('\nTest 5: Testing allowed operations...');
        const allowedQueries = [
          'SELECT * FROM products LIMIT 10',
          'SELECT COUNT(*) FROM orders',
          'WITH cte AS (SELECT * FROM customers) SELECT * FROM cte',
        ];

        for (const query of allowedQueries) {
          const validationError = connectionManager.validateQueryForConnection(query, connection.id);
          
          if (!validationError) {
            console.log(`✅ Query allowed: ${query.substring(0, 50)}...`);
          } else {
            console.log(`❌ Query blocked (should have been allowed!): ${validationError}`);
          }
        }

        // Test 6: Test executeQueryWithValidation
        console.log('\nTest 6: Testing executeQueryWithValidation...');
        try {
          const result = await connectionManager.executeQueryWithValidation(
            connection.id,
            'SELECT 1 as test'
          );
          console.log(`✅ SELECT query executed successfully. Rows: ${result.rowCount}`);
        } catch (error) {
          console.log(`❌ SELECT query failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        try {
          await connectionManager.executeQueryWithValidation(
            connection.id,
            'INSERT INTO products (name) VALUES (\'test\')'
          );
          console.log('❌ INSERT query was NOT blocked (should have been blocked!)');
        } catch (error) {
          console.log(`✅ INSERT query blocked: ${error instanceof Error ? error.message : String(error)}`);
        }

      } else {
        console.log('❌ Failed to initialize demo connection\n');
      }
    }
  }

  console.log('\n=== Error Handling Tests Complete ===');
}

// Run the tests
testErrorHandling()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
