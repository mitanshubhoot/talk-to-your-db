import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database.js';
import { OpenAIService } from './openai.js';
import { AdvancedPromptTemplates, PromptTemplate } from './promptTemplates.js';
import { dialectAwareService, DialectAwareRequest, DialectAwareService } from './dialectAwareService.js';
import { DatabaseDialect } from '../types/database.js';
import { productionMonitoringService } from './productionMonitoringService.js';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface TextToSqlRequest {
  userQuery: string;
  schema: SchemaInfo;
  databaseDialect?: string;
  connectionType?: string;
}

export interface TextToSqlResponse {
  sql: string;
  explanation: string;
  confidence: number;
  warnings?: string[];
  provider?: string;
  dialectUsed?: string;
  optimizationSuggestions?: string[];
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
    console.log('🔍 DEBUG: ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
    console.log('🔍 DEBUG: GOOGLE_API_KEY exists:', !!process.env.GOOGLE_API_KEY);
    
    // Initialize OpenAI (Premium: GPT-3.5/GPT-4) - HIGHEST PRIORITY
    if (process.env.OPENAI_API_KEY) {
      this.providers.push({
        name: 'OpenAI GPT-4',
        isConfigured: true,
        generateSql: this.generateSqlWithOpenAI.bind(this, 'gpt-4'),
        generateExplanation: this.generateExplanationWithOpenAI.bind(this)
      });
      
      this.providers.push({
        name: 'OpenAI GPT-3.5-Turbo',
        isConfigured: true,
        generateSql: this.generateSqlWithOpenAI.bind(this, 'gpt-3.5-turbo'),
        generateExplanation: this.generateExplanationWithOpenAI.bind(this)
      });
      console.log('✅ OpenAI providers initialized (HIGHEST PRIORITY - most accurate)');
    } else {
      console.log('❌ OpenAI API key not found');
    }

    // Initialize Anthropic Claude (High-quality SQL generation)
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.push({
        name: 'Anthropic Claude',
        isConfigured: true,
        generateSql: this.generateSqlWithAnthropic.bind(this),
        generateExplanation: this.generateExplanationWithAnthropic.bind(this)
      });
      console.log('✅ Anthropic Claude provider initialized (HIGH PRIORITY - excellent reasoning)');
    } else {
      console.log('❌ Anthropic API key not found');
    }

    // Initialize Google Gemini (Free tier available)
    if (process.env.GOOGLE_API_KEY) {
      this.providers.push({
        name: 'Google Gemini',
        isConfigured: true,
        generateSql: this.generateSqlWithGemini.bind(this),
        generateExplanation: this.generateExplanationWithGemini.bind(this)
      });
      console.log('✅ Google Gemini provider initialized (HIGH PRIORITY - free tier available)');
    } else {
      console.log('❌ Google API key not found');
    }

    // Initialize Hugging Face Inference API with specialized SQL models
    if (process.env.HUGGING_FACE_API_KEY) {
      // SQLCoder - Specialized SQL generation model
      this.providers.push({
        name: 'Hugging Face SQLCoder',
        isConfigured: true,
        generateSql: this.generateSqlWithSQLCoder.bind(this),
        generateExplanation: this.generateExplanationWithHuggingFace.bind(this)
      });

      // CodeT5+ - Code generation model with SQL capabilities
      this.providers.push({
        name: 'Hugging Face CodeT5+',
        isConfigured: true,
        generateSql: this.generateSqlWithCodeT5Plus.bind(this),
        generateExplanation: this.generateExplanationWithHuggingFace.bind(this)
      });

      // DuckDB-NSQL - Specialized for SQL with schema awareness
      this.providers.push({
        name: 'Hugging Face DuckDB-NSQL',
        isConfigured: true,
        generateSql: this.generateSqlWithDuckDB.bind(this),
        generateExplanation: this.generateExplanationWithDuckDB.bind(this)
      });

      console.log('✅ Hugging Face specialized SQL models initialized');
    } else {
      console.log('❌ Hugging Face API key not found');
    }

    // Initialize Cohere (Free: 100K tokens/month) - HIGH PRIORITY
    if (process.env.COHERE_API_KEY) {
      this.providers.push({
        name: 'Cohere Command',
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

    console.log(`🎯 TOTAL: Initialized ${this.providers.length} AI providers`);
    console.log('🎯 Providers:', this.providers.map(p => p.name));
    logger.info(`Initialized ${this.providers.length} AI providers`);
  }

  // SQLCoder - Specialized SQL generation model
  private async generateSqlWithSQLCoder(prompt: string): Promise<string> {
    // Extract user query and schema context for SQLCoder format
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    const schemaMatch = prompt.match(/Database Schema:(.*?)(?=QUERY ANALYSIS:|User Request:|$)/s);
    const schemaContext = schemaMatch ? schemaMatch[1].trim() : '';
    
    // Create SQLCoder compatible prompt
    const sqlcoderPrompt = `### Task
Generate a SQL query to answer the following question:
${userQuery}

### Database Schema
${schemaContext}

### SQL
`;

    try {
      const response = await fetch('https://api-inference.huggingface.co/models/defog/sqlcoder-7b-2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: sqlcoderPrompt,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.1,
            do_sample: false,
            return_full_text: false,
            stop: ["###", "### Task", "### Database Schema", "### SQL"]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`SQLCoder API error: ${response.status}`);
      }

      const result = await response.json() as Array<{ generated_text?: string }>;
      let sql = result[0]?.generated_text?.trim() || '';
      
      // Clean up the response
      sql = sql.replace(/### SQL.*?:/g, '').trim();
      
      // Ensure SQL ends with semicolon
      if (sql && !sql.endsWith(';')) {
        sql += ';';
      }
      
      return sql || this.generateFallbackSql(userQuery, schemaContext);
      
    } catch (error) {
      console.error('SQLCoder generation failed:', error);
      throw error;
    }
  }

  // CodeT5+ - Enhanced code generation model
  private async generateSqlWithCodeT5Plus(prompt: string): Promise<string> {
    const userQueryMatch = prompt.match(/User Request: "([^"]+)"/);
    const userQuery = userQueryMatch ? userQueryMatch[1] : prompt;
    
    const schemaMatch = prompt.match(/Database Schema:(.*?)(?=QUERY ANALYSIS:|User Request:|$)/s);
    const schemaContext = schemaMatch ? schemaMatch[1].trim() : '';
    
    // Create CodeT5+ compatible prompt
    const codet5Prompt = `# Generate SQL query
# Question: ${userQuery}
# Schema: ${schemaContext}
# SQL:`;

    try {
      const response = await fetch('https://api-inference.huggingface.co/models/Salesforce/codet5p-770m', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: codet5Prompt,
          parameters: {
            max_new_tokens: 200,
            temperature: 0.1,
            do_sample: false,
            return_full_text: false,
            stop: ["\n\n", "# Generate", "# Question", "# Schema"]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`CodeT5+ API error: ${response.status}`);
      }

      const result = await response.json() as Array<{ generated_text?: string }>;
      let sql = result[0]?.generated_text?.trim() || '';
      
      // Clean up the response
      sql = sql.replace(/# SQL.*?:/g, '').trim();
      
      // Ensure SQL ends with semicolon
      if (sql && !sql.endsWith(';')) {
        sql += ';';
      }
      
      return sql || this.generateFallbackSql(userQuery, schemaContext);
      
    } catch (error) {
      console.error('CodeT5+ generation failed:', error);
      throw error;
    }
  }

  // Helper method to generate fallback SQL
  private generateFallbackSql(userQuery: string, schemaContext: string): string {
    const lowerQuery = userQuery.toLowerCase();
    
    // Extract table names from schema
    const tableMatches = schemaContext.match(/Table: (\w+)/g);
    const tables = tableMatches ? tableMatches.map(match => match.replace('Table: ', '')) : [];
    
    if (tables.length === 0) {
      return 'SELECT 1;'; // Minimal fallback
    }
    
    // Simple pattern matching for fallback
    if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      return `SELECT COUNT(*) FROM ${tables[0]};`;
    } else if (lowerQuery.includes('all') || lowerQuery.includes('show') || lowerQuery.includes('list')) {
      return `SELECT * FROM ${tables[0]} LIMIT 10;`;
    } else {
      return `SELECT * FROM ${tables[0]} LIMIT 10;`;
    }
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

  // OpenAI Implementation - Enhanced with model selection
  private async generateSqlWithOpenAI(model: string, prompt: string): Promise<string> {
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

  // Anthropic Claude Implementation
  private async generateSqlWithAnthropic(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `You are an expert SQL developer. Generate ONLY the SQL query for this request. Do not include explanations or markdown formatting.\n\n${prompt}\n\nSQL:`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const result = await response.json() as { content: Array<{ text?: string }> };
    let sql = result.content[0]?.text?.trim() || '';
    
    // Clean up the response
    if (sql.startsWith('SQL:')) {
      sql = sql.replace('SQL:', '').trim();
    }
    
    // Remove any markdown formatting
    sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '');
    
    // Ensure it ends with semicolon
    if (sql && !sql.endsWith(';')) {
      sql += ';';
    }
    
    return sql;
  }

  private async generateExplanationWithAnthropic(sql: string, userQuery: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 500,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: `Explain this SQL query in simple business terms for someone who asked "${userQuery}":\n\n${sql}\n\nExplanation:`
          }]
        })
      });

      if (response.ok) {
        const result = await response.json() as { content: Array<{ text?: string }> };
        return result.content[0]?.text?.trim() || 'This query retrieves data from your database based on your request.';
      }
    } catch (error) {
      console.error('Anthropic explanation failed:', error);
    }
    return 'This query retrieves data from your database based on your request.';
  }

  // Google Gemini Implementation
  private async generateSqlWithGemini(prompt: string): Promise<string> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert SQL developer. Generate ONLY the SQL query for this request. Do not include explanations or markdown formatting.\n\n${prompt}\n\nSQL:`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
          stopSequences: ['\n\n']
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google Gemini API error: ${response.status}`);
    }

    const result = await response.json() as { 
      candidates: Array<{ 
        content: { 
          parts: Array<{ text?: string }> 
        } 
      }> 
    };
    
    let sql = result.candidates[0]?.content?.parts[0]?.text?.trim() || '';
    
    // Clean up the response
    if (sql.startsWith('SQL:')) {
      sql = sql.replace('SQL:', '').trim();
    }
    
    // Remove any markdown formatting
    sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '');
    
    // Ensure it ends with semicolon
    if (sql && !sql.endsWith(';')) {
      sql += ';';
    }
    
    return sql;
  }

  private async generateExplanationWithGemini(sql: string, userQuery: string): Promise<string> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Explain this SQL query in simple business terms for someone who asked "${userQuery}":\n\n${sql}\n\nExplanation:`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      });

      if (response.ok) {
        const result = await response.json() as { 
          candidates: Array<{ 
            content: { 
              parts: Array<{ text?: string }> 
            } 
          }> 
        };
        return result.candidates[0]?.content?.parts[0]?.text?.trim() || 'This query retrieves data from your database based on your request.';
      }
    } catch (error) {
      console.error('Gemini explanation failed:', error);
    }
    return 'This query retrieves data from your database based on your request.';
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
    
    // Add tables and columns with enhanced information
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      context += `\nTable: ${tableName}`;
      if (tableInfo.rowCount !== undefined) {
        context += ` (${tableInfo.rowCount.toLocaleString()} rows)`;
      }
      
      // Add primary keys
      if (tableInfo.primaryKeys && tableInfo.primaryKeys.length > 0) {
        context += ` [PK: ${tableInfo.primaryKeys.join(', ')}]`;
      }
      
      context += "\nColumns:\n";
      
      tableInfo.columns.forEach(col => {
        let columnInfo = `  - ${col.column_name}: ${col.data_type}`;
        
        // Add length/precision info
        if (col.character_maximum_length) {
          columnInfo += `(${col.character_maximum_length})`;
        } else if (col.numeric_precision && col.numeric_scale !== undefined) {
          columnInfo += `(${col.numeric_precision},${col.numeric_scale})`;
        } else if (col.numeric_precision) {
          columnInfo += `(${col.numeric_precision})`;
        }
        
        // Add constraints
        const constraints = [];
        if (col.is_primary_key) constraints.push('PK');
        if (col.is_foreign_key) constraints.push('FK');
        if (col.is_nullable === 'NO') constraints.push('NOT NULL');
        if (constraints.length > 0) {
          columnInfo += ` [${constraints.join(', ')}]`;
        }
        
        if (col.column_default) {
          columnInfo += ` default: ${col.column_default}`;
        }
        
        context += columnInfo + "\n";
      });
      
      // Add foreign key details
      if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
        context += "Foreign Keys:\n";
        tableInfo.foreignKeys.forEach(fk => {
          context += `  - ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
        });
      }
      
      // Add indexes
      if (tableInfo.indexes && tableInfo.indexes.length > 0) {
        context += "Indexes:\n";
        tableInfo.indexes.forEach(idx => {
          context += `  - ${idx.name} on (${idx.columns.join(', ')})${idx.isUnique ? ' [UNIQUE]' : ''}\n`;
        });
      }
    });

    // Add relationships summary
    if (schema.relationships && schema.relationships.length > 0) {
      context += "\nTable Relationships:\n";
      schema.relationships.forEach(rel => {
        context += `  - ${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn}\n`;
      });
    }
    
    // Add views if available
    if (schema.views && schema.views.length > 0) {
      context += "\nViews:\n";
      schema.views.forEach(view => {
        context += `  - ${view.name}\n`;
      });
    }
    
    // Add discovery timestamp
    if (schema.lastDiscovered) {
      context += `\nSchema last discovered: ${schema.lastDiscovered.toISOString()}\n`;
    }

    return context;
  }

  private analyzeUserQuery(userQuery: string, schema?: SchemaInfo): string {
    const analysis = [];
    const lowerQuery = userQuery.toLowerCase();
    
    // Intent detection
    if (lowerQuery.includes('unique') || lowerQuery.includes('distinct')) {
      analysis.push("📊 INTENT: User wants unique/distinct values - use SELECT DISTINCT");
    }
    
    if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest') || lowerQuery.includes('largest')) {
      const numberMatch = lowerQuery.match(/top\s*(\d+)|best\s*(\d+)|highest\s*(\d+)|largest\s*(\d+)/);
      const limit = numberMatch ? (numberMatch[1] || numberMatch[2] || numberMatch[3] || numberMatch[4]) : '5';
      analysis.push(`📈 INTENT: User wants top ${limit} results - use ORDER BY DESC LIMIT ${limit}`);
    }
    
    if (lowerQuery.includes('bottom') || lowerQuery.includes('worst') || lowerQuery.includes('lowest') || lowerQuery.includes('smallest')) {
      const numberMatch = lowerQuery.match(/bottom\s*(\d+)|worst\s*(\d+)|lowest\s*(\d+)|smallest\s*(\d+)/);
      const limit = numberMatch ? (numberMatch[1] || numberMatch[2] || numberMatch[3] || numberMatch[4]) : '5';
      analysis.push(`📉 INTENT: User wants bottom ${limit} results - use ORDER BY ASC LIMIT ${limit}`);
    }
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many') || lowerQuery.includes('number of')) {
      analysis.push("🔢 INTENT: User wants to count records - use COUNT() and GROUP BY if needed");
    }
    
    if (lowerQuery.includes('total') || lowerQuery.includes('sum') || lowerQuery.includes('revenue') || lowerQuery.includes('sales')) {
      analysis.push("💰 INTENT: User wants aggregated totals - use SUM() function");
    }
    
    if (lowerQuery.includes('average') || lowerQuery.includes('avg') || lowerQuery.includes('mean')) {
      analysis.push("📊 INTENT: User wants average values - use AVG() function");
    }
    
    if (lowerQuery.includes('minimum') || lowerQuery.includes('min')) {
      analysis.push("📉 INTENT: User wants minimum values - use MIN() function");
    }
    
    if (lowerQuery.includes('maximum') || lowerQuery.includes('max')) {
      analysis.push("📈 INTENT: User wants maximum values - use MAX() function");
    }
    
    // Entity detection - dynamically detect from schema if available
    const entities = [];
    if (schema) {
      Object.keys(schema.tables).forEach(tableName => {
        const tableWords = tableName.toLowerCase().split('_');
        const singularForms = tableWords.map(word => {
          // Simple singularization
          if (word.endsWith('s') && word.length > 3) {
            return word.slice(0, -1);
          }
          return word;
        });
        
        // Check if query mentions this table (plural or singular)
        if (tableWords.some(word => lowerQuery.includes(word)) || 
            singularForms.some(word => lowerQuery.includes(word))) {
          entities.push(tableName);
        }
      });
    } else {
      // Fallback to common table detection
      if (lowerQuery.includes('customer')) entities.push('customers');
      if (lowerQuery.includes('product')) entities.push('products');
      if (lowerQuery.includes('order')) entities.push('orders');
      if (lowerQuery.includes('item')) entities.push('order_items');
      if (lowerQuery.includes('user')) entities.push('users');
      if (lowerQuery.includes('category')) entities.push('categories');
    }
    
    if (entities.length > 0) {
      analysis.push(`🎯 ENTITIES: Query involves ${entities.join(', ')} table(s)`);
    }
    
    // Filter detection
    const filters = [];
    if (lowerQuery.match(/from\s+\w+|in\s+\w+|country|city|location|region/)) {
      filters.push('location-based filtering');
    }
    if (lowerQuery.includes('last') && (lowerQuery.includes('month') || lowerQuery.includes('week') || lowerQuery.includes('day') || lowerQuery.includes('year'))) {
      filters.push('time-based filtering');
    }
    if (lowerQuery.includes('this') && (lowerQuery.includes('month') || lowerQuery.includes('week') || lowerQuery.includes('day') || lowerQuery.includes('year'))) {
      filters.push('current period filtering');
    }
    if (lowerQuery.match(/category|type|status|state/)) {
      filters.push('category-based filtering');
    }
    if (lowerQuery.match(/greater than|more than|above|over|\>/)) {
      filters.push('threshold filtering (>)');
    }
    if (lowerQuery.match(/less than|fewer than|below|under|\</)) {
      filters.push('threshold filtering (<)');
    }
    if (lowerQuery.match(/between|from .* to|range/)) {
      filters.push('range filtering');
    }
    if (lowerQuery.match(/contains|includes|has|with/)) {
      filters.push('text pattern matching');
    }
    
    if (filters.length > 0) {
      analysis.push(`🔍 FILTERS: Needs ${filters.join(', ')}`);
    }
    
    // Complexity detection
    if (entities.length > 1) {
      analysis.push("🔗 COMPLEXITY: Multi-table query - needs proper JOINs based on foreign key relationships");
    }
    
    // Sorting detection
    if (lowerQuery.match(/sort|order|arrange/) && !lowerQuery.match(/top|best|highest|lowest/)) {
      if (lowerQuery.match(/descending|desc|high to low|largest first/)) {
        analysis.push("📊 SORTING: Descending order required - use ORDER BY ... DESC");
      } else if (lowerQuery.match(/ascending|asc|low to high|smallest first/)) {
        analysis.push("📊 SORTING: Ascending order required - use ORDER BY ... ASC");
      } else {
        analysis.push("📊 SORTING: Custom sorting required - determine appropriate ORDER BY");
      }
    }
    
    // Grouping detection
    if (lowerQuery.match(/by\s+\w+|per\s+\w+|each\s+\w+|group/)) {
      analysis.push("📋 GROUPING: Results need grouping - use GROUP BY");
    }
    
    return analysis.length > 0 ? analysis.join('\n') : "📝 INTENT: Basic data retrieval query";
  }

  private buildPrompt(userQuery: string, schema: SchemaInfo, databaseDialect?: string, connectionType?: string): string {
    // If dialect information is available, use dialect-aware prompting
    if (connectionType && databaseDialect) {
      return this.buildDialectAwarePrompt(userQuery, schema, databaseDialect, connectionType);
    }

    // Fallback to existing prompt building logic
    const complexity = this.assessQueryComplexity(userQuery, schema);
    let template: PromptTemplate;

    if (complexity === 'complex' || this.needsChainOfThought(userQuery)) {
      template = AdvancedPromptTemplates.getChainOfThoughtTemplate();
    } else if (this.isAnalyticsQuery(userQuery)) {
      template = AdvancedPromptTemplates.getAnalyticsTemplate();
    } else {
      template = AdvancedPromptTemplates.getSchemaAwareTemplate();
    }

    // Build the complete prompt using the selected template
    const detectedDialect = connectionType ? DialectAwareService.detectDialectFromConnection(connectionType) : 'postgresql';
    return AdvancedPromptTemplates.buildPrompt(template, userQuery, schema, detectedDialect);
  }

  private buildDialectAwarePrompt(userQuery: string, schema: SchemaInfo, databaseDialect: string, connectionType: string): string {
    // Create a mock DatabaseDialect object for the dialect service
    const dialect: DatabaseDialect = this.createDialectObject(connectionType);
    
    const dialectRequest: DialectAwareRequest = {
      userQuery,
      schema,
      dialect,
      connectionType
    };

    return dialectAwareService.buildDialectAwarePrompt(dialectRequest);
  }

  private createDialectObject(connectionType: string): DatabaseDialect {
    switch (connectionType.toLowerCase()) {
      case 'postgresql':
        return {
          name: 'PostgreSQL',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
      case 'mysql':
        return {
          name: 'MySQL',
          quotingChar: '`',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${offset}, ${limit}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
      case 'sqlite':
        return {
          name: 'SQLite',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN QUERY PLAN'
        };
      default:
        return {
          name: 'PostgreSQL',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
    }
  }

  private assessQueryComplexity(userQuery: string, schema: SchemaInfo): 'simple' | 'medium' | 'complex' {
    const lowerQuery = userQuery.toLowerCase();
    let complexityScore = 0;

    // Check for multiple tables
    const tableCount = Object.keys(schema.tables).filter(table => 
      lowerQuery.includes(table.toLowerCase()) || 
      lowerQuery.includes(table.toLowerCase().slice(0, -1)) // singular form
    ).length;
    
    if (tableCount > 2) complexityScore += 2;
    else if (tableCount > 1) complexityScore += 1;

    // Check for complex operations
    if (lowerQuery.includes('join')) complexityScore += 1;
    if (lowerQuery.includes('group by') || lowerQuery.includes('aggregate')) complexityScore += 1;
    if (lowerQuery.includes('subquery') || lowerQuery.includes('nested')) complexityScore += 2;
    if (lowerQuery.includes('window function') || lowerQuery.includes('rank')) complexityScore += 2;
    if (lowerQuery.includes('cte') || lowerQuery.includes('with clause')) complexityScore += 2;

    // Check for multiple conditions
    const conditionWords = ['where', 'and', 'or', 'having', 'case when'];
    const conditionCount = conditionWords.filter(word => lowerQuery.includes(word)).length;
    if (conditionCount > 2) complexityScore += 1;

    // Check for time-based analysis
    if (lowerQuery.includes('trend') || lowerQuery.includes('over time') || 
        lowerQuery.includes('monthly') || lowerQuery.includes('yearly')) {
      complexityScore += 1;
    }

    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'medium';
    return 'simple';
  }

  private needsChainOfThought(userQuery: string): boolean {
    const lowerQuery = userQuery.toLowerCase();
    
    // Queries that benefit from step-by-step reasoning
    return lowerQuery.includes('compare') ||
           lowerQuery.includes('analyze') ||
           lowerQuery.includes('breakdown') ||
           lowerQuery.includes('step by step') ||
           lowerQuery.includes('explain how') ||
           (lowerQuery.includes('customers') && lowerQuery.includes('orders') && lowerQuery.includes('products'));
  }

  private isAnalyticsQuery(userQuery: string): boolean {
    const lowerQuery = userQuery.toLowerCase();
    
    // Analytics-specific keywords
    return lowerQuery.includes('trend') ||
           lowerQuery.includes('revenue') ||
           lowerQuery.includes('performance') ||
           lowerQuery.includes('growth') ||
           lowerQuery.includes('analysis') ||
           lowerQuery.includes('metrics') ||
           lowerQuery.includes('kpi') ||
           lowerQuery.includes('dashboard') ||
           lowerQuery.includes('report');
  }

  private generateTableAliases(tableNames: string[]): Record<string, string> {
    const aliases: Record<string, string> = {};
    const usedAliases = new Set<string>();
    
    tableNames.forEach(tableName => {
      // Generate smart aliases
      let alias = '';
      
      // Common table patterns
      if (tableName.includes('customer')) alias = 'c';
      else if (tableName.includes('order') && !tableName.includes('item')) alias = 'o';
      else if (tableName.includes('order_item') || tableName.includes('orderitem')) alias = 'oi';
      else if (tableName.includes('product')) alias = 'p';
      else if (tableName.includes('user')) alias = 'u';
      else if (tableName.includes('category')) alias = 'cat';
      else if (tableName.includes('payment')) alias = 'pay';
      else if (tableName.includes('address')) alias = 'addr';
      else if (tableName.includes('invoice')) alias = 'inv';
      else if (tableName.includes('item')) alias = 'i';
      else {
        // Generate alias from first letters of words
        const words = tableName.split('_');
        alias = words.map(word => word.charAt(0)).join('').toLowerCase();
      }
      
      // Ensure uniqueness
      let finalAlias = alias;
      let counter = 1;
      while (usedAliases.has(finalAlias)) {
        finalAlias = alias + counter;
        counter++;
      }
      
      aliases[tableName] = finalAlias;
      usedAliases.add(finalAlias);
    });
    
    return aliases;
  }

  private buildJoinContext(schema: SchemaInfo): string {
    if (!schema.relationships || schema.relationships.length === 0) {
      return "No foreign key relationships found.";
    }
    
    const joinExamples: string[] = [];
    const processedPairs = new Set<string>();
    
    schema.relationships.forEach(rel => {
      const pairKey = `${rel.table}-${rel.referencedTable}`;
      const reversePairKey = `${rel.referencedTable}-${rel.table}`;
      
      if (!processedPairs.has(pairKey) && !processedPairs.has(reversePairKey)) {
        const tableAlias = this.generateTableAliases([rel.table, rel.referencedTable]);
        joinExamples.push(
          `${rel.table} ${tableAlias[rel.table]} JOIN ${rel.referencedTable} ${tableAlias[rel.referencedTable]} ON ${tableAlias[rel.table]}.${rel.column} = ${tableAlias[rel.referencedTable]}.${rel.referencedColumn}`
        );
        processedPairs.add(pairKey);
      }
    });
    
    return joinExamples.length > 0 ? joinExamples.join('\n') : "No clear JOIN patterns available.";
  }

  async generateSql(request: TextToSqlRequest): Promise<TextToSqlResponse> {
    if (this.providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    const prompt = this.buildPrompt(request.userQuery, request.schema, request.databaseDialect, request.connectionType);
    let lastError: Error | null = null;
    const attemptedProviders: string[] = [];

    // Try each provider in order
    for (const provider of this.providers) {
      if (!provider.isConfigured) {
        console.log(`⏭️  Skipping ${provider.name} - not configured`);
        continue;
      }

      // Check rate limits before attempting
      const rateLimitCheck = productionMonitoringService.checkRateLimit(provider.name);
      if (!rateLimitCheck.allowed) {
        console.log(`⏭️  Skipping ${provider.name} - rate limit exceeded. Resets at: ${rateLimitCheck.resetTime}`);
        continue;
      }

      const startTime = Date.now();
      try {
        logger.info(`Attempting to generate SQL with ${provider.name}`);
        console.log(`🔄 Trying provider: ${provider.name}`);
        attemptedProviders.push(provider.name);
        
        const sqlQuery = await provider.generateSql(prompt);
        const latency = Date.now() - startTime;
        
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

        // Generate optimization suggestions if dialect is known
        const optimizationSuggestions = this.generateOptimizationSuggestions(cleanSql, request.connectionType);

        logger.info(`SQL generated successfully with ${provider.name}. Confidence: ${confidence}%`);
        console.log(`✅ Success with ${provider.name}: ${cleanSql.substring(0, 50)}...`);

        // Record successful API usage
        await productionMonitoringService.recordAPIUsage(
          provider.name,
          true,
          latency,
          this.estimateTokenCount(prompt + cleanSql),
          0
        );

        return {
          sql: cleanSql,
          explanation,
          confidence,
          warnings: warnings.length > 0 ? warnings : undefined,
          provider: provider.name,
          dialectUsed: request.connectionType || 'postgresql',
          optimizationSuggestions: optimizationSuggestions.length > 0 ? optimizationSuggestions : undefined
        };

      } catch (error) {
        const latency = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to generate SQL with ${provider.name}: ${errorMessage}`);
        console.log(`❌ ${provider.name} failed: ${errorMessage}`);
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record failed API usage and track error
        await productionMonitoringService.recordAPIUsage(
          provider.name,
          false,
          latency,
          this.estimateTokenCount(prompt),
          0
        );

        await productionMonitoringService.trackError(
          provider.name,
          this.categorizeError(errorMessage),
          errorMessage,
          request.userQuery,
          0,
          error instanceof Error ? error.stack : undefined
        );

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
    let confidence = 60; // Base confidence

    // Boost confidence for specialized providers
    if (providerName === 'OpenAI GPT-4') {
      confidence = 95; // Highest quality AI model with excellent SQL capabilities
    } else if (providerName === 'OpenAI GPT-3.5-Turbo') {
      confidence = 90; // High quality AI model with excellent SQL capabilities
    } else if (providerName === 'Anthropic Claude') {
      confidence = 92; // Excellent reasoning and SQL generation
    } else if (providerName === 'Google Gemini') {
      confidence = 88; // Good quality with free tier
    } else if (providerName === 'Hugging Face SQLCoder') {
      confidence = 85; // Specialized SQL model
    } else if (providerName === 'Hugging Face DuckDB-NSQL') {
      confidence = 83; // Specialized SQL model with schema awareness
    } else if (providerName === 'Hugging Face CodeT5+') {
      confidence = 80; // Code generation model with SQL capabilities
    } else if (providerName === 'Cohere Command') {
      confidence = 85; // Best working AI model for complex queries
    } else if (providerName === 'Text2SQL.ai') {
      confidence = 80; // Specialized SQL service
    } else if (providerName === 'Hugging Face (CodeT5/Flan-T5)') {
      confidence = 75; // Available smaller models with good SQL prompting
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

  private generateOptimizationSuggestions(sql: string, connectionType?: string): string[] {
    const suggestions: string[] = [];
    const lowerSql = sql.toLowerCase();

    // General optimization suggestions
    if (lowerSql.includes('select *') && !lowerSql.includes('limit')) {
      suggestions.push('Consider adding a LIMIT clause to prevent large result sets');
    }

    if (lowerSql.includes('like \'%') && lowerSql.includes('%\'')) {
      suggestions.push('Leading wildcard searches can be slow. Consider using full-text search if available');
    }

    // Dialect-specific suggestions
    if (connectionType) {
      switch (connectionType.toLowerCase()) {
        case 'postgresql':
          if (lowerSql.includes('like') && !lowerSql.includes('ilike')) {
            suggestions.push('Consider using ILIKE for case-insensitive searches in PostgreSQL');
          }
          if (lowerSql.includes('order by') && !lowerSql.includes('limit')) {
            suggestions.push('Consider adding LIMIT when using ORDER BY to improve performance');
          }
          break;
          
        case 'mysql':
          if (lowerSql.includes('||')) {
            suggestions.push('Consider using CONCAT() function instead of || for string concatenation in MySQL');
          }
          break;
          
        case 'sqlite':
          if (lowerSql.includes('count(*)') && lowerSql.includes('group by')) {
            suggestions.push('SQLite may perform better with COUNT(column_name) instead of COUNT(*)');
          }
          break;
      }
    }

    return suggestions;
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

  // Estimate token count for cost tracking
  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  // Categorize errors for better tracking
  private categorizeError(errorMessage: string): string {
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('rate limit') || lowerError.includes('quota')) {
      return 'rate_limit';
    } else if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
      return 'timeout';
    } else if (lowerError.includes('network') || lowerError.includes('connection')) {
      return 'network_error';
    } else if (lowerError.includes('unauthorized') || lowerError.includes('authentication')) {
      return 'auth_error';
    } else if (lowerError.includes('server error') || lowerError.includes('500')) {
      return 'server_error';
    } else if (lowerError.includes('bad request') || lowerError.includes('400')) {
      return 'client_error';
    } else if (lowerError.includes('not found') || lowerError.includes('404')) {
      return 'not_found';
    } else if (lowerError.includes('unavailable') || lowerError.includes('503')) {
      return 'temporary_unavailable';
    } else {
      return 'unknown_error';
    }
  }
}

// Export singleton instance
export const freeAIService = new FreeAIService(); 