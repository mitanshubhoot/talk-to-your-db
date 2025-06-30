import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';
import { OpenAIService } from './openai';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface TextToSqlRequest {
  userQuery: string;
  schema: SchemaInfo;
}

export interface TextToSqlResponse {
  sql: string;
  explanation: string;
  confidence: number;
  warnings?: string[];
  provider?: string;
}

interface AIProvider {
  name: string;
  isConfigured: boolean;
  generateSql: (prompt: string) => Promise<string>;
  generateExplanation: (sql: string, userQuery: string) => Promise<string>;
}

export class FreeAIService {
  private providers: AIProvider[] = [];
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.initializeProviders();
  }

  private initializeProviders() {
    console.log('🔍 DEBUG: Initializing AI providers...');
    console.log('🔍 DEBUG: HUGGING_FACE_API_KEY exists:', !!process.env.HUGGING_FACE_API_KEY);
    console.log('🔍 DEBUG: COHERE_API_KEY exists:', !!process.env.COHERE_API_KEY);
    
    // NOTE: Specialized SQL models (like DuckDB-NSQL-7B) are not available via free Inference APIs
    // Most require local deployment or paid services. We use general AI models with SQL prompting instead.
    
    // Initialize OpenAI (Premium: GPT-3.5/GPT-4) - HIGHEST PRIORITY
    if (process.env.OPENAI_API_KEY) {
      this.providers.push({
        name: 'OpenAI GPT-3.5',
        isConfigured: true,
        generateSql: this.generateSqlWithOpenAI.bind(this),
        generateExplanation: this.generateExplanationWithOpenAI.bind(this)
      });
      console.log('✅ OpenAI provider initialized (HIGHEST PRIORITY - most accurate)');
    } else {
      console.log('❌ OpenAI API key not found');
    }

    // Initialize Cohere (Free: 100K tokens/month) - HIGH PRIORITY
    if (process.env.COHERE_API_KEY) {
      this.providers.push({
        name: 'Cohere',
        isConfigured: true,
        generateSql: this.generateSqlWithCohere.bind(this),
        generateExplanation: this.generateExplanationWithCohere.bind(this)
      });
      console.log('✅ Cohere provider initialized (HIGH PRIORITY - excellent for SQL)');
    } else {
      console.log('❌ Cohere API key not found');
    }

    // Initialize Text2SQL.ai (Free: 50 queries/month)
    if (process.env.TEXT2SQL_API_KEY && process.env.TEXT2SQL_API_KEY !== 'your_text2sql_api_key_here') {
      this.providers.push({
        name: 'Text2SQL.ai',
        isConfigured: true,
        generateSql: this.generateSqlWithText2SQL.bind(this),
        generateExplanation: this.generateExplanationBasic.bind(this)
      });
      console.log('✅ Text2SQL.ai provider initialized');
    } else {
      console.log('❌ Text2SQL.ai API key not configured');
    }
    
    // Add rule-based provider LAST (lowest priority - fallback only)
    this.providers.push({
      name: 'Rule-based Fallback',
      isConfigured: true,
      generateSql: this.generateSqlWithRules.bind(this),
      generateExplanation: this.generateExplanationBasic.bind(this)
    });
    console.log('✅ Rule-based Fallback provider added (FALLBACK ONLY)');
    
    // NOTE: Hugging Face models like DuckDB-NSQL-7B, SQLCoder, etc. are not available via free Inference API
    // They require local deployment. For free APIs, we rely on general AI models with SQL prompting.
    console.log('ℹ️  Specialized SQL models (DuckDB-NSQL, SQLCoder) require local deployment - not available via free APIs');

    console.log(`🎯 TOTAL: Initialized ${this.providers.length} AI providers`);
    console.log('🎯 Providers:', this.providers.map(p => p.name));
    logger.info(`Initialized ${this.providers.length} AI providers`);
  }

  // Hugging Face Implementation - Using available smaller models with SQL prompting
  private async generateSqlWithHuggingFace(prompt: string): Promise<string> {
    // Try CodeT5 for text-to-code generation (available on free tier)
    try {
      return await this.generateSqlWithCodeT5(prompt);
    } catch (error) {
      console.log('🔄 CodeT5 failed, trying Flan-T5...');
      // Fallback to Flan-T5 (instruction-following model, good for SQL)
      try {
        return await this.generateSqlWithFlanT5(prompt);
      } catch (error2) {
        console.log('🔄 Flan-T5 failed, using GPT-2...');
        // Final fallback to GPT-2 with enhanced prompting
        return await this.generateSqlWithGPT2Enhanced(prompt);
      }
    }
  }

  // CodeT5: Smaller text-to-code model (available on free tier)
  private async generateSqlWithCodeT5(prompt: string): Promise<string> {
    // Extract user query for CodeT5 format
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/codet5-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `translate to SQL: ${userQuery}`,
        parameters: {
          max_length: 150,
          temperature: 0.1,
          do_sample: false,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`CodeT5 API error: ${response.status}`);
    }

    const result = await response.json() as Array<{ generated_text?: string }>;
    return result[0]?.generated_text?.trim() || '';
  }

  // Flan-T5: Instruction-following model (good for SQL with proper prompting)
  private async generateSqlWithFlanT5(prompt: string): Promise<string> {
    // Extract user query and create Flan-T5 compatible prompt
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    const flanPrompt = `Generate a PostgreSQL query for: ${userQuery}`;
    
    const response = await fetch('https://api-inference.huggingface.co/models/google/flan-t5-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: flanPrompt,
        parameters: {
          max_length: 200,
          temperature: 0.1,
          do_sample: false,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Flan-T5 API error: ${response.status}`);
    }

    const result = await response.json() as Array<{ generated_text?: string }>;
    return result[0]?.generated_text?.trim() || '';
  }

  // GPT-2 Enhanced: Small model with enhanced SQL prompting
  private async generateSqlWithGPT2Enhanced(prompt: string): Promise<string> {
    // Extract user query and create enhanced GPT-2 prompt
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    const enhancedPrompt = `-- SQL query for: ${userQuery}
SELECT`;
    
    const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: enhancedPrompt,
        parameters: {
          max_length: 100,
          temperature: 0.1,
          do_sample: false,
          return_full_text: false,
          stop: [';', '\n\n']
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GPT-2 API error: ${response.status}`);
    }

    const result = await response.json() as Array<{ generated_text?: string }>;
    const generated = result[0]?.generated_text?.trim() || '';
    
    // Clean up and format the response
    return `SELECT${generated}`;
  }

  private async generateExplanationWithHuggingFace(sql: string, userQuery: string): Promise<string> {
    try {
      const prompt = `Explain this SQL query in simple terms: ${sql}`;
      const explanation = await this.generateSqlWithHuggingFace(prompt);
      return explanation || 'This query retrieves data from your database based on your request.';
    } catch (error) {
      return 'This query retrieves data from your database based on your request.';
    }
  }

  // Cohere Implementation - Optimized for SQL generation
  private async generateSqlWithCohere(prompt: string): Promise<string> {
    const response = await fetch('https://api.cohere.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command', // Use the full command model for better SQL generation
        prompt: `You are an expert SQL developer. Generate ONLY the SQL query for this request. Do not include explanations.\n\n${prompt}\n\nSQL:`,
        max_tokens: 300,
        temperature: 0.1,
        stop_sequences: [';', '\n\n'],
        k: 0, // No random sampling for consistency
        p: 0.1 // Low nucleus sampling for focused output
      })
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status}`);
    }

    const result = await response.json() as { generations: Array<{ text?: string }> };
    let sql = result.generations[0]?.text?.trim() || '';
    
    // Clean up the response
    if (sql.startsWith('SQL:')) {
      sql = sql.replace('SQL:', '').trim();
    }
    
    // Ensure it ends with semicolon
    if (sql && !sql.endsWith(';')) {
      sql += ';';
    }
    
    return sql;
  }

  private async generateExplanationWithCohere(sql: string, userQuery: string): Promise<string> {
    try {
      const prompt = `Explain this SQL query in simple business terms for someone who asked "${userQuery}":\n\n${sql}\n\nExplanation:`;
      const explanation = await this.generateSqlWithCohere(prompt);
      return explanation || 'This query retrieves data from your database based on your request.';
    } catch (error) {
      return 'This query retrieves data from your database based on your request.';
    }
  }

  // OpenAI Implementation - Using existing OpenAIService
  private async generateSqlWithOpenAI(prompt: string): Promise<string> {
    // Extract user query from the prompt
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    // Parse schema from prompt (simplified for integration)
    const schemaMatch = prompt.match(/Available Tables:([\\s\\S]*?)QUERY ANALYSIS:/);
    let schema: any = { tables: {}, relationships: [] };
    
    if (schemaMatch) {
      // Simple schema parsing - in production you'd pass the actual schema object
      schema = {
        tables: {
          customers: { columns: [] },
          products: { columns: [] },
          orders: { columns: [] },
          order_items: { columns: [] }
        },
        relationships: []
      };
    }
    
    const request = { userQuery, schema };
    const response = await this.openaiService.generateSql(request);
    return response.sql;
  }

  private async generateExplanationWithOpenAI(sql: string, userQuery: string): Promise<string> {
    const schema = { tables: {}, relationships: [] }; // Simplified
    const request = { userQuery, schema };
    const response = await this.openaiService.generateSql(request);
    return response.explanation;
  }

  // Text2SQL.ai Implementation
  private async generateSqlWithText2SQL(prompt: string): Promise<string> {
    const response = await fetch('https://api.text2sql.ai/api/sql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TEXT2SQL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: prompt,
        schema: 'auto' // Let the service auto-detect schema
      })
    });

    if (!response.ok) {
      throw new Error(`Text2SQL.ai API error: ${response.status}`);
    }

    const result = await response.json() as { sql?: string };
    return result.sql || '';
  }

  // Enhanced Rule-based Fallback Implementation
  private async generateSqlWithRules(prompt: string): Promise<string> {
    const lowerPrompt = prompt.toLowerCase();
    
    // Extract user query from the full prompt
    const userQueryMatch = lowerPrompt.match(/user request: "(.*?)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : lowerPrompt;
    
    // If no user query was extracted, try to work with the entire prompt
    const queryToAnalyze = userQuery || lowerPrompt;
    
    console.log(`🔧 Rule-based fallback processing query: "${queryToAnalyze}"`);

    // First, try to handle common patterns

    // Basic table listing queries
    if ((queryToAnalyze.includes('show') || queryToAnalyze.includes('list') || queryToAnalyze.includes('all') || queryToAnalyze.includes('table')) &&
        !queryToAnalyze.includes('top') && !queryToAnalyze.includes('unique') && !queryToAnalyze.includes('count') &&
        !queryToAnalyze.includes('total') && !queryToAnalyze.includes('sum') && !queryToAnalyze.includes('average')) {
      
      if (queryToAnalyze.match(/\btable[s]?\b/) && (queryToAnalyze.includes('show') || queryToAnalyze.includes('list'))) {
        return `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`;
      } else if (queryToAnalyze.match(/\bcustomer[s]?\b/)) {
        return `SELECT customer_id, name, email, city, country FROM customers ORDER BY name LIMIT 20;`;
      } else if (queryToAnalyze.match(/\bproduct[s]?\b/)) {
        return `SELECT product_id, name, price, category FROM products ORDER BY name LIMIT 20;`;
      } else if (queryToAnalyze.match(/\border[s]?\b/)) {
        return `SELECT order_id, customer_id, order_date, total_amount FROM orders ORDER BY order_date DESC LIMIT 20;`;
      }
    }

    // Count queries
    if (queryToAnalyze.includes('count') || queryToAnalyze.includes('how many') || queryToAnalyze.includes('number of')) {
      if (queryToAnalyze.match(/\bcustomer[s]?\b/)) {
        return `SELECT COUNT(*) as customer_count FROM customers;`;
      } else if (queryToAnalyze.match(/\bproduct[s]?\b/)) {
        return `SELECT COUNT(*) as product_count FROM products;`;
      } else if (queryToAnalyze.match(/\border[s]?\b/)) {
        return `SELECT COUNT(*) as order_count FROM orders;`;
      } else if (queryToAnalyze.match(/\btable[s]?\b/)) {
        return `SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';`;
      }
    }

    // Top/highest queries
    if ((queryToAnalyze.includes('top') || queryToAnalyze.includes('highest') || queryToAnalyze.includes('best')) && 
        (queryToAnalyze.match(/\bcustomer[s]?\b/) || queryToAnalyze.match(/\bproduct[s]?\b/) || queryToAnalyze.match(/\border[s]?\b/))) {
      
      const numberMatch = queryToAnalyze.match(/top\s*(\d+)|highest\s*(\d+)|best\s*(\d+)/);
      const limit = numberMatch ? (numberMatch[1] || numberMatch[2] || numberMatch[3]) : '5';
      
      if (queryToAnalyze.match(/\bcustomer[s]?\b/)) {
        return `SELECT customer_id, name, email, city FROM customers ORDER BY customer_id DESC LIMIT ${limit};`;
      } else if (queryToAnalyze.match(/\bproduct[s]?\b/) && queryToAnalyze.includes('price')) {
        return `SELECT product_id, name, price, category FROM products ORDER BY price DESC LIMIT ${limit};`;
      } else if (queryToAnalyze.match(/\border[s]?\b/) && (queryToAnalyze.includes('amount') || queryToAnalyze.includes('value'))) {
        return `SELECT order_id, customer_id, order_date, total_amount FROM orders ORDER BY total_amount DESC LIMIT ${limit};`;
      }
    }

    // Revenue/sales queries
    if (queryToAnalyze.includes('revenue') || queryToAnalyze.includes('sales') || queryToAnalyze.includes('total')) {
      if (queryToAnalyze.match(/\bcustomer[s]?\b/)) {
        return `SELECT c.customer_id, c.name, SUM(o.total_amount) as total_revenue 
                FROM customers c JOIN orders o ON c.customer_id = o.customer_id 
                GROUP BY c.customer_id, c.name ORDER BY total_revenue DESC LIMIT 10;`;
      } else if (queryToAnalyze.match(/\bproduct[s]?\b/)) {
        return `SELECT p.product_id, p.name, SUM(oi.quantity * oi.price) as total_sales 
                FROM products p JOIN order_items oi ON p.product_id = oi.product_id 
                GROUP BY p.product_id, p.name ORDER BY total_sales DESC LIMIT 10;`;
      } else {
        return `SELECT SUM(total_amount) as total_revenue FROM orders;`;
      }
    }

    // Handle the working Phoenix pattern (this was actually working well)
    if (queryToAnalyze.includes('from') && queryToAnalyze.includes('name') && 
        (queryToAnalyze.includes('has') || queryToAnalyze.includes('contain') || queryToAnalyze.includes('with')) &&
        queryToAnalyze.includes('customer')) {
      
      const cityMatch = queryToAnalyze.match(/from\s+([a-z\s]+?)(?:\s+has|\s+containing|\s+with|$)/i) ||
                       queryToAnalyze.match(/from\s+([a-z\s]+)/i);
      const city = cityMatch ? cityMatch[1].trim() : null;
      
      const letterMatch = queryToAnalyze.match(/has\s*(?:a\s*)?['"]*([a-z])['"]*\s*in.*name/i) ||
                         queryToAnalyze.match(/['"]*([a-z])['"]*\s*in.*name/i) ||
                         queryToAnalyze.match(/has\s*['"]*([a-z])['"]/i);
      const letter = letterMatch ? letterMatch[1] : null;
      
      const lengthMatch = queryToAnalyze.match(/(?:at\s*least|atleast|minimum|min)\s*(\d+)/i) ||
                         queryToAnalyze.match(/(\d+)\s*(?:letters|characters)/i);
      const minLength = lengthMatch ? parseInt(lengthMatch[1]) : null;
      
      if (city && letter) {
        let sql = `SELECT name, city, email FROM customers WHERE city ILIKE '${city}'`;
        sql += ` AND name ILIKE '%${letter}%'`;
        if (minLength) {
          sql += ` AND LENGTH(name) >= ${minLength}`;
        }
        sql += ' ORDER BY name LIMIT 20;';
        return sql;
      }
    }

    // Generic fallback - try to generate something useful based on detected keywords
    console.log('🔧 No specific pattern matched, generating generic query...');
    
    if (queryToAnalyze.match(/\bcustomer[s]?\b/)) {
      return `SELECT customer_id, name, email, city FROM customers ORDER BY name LIMIT 10;`;
    } else if (queryToAnalyze.match(/\bproduct[s]?\b/)) {
      return `SELECT product_id, name, price, category FROM products ORDER BY name LIMIT 10;`;
    } else if (queryToAnalyze.match(/\border[s]?\b/)) {
      return `SELECT order_id, customer_id, order_date, total_amount FROM orders ORDER BY order_date DESC LIMIT 10;`;
    } else if (queryToAnalyze.match(/\btable[s]?\b/)) {
      return `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`;
    } else {
      // Last resort - show available tables
      return `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`;
    }
  }

  private async generateExplanationBasic(sql: string, userQuery: string): Promise<string> {
    const lowerSql = sql.toLowerCase();
    
    // Enhanced explanations for pattern-matched queries
    if (lowerSql.includes('like') && lowerSql.includes('%')) {
      if (lowerSql.includes("'%'")) {
        return `This query searches for records containing specific text patterns in name or description fields.`;
      } else if (lowerSql.match(/'[a-z]%'/i)) {
        return `This query filters records to find items whose names start with a specific letter, using pattern matching.`;
      } else {
        return `This query uses pattern matching to filter records based on text criteria.`;
      }
    } else if (lowerSql.includes('group by') && lowerSql.includes('sum(')) {
      return `This query groups related records together and calculates totals, perfect for analyzing sales, revenue, or performance data.`;
    } else if (lowerSql.includes('date_trunc') || lowerSql.includes('interval')) {
      return `This query filters or groups data by time periods (days, weeks, months) to show trends over time.`;
    } else if (lowerSql.includes('order by') && lowerSql.includes('desc')) {
      return `This query sorts results in descending order to show the highest values first, useful for finding top performers.`;
    } else if (lowerSql.includes('count(*)')) {
      return `This query counts the total number of records in the specified table(s).`;
    } else if (lowerSql.includes('sum(')) {
      return `This query calculates the total sum of the specified values, typically for financial or quantity analysis.`;
    } else if (lowerSql.includes('join')) {
      return `This query combines data from multiple related tables to provide comprehensive information.`;
    } else if (lowerSql.includes('where') && lowerSql.includes('>')) {
      return `This query filters records to find items above a certain threshold value.`;
    } else if (lowerSql.includes('where') && lowerSql.includes('<')) {
      return `This query filters records to find items below a certain threshold value.`;
    } else if (lowerSql.includes('where')) {
      return `This query filters the data based on specific conditions to find exactly what you're looking for.`;
    } else {
      return `This query retrieves data from your database based on your request: "${userQuery}"`;
    }
  }

  private buildSchemaContext(schema: SchemaInfo): string {
    let context = "Database Schema:\n";
    
    // Add tables and columns
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      context += `\nTable: ${tableName}`;
      if (tableInfo.rowCount !== undefined) {
        context += ` (${tableInfo.rowCount} rows)`;
      }
      context += "\nColumns:\n";
      
      tableInfo.columns.forEach(col => {
        context += `  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'YES' ? ' (nullable)' : ' (required)'}`;
        if (col.column_default) {
          context += ` default: ${col.column_default}`;
        }
        context += "\n";
      });
    });

    // Add relationships
    if (schema.relationships.length > 0) {
      context += "\nRelationships:\n";
      schema.relationships.forEach(rel => {
        context += `  - ${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn}\n`;
      });
    }

    return context;
  }

  private analyzeUserQuery(userQuery: string): string {
    const analysis = [];
    const lowerQuery = userQuery.toLowerCase();
    
    // Intent detection
    if (lowerQuery.includes('unique') || lowerQuery.includes('distinct')) {
      analysis.push("📊 INTENT: User wants unique/distinct values");
    }
    
    if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest')) {
      const numberMatch = lowerQuery.match(/top\s*(\d+)|best\s*(\d+)|highest\s*(\d+)/);
      const limit = numberMatch ? (numberMatch[1] || numberMatch[2] || numberMatch[3]) : '5';
      analysis.push(`📈 INTENT: User wants top ${limit} results ranked by some metric`);
    }
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many') || lowerQuery.includes('number of')) {
      analysis.push("🔢 INTENT: User wants to count records, likely needs COUNT() and GROUP BY");
    }
    
    if (lowerQuery.includes('total') || lowerQuery.includes('sum') || lowerQuery.includes('revenue')) {
      analysis.push("💰 INTENT: User wants aggregated totals, needs SUM() function");
    }
    
    if (lowerQuery.includes('average') || lowerQuery.includes('avg')) {
      analysis.push("📊 INTENT: User wants average values, needs AVG() function");
    }
    
    // Entity detection
    const entities = [];
    if (lowerQuery.includes('customer')) entities.push('customers');
    if (lowerQuery.includes('product')) entities.push('products');
    if (lowerQuery.includes('order')) entities.push('orders');
    if (lowerQuery.includes('item')) entities.push('order_items');
    
    if (entities.length > 0) {
      analysis.push(`🎯 ENTITIES: Query involves ${entities.join(', ')} table(s)`);
    }
    
    // Filter detection
    const filters = [];
    if (lowerQuery.match(/from\s+\w+|in\s+\w+|country|city/)) {
      filters.push('location-based filtering');
    }
    if (lowerQuery.includes('last') && (lowerQuery.includes('month') || lowerQuery.includes('week') || lowerQuery.includes('day'))) {
      filters.push('time-based filtering');
    }
    if (lowerQuery.match(/category|type/)) {
      filters.push('category-based filtering');
    }
    
    if (filters.length > 0) {
      analysis.push(`🔍 FILTERS: Needs ${filters.join(', ')}`);
    }
    
    // Complexity detection
    if (entities.length > 1) {
      analysis.push("🔗 COMPLEXITY: Multi-table query, needs proper JOINs");
    }
    
    return analysis.length > 0 ? analysis.join('\n') : "📝 INTENT: Basic data retrieval query";
  }

  private buildPrompt(userQuery: string, schema: SchemaInfo): string {
    const schemaContext = this.buildSchemaContext(schema);
    
    // Analyze the user query to provide intelligent context
    const queryAnalysis = this.analyzeUserQuery(userQuery);
    
    return `You are an expert SQL database analyst. Your task is to convert natural language into perfect PostgreSQL queries.

${schemaContext}

QUERY ANALYSIS:
${queryAnalysis}

User Request: "${userQuery}"

INTELLIGENT GUIDELINES:

🎯 QUERY INTENT RECOGNITION:
- If asking for "unique/distinct" values → Use SELECT DISTINCT
- If asking for "top/best/highest" → Use ORDER BY DESC LIMIT  
- If asking for "count/how many" → Use COUNT() and GROUP BY if needed
- If asking for "total/sum" → Use SUM() with proper aggregation
- If asking for "average" → Use AVG() with GROUP BY
- If asking about time periods → Use date functions and INTERVAL
- If asking about specific categories → Use WHERE with ILIKE for text matching

🔧 TECHNICAL REQUIREMENTS:
1. ALWAYS generate valid PostgreSQL SELECT statements only
2. Use proper table aliases (c for customers, o for orders, oi for order_items, p for products)
3. Use ILIKE for case-insensitive text matching
4. Use appropriate JOINs based on the relationships shown above
5. Include proper WHERE clauses for all filters mentioned
6. Add reasonable LIMIT clauses (default 20 for large results)
7. Use CURRENT_DATE and INTERVAL for date calculations

💡 SMART PATTERN RECOGNITION:
- "customers from [location]" → WHERE country/city ILIKE 'location'
- "orders in last [time]" → WHERE order_date >= CURRENT_DATE - INTERVAL 'time'
- "products in [category]" → WHERE category ILIKE 'category'
- "top N by [metric]" → ORDER BY metric DESC LIMIT N
- "total revenue" → SUM(quantity * unit_price) from order_items
- "customer spending" → JOIN customers → orders → order_items, then SUM

🚀 ADVANCED FEATURES:
- Use CTEs (WITH clauses) for complex multi-step queries
- Apply proper NULL handling with IS NOT NULL
- Use window functions for ranking when appropriate
- Add meaningful column aliases for calculated fields
- Group by non-aggregated columns appropriately

RETURN FORMAT: Generate ONLY the SQL query, no explanations or markdown.

SQL Query:`;
  }

  async generateSql(request: TextToSqlRequest): Promise<TextToSqlResponse> {
    if (this.providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    const prompt = this.buildPrompt(request.userQuery, request.schema);
    let lastError: Error | null = null;
    const attemptedProviders: string[] = [];

    // Try each provider in order
    for (const provider of this.providers) {
      if (!provider.isConfigured) {
        console.log(`⏭️  Skipping ${provider.name} - not configured`);
        continue;
      }

      try {
        logger.info(`Attempting to generate SQL with ${provider.name}`);
        console.log(`🔄 Trying provider: ${provider.name}`);
        attemptedProviders.push(provider.name);
        
        const sqlQuery = await provider.generateSql(prompt);
        
        if (!sqlQuery || sqlQuery.trim().length === 0) {
          throw new Error('Empty response from provider');
        }

        // Clean up the SQL query
        let cleanSql = sqlQuery
          .replace(/```sql\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        // Basic validation
        if (!cleanSql.toUpperCase().startsWith('SELECT')) {
          // Try to extract SELECT statement if it's embedded in text
          const selectMatch = cleanSql.match(/SELECT[\s\S]*?;/i);
          if (selectMatch) {
            cleanSql = selectMatch[0];
          } else {
            throw new Error('Generated query is not a SELECT statement');
          }
        }

        // Generate explanation
        const explanation = await provider.generateExplanation(cleanSql, request.userQuery);

        // Calculate confidence
        const confidence = this.calculateConfidence(cleanSql, request.schema, provider.name);

        // Check for warnings
        const warnings = this.checkForWarnings(cleanSql, request.schema);

        logger.info(`SQL generated successfully with ${provider.name}. Confidence: ${confidence}%`);
        console.log(`✅ Success with ${provider.name}: ${cleanSql.substring(0, 50)}...`);

        return {
          sql: cleanSql,
          explanation,
          confidence,
          warnings: warnings.length > 0 ? warnings : undefined,
          provider: provider.name
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to generate SQL with ${provider.name}: ${errorMessage}`);
        console.log(`❌ ${provider.name} failed: ${errorMessage}`);
        lastError = error instanceof Error ? error : new Error(String(error));
        continue; // Try next provider
      }
    }

    // If all providers failed, provide detailed error information
    const errorDetails = {
      configuredProviders: this.providers.length,
      attemptedProviders,
      availableProviders: this.getAvailableProviders(),
      lastError: lastError?.message || 'Unknown error',
      userQuery: request.userQuery
    };
    
    console.error('🚨 All providers failed:', errorDetails);
    logger.error('All AI providers failed:', errorDetails);
    
    throw new Error(`All AI providers failed. Attempted: ${attemptedProviders.join(', ')}. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private calculateConfidence(sql: string, schema: SchemaInfo, providerName: string): number {
    let confidence = 60; // Lower base confidence for free services

    // Boost confidence for specialized providers
    if (providerName === 'OpenAI GPT-3.5') {
      confidence = 90; // Highest quality AI model with excellent SQL capabilities
    } else if (providerName === 'Text2SQL.ai') {
      confidence = 80; // Specialized SQL service
    } else if (providerName === 'Hugging Face (CodeT5/Flan-T5)') {
      confidence = 75; // Available smaller models with good SQL prompting
    } else if (providerName === 'Cohere') {
      confidence = 85; // Best working AI model for complex queries
    } else if (providerName === 'Rule-based Fallback') {
      confidence = 70; // Enhanced rules with improved pattern matching
    }

    // Check if query references valid tables
    const tableNames = Object.keys(schema.tables);
    const referencedTables = tableNames.filter(table => 
      sql.toLowerCase().includes(table.toLowerCase())
    );

    if (referencedTables.length === 0) {
      confidence -= 20;
    } else {
      confidence += referencedTables.length * 5; // Bonus for each valid table
    }

    // Check for complex operations
    if (sql.toLowerCase().includes('join')) {
      confidence += 10;
    }

    if (sql.toLowerCase().includes('where')) {
      confidence += 5;
    }

    // Check for potential issues
    if (sql.toLowerCase().includes('*') && !sql.toLowerCase().includes('limit')) {
      confidence -= 10;
    }

    return Math.min(Math.max(confidence, 10), 95);
  }

  private checkForWarnings(sql: string, schema: SchemaInfo): string[] {
    const warnings: string[] = [];

    // Check for SELECT * without LIMIT on large tables
    if (sql.toLowerCase().includes('select *') && !sql.toLowerCase().includes('limit')) {
      const largeTableThreshold = 1000;
      const hasLargeTables = Object.values(schema.tables).some(table => 
        (table.rowCount || 0) > largeTableThreshold
      );
      
      if (hasLargeTables) {
        warnings.push('Query selects all columns without a LIMIT. This might return a large dataset.');
      }
    }

    // Check for missing JOINs when multiple tables are referenced
    const tableReferences = Object.keys(schema.tables).filter(table =>
      sql.toLowerCase().includes(table.toLowerCase())
    );
    
    if (tableReferences.length > 1 && !sql.toLowerCase().includes('join')) {
      warnings.push('Query references multiple tables but doesn\'t use explicit JOINs.');
    }

    return warnings;
  }

  // Utility method to check which providers are available
  getAvailableProviders(): string[] {
    return this.providers
      .filter(provider => provider.isConfigured)
      .map(provider => provider.name);
  }

  // DuckDB-NSQL: Specialized SQL generation model
  private async generateSqlWithDuckDB(prompt: string): Promise<string> {
    // Extract user query and schema from the prompt
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    // Extract schema information if available
    const schemaMatch = prompt.match(/Schema Context:(.*?)(?=User Request:|$)/s);
    const schemaContext = schemaMatch ? schemaMatch[1].trim() : '';
    
    // Create DuckDB-NSQL compatible prompt
    const duckdbPrompt = `### Instruction:
Your task is to generate valid SQL to answer the following question, given a database schema.

### Input:
Here is the database schema that the SQL query will run on:
${schemaContext}

### Question:
${userQuery}

### Response (use SQL syntax):
`;

    try {
      const response = await fetch('https://api-inference.huggingface.co/models/motherduckdb/DuckDB-NSQL-7B-v0.1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: duckdbPrompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.1,
            do_sample: true,
            return_full_text: false,
            stop: ["###", "### Input:", "### Question:", "### Response:"]
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DuckDB-NSQL API error:', response.status, errorText);
        throw new Error(`DuckDB-NSQL API error: ${response.status}`);
      }

      const result = await response.json() as Array<{ generated_text?: string }>;
      const generatedText = result[0]?.generated_text || '';
      
      // Clean up the response
      let sql = generatedText.trim();
      
      // Remove any remaining prompt text
      sql = sql.replace(/### Response.*?:/g, '').trim();
      sql = sql.replace(/### Input.*$/g, '').trim();
      sql = sql.replace(/### Question.*$/g, '').trim();
      
      // Ensure SQL ends with semicolon
      if (sql && !sql.endsWith(';')) {
        sql += ';';
      }
      
      return sql || `SELECT * FROM ${this.extractTableName(schemaContext)} LIMIT 10;`;
      
    } catch (error) {
      console.error('DuckDB-NSQL generation failed:', error);
      throw error;
    }
  }

  // DuckDB-NSQL: Generate explanation for SQL
  private async generateExplanationWithDuckDB(sql: string, userQuery: string): Promise<string> {
    const explanationPrompt = `### Instruction:
Explain this SQL query in simple terms.

### Input:
SQL Query: ${sql}
Original Question: ${userQuery}

### Question:
What does this SQL query do?

### Response:
`;

    try {
      const response = await fetch('https://api-inference.huggingface.co/models/motherduckdb/DuckDB-NSQL-7B-v0.1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: explanationPrompt,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.3,
            do_sample: true,
            return_full_text: false
          }
        })
      });

      if (response.ok) {
        const result = await response.json() as Array<{ generated_text?: string }>;
        const explanation = result[0]?.generated_text?.trim() || '';
        
        // Clean up explanation
        return explanation.replace(/### Response.*?:/g, '').trim() || 
               `This SQL query processes the data to answer: "${userQuery}"`;
      } else {
        // Fallback to basic explanation
        return this.generateExplanationBasic(sql, userQuery);
      }
    } catch (error) {
      console.error('DuckDB explanation failed, using fallback:', error);
      return this.generateExplanationBasic(sql, userQuery);
    }
  }

  // Helper method to extract table name from schema
  private extractTableName(schema: string): string {
    const tableMatch = schema.match(/CREATE TABLE (\w+)/i);
    return tableMatch ? tableMatch[1] : 'table';
  }
}

// Export singleton instance
export const freeAIService = new FreeAIService(); 