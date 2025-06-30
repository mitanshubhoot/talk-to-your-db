import OpenAI from 'openai';
import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';

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
}

export class OpenAIService {
  private client: OpenAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not configured. AI functionality will be limited.');
      return;
    }

    try {
      this.client = new OpenAI({
        apiKey: apiKey,
      });
      logger.info('OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
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

  private buildPrompt(userQuery: string, schema: SchemaInfo): string {
    const schemaContext = this.buildSchemaContext(schema);
    
    return `You are an expert SQL query generator. Convert the user's natural language request into a precise SQL query.

${schemaContext}

User Request: "${userQuery}"

Requirements:
1. Generate ONLY a SELECT query (no INSERT, UPDATE, DELETE, DROP, etc.)
2. Use proper PostgreSQL syntax
3. Include appropriate JOINs when needed
4. Use reasonable LIMIT clauses for large datasets
5. Handle date/time queries appropriately
6. Return the SQL query without any markdown formatting or explanation

Generate the SQL query:`;
  }

  async generateSql(request: TextToSqlRequest): Promise<TextToSqlResponse> {
    if (!this.client) {
      throw new Error('OpenAI not configured');
    }

    try {
      const prompt = this.buildPrompt(request.userQuery, request.schema);
      
      logger.info(`Generating SQL for query: "${request.userQuery}"`);

      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a SQL expert. Generate clean, safe SQL queries based on user requests."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1, // Low temperature for consistent, predictable results
      });

      const sqlQuery = completion.choices[0]?.message?.content?.trim() || '';
      
      if (!sqlQuery) {
        throw new Error('No SQL query generated');
      }

      // Clean up the SQL query (remove any markdown formatting)
      let cleanSql = sqlQuery
        .replace(/```sql\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Basic validation
      if (!cleanSql.toUpperCase().startsWith('SELECT')) {
        throw new Error('Generated query is not a SELECT statement');
      }

      // Generate explanation
      const explanation = await this.generateExplanation(cleanSql, request.userQuery);

      // Calculate confidence based on query complexity and schema match
      const confidence = this.calculateConfidence(cleanSql, request.schema);

      // Check for potential warnings
      const warnings = this.checkForWarnings(cleanSql, request.schema);

      logger.info(`SQL generated successfully. Confidence: ${confidence}%`);

      return {
        sql: cleanSql,
        explanation,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      logger.error('Error generating SQL:', error);
      throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateExplanation(sql: string, userQuery: string): Promise<string> {
    if (!this.client) {
      return 'This query retrieves data from your database based on your request.';
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Explain SQL queries in simple, business-friendly language."
          },
          {
            role: "user",
            content: `Explain this SQL query in simple terms for someone who asked: "${userQuery}"\n\nSQL: ${sql}`
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content?.trim() || 'This query retrieves the requested data from your database.';
    } catch (error) {
      logger.warn('Could not generate explanation:', error);
      return 'This query retrieves data from your database based on your request.';
    }
  }

  private calculateConfidence(sql: string, schema: SchemaInfo): number {
    let confidence = 80; // Base confidence

    // Check if query references valid tables
    const tableNames = Object.keys(schema.tables);
    const referencedTables = tableNames.filter(table => 
      sql.toLowerCase().includes(table.toLowerCase())
    );

    if (referencedTables.length === 0) {
      confidence -= 30; // No valid tables referenced
    }

    // Check for complex operations
    if (sql.toLowerCase().includes('join')) {
      confidence += 5; // JOINs indicate understanding of relationships
    }

    if (sql.toLowerCase().includes('where')) {
      confidence += 5; // WHERE clauses show filtering understanding
    }

    // Check for potential issues
    if (sql.toLowerCase().includes('*') && !sql.toLowerCase().includes('limit')) {
      confidence -= 10; // SELECT * without LIMIT could be problematic
    }

    return Math.min(Math.max(confidence, 10), 95); // Clamp between 10-95%
  }

  private checkForWarnings(sql: string, schema: SchemaInfo): string[] {
    const warnings: string[] = [];

    // Check for SELECT * without LIMIT on large tables
    if (sql.toLowerCase().includes('select *') && !sql.toLowerCase().includes('limit')) {
      const largeTableThreshold = 10000;
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
}

// Export singleton instance
export const openaiService = new OpenAIService(); 