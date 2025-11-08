/**
 * Test script to verify demo database connection
 * Run with: npx ts-node src/scripts/testDemoConnection.ts
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testDemoConnection() {
  console.log('🔍 Testing Demo Database Connection...\n');

  // Test 1: Check environment variables
  console.log('Test 1: Checking environment variables...');
  const requiredVars = [
    'DEMO_DB_HOST',
    'DEMO_DB_PORT',
    'DEMO_DB_NAME',
    'DEMO_DB_USER',
    'DEMO_DB_PASSWORD'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    results.push({
      test: 'Environment Variables',
      status: 'FAIL',
      message: `Missing required variables: ${missingVars.join(', ')}`,
      details: {
        required: requiredVars,
        missing: missingVars
      }
    });
    console.log('❌ FAIL: Missing environment variables\n');
    printResults();
    return;
  }

  results.push({
    test: 'Environment Variables',
    status: 'PASS',
    message: 'All required environment variables are set',
    details: {
      host: process.env.DEMO_DB_HOST,
      port: process.env.DEMO_DB_PORT,
      database: process.env.DEMO_DB_NAME,
      user: process.env.DEMO_DB_USER,
      ssl: process.env.DEMO_DB_SSL || 'true'
    }
  });
  console.log('✅ PASS: All environment variables present\n');

  // Test 2: Create client and connect
  console.log('Test 2: Attempting to connect to database...');
  
  const client = new Client({
    host: process.env.DEMO_DB_HOST,
    port: parseInt(process.env.DEMO_DB_PORT || '5432'),
    database: process.env.DEMO_DB_NAME,
    user: process.env.DEMO_DB_USER,
    password: process.env.DEMO_DB_PASSWORD,
    ssl: process.env.DEMO_DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    results.push({
      test: 'Database Connection',
      status: 'PASS',
      message: 'Successfully connected to demo database'
    });
    console.log('✅ PASS: Connected successfully\n');
  } catch (error: any) {
    results.push({
      test: 'Database Connection',
      status: 'FAIL',
      message: `Failed to connect: ${error.message}`,
      details: error
    });
    console.log(`❌ FAIL: ${error.message}\n`);
    printResults();
    return;
  }

  // Test 3: Check PostgreSQL version
  console.log('Test 3: Checking PostgreSQL version...');
  try {
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version;
    results.push({
      test: 'PostgreSQL Version',
      status: 'PASS',
      message: 'Successfully retrieved database version',
      details: { version }
    });
    console.log(`✅ PASS: ${version}\n`);
  } catch (error: any) {
    results.push({
      test: 'PostgreSQL Version',
      status: 'FAIL',
      message: `Failed to query version: ${error.message}`
    });
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 4: Test SELECT permission
  console.log('Test 4: Testing SELECT permission...');
  try {
    // Try to query system tables
    const selectResult = await client.query(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 LIMIT 5',
      ['public']
    );
    results.push({
      test: 'SELECT Permission',
      status: 'PASS',
      message: 'User can execute SELECT queries',
      details: {
        tablesFound: selectResult.rows.length,
        tables: selectResult.rows.map(r => r.tablename)
      }
    });
    console.log(`✅ PASS: Can execute SELECT queries (found ${selectResult.rows.length} tables)\n`);
  } catch (error: any) {
    results.push({
      test: 'SELECT Permission',
      status: 'FAIL',
      message: `Failed to execute SELECT: ${error.message}`
    });
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Test 5: Verify read-only (should fail to create table)
  console.log('Test 5: Verifying read-only access...');
  try {
    await client.query('CREATE TABLE test_write_protection (id SERIAL PRIMARY KEY)');
    results.push({
      test: 'Read-Only Protection',
      status: 'FAIL',
      message: 'User was able to create a table (should be read-only!)',
      details: { warning: 'User has write permissions - this is a security issue!' }
    });
    console.log('❌ FAIL: User can create tables (should be read-only)\n');
    
    // Clean up if we accidentally created the table
    try {
      await client.query('DROP TABLE IF EXISTS test_write_protection');
    } catch (e) {
      // Ignore cleanup errors
    }
  } catch (error: any) {
    if (error.message.includes('permission denied') || error.message.includes('must be owner')) {
      results.push({
        test: 'Read-Only Protection',
        status: 'PASS',
        message: 'User correctly denied write permissions',
        details: { error: error.message }
      });
      console.log('✅ PASS: User is correctly read-only\n');
    } else {
      results.push({
        test: 'Read-Only Protection',
        status: 'FAIL',
        message: `Unexpected error: ${error.message}`
      });
      console.log(`❌ FAIL: Unexpected error: ${error.message}\n`);
    }
  }

  // Test 6: Check for existing tables
  console.log('Test 6: Checking for existing tables...');
  try {
    const tablesResult = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const tableCount = tablesResult.rows.length;
    results.push({
      test: 'Database Schema',
      status: tableCount > 0 ? 'PASS' : 'FAIL',
      message: tableCount > 0 
        ? `Found ${tableCount} tables in database`
        : 'No tables found (database may not be initialized yet)',
      details: {
        tables: tablesResult.rows.map(r => ({
          name: r.table_name,
          type: r.table_type
        }))
      }
    });
    
    if (tableCount > 0) {
      console.log(`✅ PASS: Found ${tableCount} tables:`);
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name} (${row.table_type})`);
      });
      console.log();
    } else {
      console.log('⚠️  WARNING: No tables found (run initialization script in Task 2)\n');
    }
  } catch (error: any) {
    results.push({
      test: 'Database Schema',
      status: 'FAIL',
      message: `Failed to query schema: ${error.message}`
    });
    console.log(`❌ FAIL: ${error.message}\n`);
  }

  // Close connection
  await client.end();

  // Print summary
  printResults();
}

function printResults() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY                           ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} Test ${index + 1}: ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.details && Object.keys(result.details).length > 0) {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2).split('\n').join('\n   ')}`);
    }
    console.log();
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${total} tests passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 All tests passed! Demo database is properly configured.\n');
    console.log('Next steps:');
    console.log('  1. Proceed to Task 2: Create database initialization script');
    console.log('  2. Run the initialization script to populate sample data');
    console.log('  3. Test the demo connection in the application\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    console.log('Common issues:');
    console.log('  - Check environment variables in backend/.env');
    console.log('  - Verify database credentials are correct');
    console.log('  - Ensure SSL is enabled for Neon connections');
    console.log('  - Check that read-only user was created properly\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
testDemoConnection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
