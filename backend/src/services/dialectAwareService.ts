import { SchemaInfo } from './database';
import { DatabaseDialect } from '../types/database';

export interface DialectSpecificPrompt {
  systemPrompt: string;
  dialectInstructions: string;
  syntaxExamples: string[];
  functionMappings: Record<string, string>;
  limitSyntax: string;
  dateFormatting: string;
}

export interface DialectAwareRequest {
  userQuery: string;
  schema: SchemaInfo;
  dialect: DatabaseDialect;
  connectionType: string;
}

/**
 * Service for generating database dialect-aware SQL prompts and handling dialect-specific optimizations
 */
export class DialectAwareService {
  
  /**
   * Generate dialect-specific prompt for SQL generation
   */
  generateDialectPrompt(request: DialectAwareRequest): DialectSpecificPrompt {
    const { dialect, connectionType } = request;
    
    const baseSystemPrompt = `You are an expert ${dialect.name} SQL developer. Generate ONLY the SQL query for the given request.`;
    
    const dialectInstructions = this.getDialectInstructions(dialect, connectionType);
    const syntaxExamples = this.getDialectSyntaxExamples(dialect, connectionType);
    const functionMappings = this.getDialectFunctionMappings(connectionType);
    
    return {
      systemPrompt: baseSystemPrompt,
      dialectInstructions,
      syntaxExamples,
      functionMappings,
      limitSyntax: this.getLimitSyntaxExample(dialect),
      dateFormatting: this.getDateFormattingExample(dialect, connectionType)
    };
  }

  /**
   * Get dialect-specific instructions
   */
  private getDialectInstructions(dialect: DatabaseDialect, connectionType: string): string {
    switch (connectionType.toLowerCase()) {
      case 'postgresql':
      case 'redshift':
        return `
POSTGRESQL SPECIFIC INSTRUCTIONS:
- Use double quotes (") for identifiers when needed
- Use ILIKE for case-insensitive text matching
- Use LIMIT for row limiting
- Use OFFSET for pagination
- Use DATE_TRUNC() for date grouping
- Use EXTRACT() for date parts
- Use || for string concatenation
- Use COALESCE() for null handling
- Support window functions and CTEs
- Use SERIAL or IDENTITY for auto-increment
- Use BOOLEAN data type
- Use ARRAY data types when appropriate
        `;
        
      case 'mysql':
      case 'mariadb':
        return `
MYSQL SPECIFIC INSTRUCTIONS:
- Use backticks (\`) for identifiers when needed
- Use LIKE with LOWER() for case-insensitive matching
- Use LIMIT for row limiting with OFFSET syntax: LIMIT offset, count
- Use DATE_FORMAT() for date formatting
- Use CONCAT() for string concatenation
- Use IFNULL() for null handling
- Limited window function support (MySQL 8.0+)
- Use AUTO_INCREMENT for auto-increment
- Use TINYINT(1) for boolean values
- Use JSON data type for JSON data (MySQL 5.7+)
        `;
        
      case 'sqlite':
        return `
SQLITE SPECIFIC INSTRUCTIONS:
- Use double quotes (") for identifiers when needed
- Use LIKE with LOWER() for case-insensitive matching
- Use LIMIT for row limiting with OFFSET
- Use strftime() for date formatting
- Use || for string concatenation
- Use COALESCE() for null handling
- Limited window function support (SQLite 3.25+)
- Use INTEGER PRIMARY KEY for auto-increment
- Use INTEGER for boolean values (0/1)
- No native JSON type, use TEXT
        `;
        
      case 'mssql':
        return `
MSSQL SPECIFIC INSTRUCTIONS:
- Use square brackets [] for identifiers when needed
- Use LIKE for text matching (case-insensitive by default)
- Use TOP for row limiting or OFFSET/FETCH for pagination
- Use FORMAT() or CONVERT() for date formatting
- Use + for string concatenation
- Use ISNULL() for null handling
- Full window function support
- Use IDENTITY for auto-increment
- Use BIT data type for boolean values
- Use NVARCHAR for Unicode text
        `;
        
      case 'oracle':
        return `
ORACLE SPECIFIC INSTRUCTIONS:
- Use double quotes (") for identifiers when needed
- Use UPPER() with LIKE for case-insensitive matching
- Use ROWNUM or FETCH FIRST for row limiting
- Use TO_CHAR() for date formatting
- Use || for string concatenation
- Use NVL() for null handling
- Full window function support
- Use SEQUENCE with TRIGGER for auto-increment
- Use NUMBER(1) for boolean values
- Use VARCHAR2 for text data
        `;
        
      default:
        return `
STANDARD SQL INSTRUCTIONS:
- Use double quotes (") for identifiers when needed
- Use LIKE for text matching
- Use LIMIT for row limiting
- Use standard date functions
- Use || for string concatenation
- Use COALESCE() for null handling
        `;
    }
  }

  /**
   * Get dialect-specific syntax examples
   */
  private getDialectSyntaxExamples(dialect: DatabaseDialect, connectionType: string): string[] {
    switch (connectionType.toLowerCase()) {
      case 'postgresql':
        return [
          `-- Case-insensitive search
SELECT * FROM customers WHERE name ILIKE '%john%';`,
          `-- Date filtering
SELECT * FROM orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days';`,
          `-- Pagination
SELECT * FROM products ORDER BY name LIMIT 10 OFFSET 20;`,
          `-- JSON operations
SELECT data->>'name' FROM users WHERE data ? 'email';`
        ];
        
      case 'mysql':
        return [
          `-- Case-insensitive search
SELECT * FROM customers WHERE LOWER(name) LIKE LOWER('%john%');`,
          `-- Date filtering
SELECT * FROM orders WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);`,
          `-- Pagination
SELECT * FROM products ORDER BY name LIMIT 20, 10;`,
          `-- String concatenation
SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM customers;`
        ];
        
      case 'sqlite':
        return [
          `-- Case-insensitive search
SELECT * FROM customers WHERE LOWER(name) LIKE LOWER('%john%');`,
          `-- Date filtering
SELECT * FROM orders WHERE order_date >= date('now', '-30 days');`,
          `-- Pagination
SELECT * FROM products ORDER BY name LIMIT 10 OFFSET 20;`,
          `-- Date formatting
SELECT strftime('%Y-%m', order_date) as month FROM orders;`
        ];
        
      case 'mssql':
        return [
          `-- Case-insensitive search (default)
SELECT * FROM customers WHERE name LIKE '%john%';`,
          `-- Date filtering
SELECT * FROM orders WHERE order_date >= DATEADD(day, -30, GETDATE());`,
          `-- Pagination
SELECT * FROM products ORDER BY name OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;`,
          `-- String concatenation
SELECT first_name + ' ' + last_name AS full_name FROM customers;`
        ];
        
      default:
        return [
          `-- Basic search
SELECT * FROM customers WHERE name LIKE '%john%';`,
          `-- Date filtering
SELECT * FROM orders WHERE order_date >= CURRENT_DATE - 30;`,
          `-- Pagination
SELECT * FROM products ORDER BY name LIMIT 10 OFFSET 20;`
        ];
    }
  }

  /**
   * Get dialect-specific function mappings
   */
  private getDialectFunctionMappings(connectionType: string): Record<string, string> {
    switch (connectionType.toLowerCase()) {
      case 'postgresql':
        return {
          'case_insensitive_like': 'ILIKE',
          'string_concat': '||',
          'null_coalesce': 'COALESCE',
          'date_format': 'TO_CHAR',
          'current_date': 'CURRENT_DATE',
          'substring': 'SUBSTRING',
          'length': 'LENGTH',
          'upper': 'UPPER',
          'lower': 'LOWER'
        };
        
      case 'mysql':
        return {
          'case_insensitive_like': 'LIKE (with LOWER)',
          'string_concat': 'CONCAT',
          'null_coalesce': 'IFNULL',
          'date_format': 'DATE_FORMAT',
          'current_date': 'CURDATE()',
          'substring': 'SUBSTRING',
          'length': 'LENGTH',
          'upper': 'UPPER',
          'lower': 'LOWER'
        };
        
      case 'sqlite':
        return {
          'case_insensitive_like': 'LIKE (with LOWER)',
          'string_concat': '||',
          'null_coalesce': 'COALESCE',
          'date_format': 'strftime',
          'current_date': 'date(\'now\')',
          'substring': 'substr',
          'length': 'length',
          'upper': 'upper',
          'lower': 'lower'
        };
        
      case 'mssql':
        return {
          'case_insensitive_like': 'LIKE',
          'string_concat': '+',
          'null_coalesce': 'ISNULL',
          'date_format': 'FORMAT',
          'current_date': 'GETDATE()',
          'substring': 'SUBSTRING',
          'length': 'LEN',
          'upper': 'UPPER',
          'lower': 'LOWER'
        };
        
      default:
        return {
          'case_insensitive_like': 'LIKE',
          'string_concat': '||',
          'null_coalesce': 'COALESCE',
          'date_format': 'DATE_FORMAT',
          'current_date': 'CURRENT_DATE',
          'substring': 'SUBSTRING',
          'length': 'LENGTH',
          'upper': 'UPPER',
          'lower': 'LOWER'
        };
    }
  }

  /**
   * Get limit syntax example for the dialect
   */
  private getLimitSyntaxExample(dialect: DatabaseDialect): string {
    return `-- Limit syntax: ${dialect.limitSyntax(10, 20)}`;
  }

  /**
   * Get date formatting example for the dialect
   */
  private getDateFormattingExample(dialect: DatabaseDialect, connectionType: string): string {
    switch (connectionType.toLowerCase()) {
      case 'postgresql':
        return `-- Date formatting: TO_CHAR(date_column, 'YYYY-MM-DD')`;
      case 'mysql':
        return `-- Date formatting: DATE_FORMAT(date_column, '%Y-%m-%d')`;
      case 'sqlite':
        return `-- Date formatting: strftime('%Y-%m-%d', date_column)`;
      case 'mssql':
        return `-- Date formatting: FORMAT(date_column, 'yyyy-MM-dd')`;
      default:
        return `-- Date formatting: DATE_FORMAT(date_column, '${dialect.dateFormat}')`;
    }
  }

  /**
   * Build complete dialect-aware prompt
   */
  buildDialectAwarePrompt(request: DialectAwareRequest): string {
    const dialectPrompt = this.generateDialectPrompt(request);
    const schemaContext = this.buildSchemaContext(request.schema);
    
    return `${dialectPrompt.systemPrompt}

${dialectPrompt.dialectInstructions}

DATABASE SCHEMA:
${schemaContext}

SYNTAX EXAMPLES FOR ${request.dialect.name.toUpperCase()}:
${dialectPrompt.syntaxExamples.join('\n\n')}

FUNCTION MAPPINGS:
${Object.entries(dialectPrompt.functionMappings)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

${dialectPrompt.limitSyntax}
${dialectPrompt.dateFormatting}

USER REQUEST: "${request.userQuery}"

Generate a ${request.dialect.name} SQL query that follows the dialect-specific syntax and best practices shown above.

SQL:`;
  }

  /**
   * Build schema context string
   */
  private buildSchemaContext(schema: SchemaInfo): string {
    let context = '';
    
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      context += `\nTable: ${tableName}`;
      if (tableInfo.rowCount !== undefined) {
        context += ` (${tableInfo.rowCount.toLocaleString()} rows)`;
      }
      
      context += '\nColumns:\n';
      tableInfo.columns.forEach(col => {
        let columnInfo = `  - ${col.column_name}: ${col.data_type}`;
        
        const constraints = [];
        if (col.is_primary_key) constraints.push('PK');
        if (col.is_foreign_key) constraints.push('FK');
        if (col.is_nullable === 'NO') constraints.push('NOT NULL');
        
        if (constraints.length > 0) {
          columnInfo += ` [${constraints.join(', ')}]`;
        }
        
        context += columnInfo + '\n';
      });
    });

    if (schema.relationships && schema.relationships.length > 0) {
      context += '\nRelationships:\n';
      schema.relationships.forEach(rel => {
        context += `  - ${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn}\n`;
      });
    }
    
    return context;
  }

  /**
   * Detect database dialect from connection type
   */
  static detectDialectFromConnection(connectionType: string): string {
    switch (connectionType.toLowerCase()) {
      case 'postgresql':
      case 'redshift':
        return 'postgresql';
      case 'mysql':
      case 'mariadb':
        return 'mysql';
      case 'sqlite':
        return 'sqlite';
      case 'mssql':
      case 'sqlserver':
        return 'mssql';
      case 'oracle':
        return 'oracle';
      case 'snowflake':
        return 'snowflake';
      case 'bigquery':
        return 'bigquery';
      case 'clickhouse':
        return 'clickhouse';
      default:
        return 'postgresql'; // Default fallback
    }
  }

  /**
   * Create dialect-specific example sets
   */
  getDialectExamples(connectionType: string): Array<{ nl: string; sql: string; explanation: string }> {
    const baseExamples = [
      {
        nl: "Show me all customers",
        sql: "SELECT * FROM customers ORDER BY name LIMIT 20;",
        explanation: "Retrieves all customer records with a reasonable limit"
      },
      {
        nl: "Count total orders",
        sql: "SELECT COUNT(*) as total_orders FROM orders;",
        explanation: "Counts the total number of orders in the database"
      }
    ];

    switch (connectionType.toLowerCase()) {
      case 'postgresql':
        return [
          ...baseExamples,
          {
            nl: "Find customers whose name contains 'john'",
            sql: "SELECT * FROM customers WHERE name ILIKE '%john%' ORDER BY name;",
            explanation: "Uses PostgreSQL's ILIKE for case-insensitive pattern matching"
          },
          {
            nl: "Get orders from last 30 days",
            sql: "SELECT * FROM orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY order_date DESC;",
            explanation: "Uses PostgreSQL's INTERVAL syntax for date arithmetic"
          },
          {
            nl: "Show monthly sales totals",
            sql: "SELECT DATE_TRUNC('month', order_date) as month, SUM(total_amount) as monthly_sales FROM orders GROUP BY DATE_TRUNC('month', order_date) ORDER BY month;",
            explanation: "Uses PostgreSQL's DATE_TRUNC function for date grouping"
          }
        ];
        
      case 'mysql':
        return [
          ...baseExamples,
          {
            nl: "Find customers whose name contains 'john'",
            sql: "SELECT * FROM customers WHERE LOWER(name) LIKE LOWER('%john%') ORDER BY name;",
            explanation: "Uses LOWER() functions for case-insensitive matching in MySQL"
          },
          {
            nl: "Get orders from last 30 days",
            sql: "SELECT * FROM orders WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ORDER BY order_date DESC;",
            explanation: "Uses MySQL's DATE_SUB function for date arithmetic"
          },
          {
            nl: "Show customer full names",
            sql: "SELECT CONCAT(first_name, ' ', last_name) as full_name FROM customers ORDER BY full_name;",
            explanation: "Uses MySQL's CONCAT function for string concatenation"
          }
        ];
        
      case 'sqlite':
        return [
          ...baseExamples,
          {
            nl: "Find customers whose name contains 'john'",
            sql: "SELECT * FROM customers WHERE LOWER(name) LIKE LOWER('%john%') ORDER BY name;",
            explanation: "Uses LOWER() functions for case-insensitive matching in SQLite"
          },
          {
            nl: "Get orders from last 30 days",
            sql: "SELECT * FROM orders WHERE order_date >= date('now', '-30 days') ORDER BY order_date DESC;",
            explanation: "Uses SQLite's date() function with modifiers for date arithmetic"
          },
          {
            nl: "Format order dates as YYYY-MM",
            sql: "SELECT strftime('%Y-%m', order_date) as month, COUNT(*) as order_count FROM orders GROUP BY strftime('%Y-%m', order_date) ORDER BY month;",
            explanation: "Uses SQLite's strftime() function for date formatting"
          }
        ];
        
      default:
        return baseExamples;
    }
  }
}

// Export singleton instance
export const dialectAwareService = new DialectAwareService();