import { ConnectionManager } from '../services/connectionManager.js';

async function testReadOnlyEnforcement() {
  const connectionManager = new ConnectionManager();

  // Create a mock demo connection ID
  const demoConnectionId = 'test_demo_connection';
  
  // Mark it as a demo connection
  await connectionManager.markAsDemoConnection(demoConnectionId);

  console.log('\n=== Testing Read-Only Enforcement ===\n');

  // Test cases
  const testCases = [
    { sql: 'SELECT * FROM products', shouldPass: true },
    { sql: 'SELECT COUNT(*) FROM orders', shouldPass: true },
    { sql: 'INSERT INTO products (name) VALUES (\'test\')', shouldPass: false },
    { sql: 'UPDATE products SET price = 100', shouldPass: false },
    { sql: 'DELETE FROM orders WHERE id = 1', shouldPass: false },
    { sql: 'CREATE TABLE test (id INT)', shouldPass: false },
    { sql: 'DROP TABLE products', shouldPass: false },
    { sql: 'ALTER TABLE products ADD COLUMN test VARCHAR(100)', shouldPass: false },
    { sql: 'TRUNCATE TABLE orders', shouldPass: false },
    { sql: '-- Comment\nSELECT * FROM products', shouldPass: true },
    { sql: '/* Multi-line\ncomment */\nSELECT * FROM products', shouldPass: true },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const error = connectionManager.validateQueryForConnection(testCase.sql, demoConnectionId);
    const actualPass = error === null;
    
    if (actualPass === testCase.shouldPass) {
      console.log(`✓ PASS: ${testCase.sql.substring(0, 50)}...`);
      passed++;
    } else {
      console.log(`✗ FAIL: ${testCase.sql.substring(0, 50)}...`);
      console.log(`  Expected: ${testCase.shouldPass ? 'allowed' : 'blocked'}`);
      console.log(`  Got: ${actualPass ? 'allowed' : 'blocked'}`);
      if (error) {
        console.log(`  Error: ${error}`);
      }
      failed++;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}/${testCases.length}`);
  console.log(`Failed: ${failed}/${testCases.length}`);

  // Test with non-demo connection
  console.log('\n=== Testing Non-Demo Connection ===\n');
  const regularConnectionId = 'regular_connection';
  
  const writeQuery = 'INSERT INTO products (name) VALUES (\'test\')';
  const error = connectionManager.validateQueryForConnection(writeQuery, regularConnectionId);
  
  if (error === null) {
    console.log('✓ PASS: Write operations allowed on non-demo connections');
  } else {
    console.log('✗ FAIL: Write operations should be allowed on non-demo connections');
    console.log(`  Error: ${error}`);
  }
}

testReadOnlyEnforcement().catch(console.error);
