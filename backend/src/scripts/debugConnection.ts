import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testConnection() {
  console.log('Testing with demo_readonly user...\n');
  
  const config = {
    host: process.env.DEMO_DB_HOST,
    port: parseInt(process.env.DEMO_DB_PORT || '5432'),
    database: process.env.DEMO_DB_NAME,
    user: process.env.DEMO_DB_USER,
    password: process.env.DEMO_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  };
  
  console.log('Connection config:');
  console.log(JSON.stringify({
    ...config,
    password: '***' + config.password?.slice(-4)
  }, null, 2));
  console.log();
  
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT current_user, version()');
    console.log('Current user:', result.rows[0].current_user);
    console.log('Version:', result.rows[0].version);
    
    await client.end();
  } catch (error: any) {
    console.log('❌ Connection failed:', error.message);
    console.log('Error code:', error.code);
    console.log('\nFull error:', error);
  }
}

testConnection();
