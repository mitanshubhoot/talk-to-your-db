/**
 * Test script to verify Google Gemini API key is working
 * Uses the same REST API approach as freeAiService
 */

async function testGeminiApi() {
  console.log('=== Testing Google Gemini API ===\n');

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error('❌ GOOGLE_API_KEY environment variable is not set');
    process.exit(1);
  }

  console.log('✅ GOOGLE_API_KEY is set');
  console.log(`   Key preview: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  try {
    // Test 1: Simple API call
    console.log('Test 1: Testing basic API connection...');
    const startTime = Date.now();
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say "Hello, API is working!" in exactly those words.'
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100
        }
      })
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`\n❌ API Request Failed!`);
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${errorBody}\n`);
      
      if (response.status === 400) {
        console.error('Error: Bad Request - API key may be invalid or model name incorrect');
      } else if (response.status === 403) {
        console.error('Error: Permission denied - Check API key permissions');
        console.error('Solution: Enable the Generative Language API at https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
      } else if (response.status === 429) {
        console.error('Error: Rate limit exceeded');
        console.error('Solution: Wait a few minutes before trying again');
      }
      
      process.exit(1);
    }

    const result = await response.json() as any;
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    console.log('✅ API Response received successfully!');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Response: ${text}\n`);

    // Test 2: SQL Generation
    console.log('Test 2: Testing SQL generation capability...');
    const sqlStartTime = Date.now();
    
    const sqlResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert SQL developer. Generate ONLY the SQL query for this request. Do not include explanations or markdown formatting.

Given a database with tables: products (id, name, price), customers (id, name, email), orders (id, customer_id, total_amount).

Generate a SQL query to: "Show me all products with price greater than 100"

SQL:`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000
        }
      })
    });

    const sqlDuration = Date.now() - sqlStartTime;

    if (!sqlResponse.ok) {
      console.error(`❌ SQL generation failed: ${sqlResponse.status}`);
      process.exit(1);
    }

    const sqlResult = await sqlResponse.json() as any;
    const sqlText = sqlResult.candidates?.[0]?.content?.parts?.[0]?.text || 'No SQL generated';

    console.log('✅ SQL Generation test successful!');
    console.log(`   Duration: ${sqlDuration}ms`);
    console.log(`   Generated SQL:\n   ${sqlText}\n`);

    // Test 3: Rate limit check
    console.log('Test 3: Checking rate limit status...');
    const rateLimitResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Test'
          }]
        }]
      })
    });

    if (rateLimitResponse.status === 429) {
      console.warn('⚠️  Rate limit detected - you may be hitting API limits');
      console.warn('   Free tier limits: 15 requests per minute, 1500 per day');
      console.warn('   Solution: Wait a few minutes or upgrade your quota');
    } else {
      console.log('✅ No rate limiting detected\n');
    }

    console.log('=== All Tests Passed! ===');
    console.log('Your Google Gemini API key is working correctly.');
    console.log('\nAPI Limits (Free Tier):');
    console.log('  - 15 requests per minute');
    console.log('  - 1,500 requests per day');
    console.log('  - 1 million tokens per day');
    
  } catch (error: any) {
    console.error('\n❌ API Test Failed!\n');
    console.error('Error:', error.message);
    
    if (error.message?.includes('fetch')) {
      console.error('\nNetwork error - check your internet connection');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testGeminiApi()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
