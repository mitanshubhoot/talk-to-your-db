import { SchemaInfo } from './database';

export interface PromptTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  examples: FewShotExample[];
  dialectSpecific?: Record<string, Partial<PromptTemplate>>;
}

export interface FewShotExample {
  userQuery: string;
  schema: string;
  sql: string;
  explanation: string;
  complexity: 'simple' | 'medium' | 'complex';
  queryType: 'select' | 'aggregate' | 'join' | 'filter' | 'analytics';
}

export interface ChainOfThoughtStep {
  step: number;
  description: string;
  reasoning: string;
  sqlFragment?: string;
}

export class AdvancedPromptTemplates {
  
  // Schema-aware base template with few-shot examples
  static getSchemaAwareTemplate(): PromptTemplate {
    return {
      name: 'schema-aware-sql',
      description: 'Schema-aware SQL generation with few-shot examples',
      systemPrompt: `You are an expert SQL developer with deep knowledge of database design and query optimization. 
Your task is to generate precise, efficient SQL queries based on natural language requests and database schemas.

CORE PRINCIPLES:
- Generate ONLY valid SQL queries, no explanations unless requested
- Use exact table and column names from the provided schema
- Prioritize query efficiency and readability
- Handle edge cases gracefully
- Use appropriate JOINs based on foreign key relationships
- Apply proper filtering, sorting, and aggregation as needed

QUERY QUALITY STANDARDS:
- Use meaningful table aliases (c for customers, o for orders, etc.)
- Include LIMIT clauses for potentially large result sets
- Use ILIKE for case-insensitive text matching
- Apply proper NULL handling with IS NOT NULL
- Use window functions for ranking and analytics when appropriate
- Group by non-aggregated columns in aggregate queries`,

      userPromptTemplate: `DATABASE SCHEMA:
{schema}

AVAILABLE RELATIONSHIPS:
{relationships}

FEW-SHOT EXAMPLES:
{examples}

CHAIN OF THOUGHT ANALYSIS:
{chainOfThought}

USER REQUEST: "{userQuery}"

DIALECT: {dialect}

Generate the SQL query:`,

      examples: [
        {
          userQuery: "show me all customers",
          schema: "Table: customers (id, name, email, city, country)",
          sql: "SELECT id, name, email, city, country FROM customers ORDER BY name LIMIT 20;",
          explanation: "Retrieves all customer information with a reasonable limit and sorted by name",
          complexity: 'simple',
          queryType: 'select'
        },
        {
          userQuery: "how many orders were placed last month",
          schema: "Table: orders (id, customer_id, order_date, total_amount)",
          sql: "SELECT COUNT(*) as order_count FROM orders WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND order_date < DATE_TRUNC('month', CURRENT_DATE);",
          explanation: "Counts orders from the previous calendar month using date functions",
          complexity: 'medium',
          queryType: 'aggregate'
        },
        {
          userQuery: "top 5 customers by total revenue",
          schema: "Table: customers (id, name, email), Table: orders (id, customer_id, total_amount)",
          sql: "SELECT c.id, c.name, SUM(o.total_amount) as total_revenue FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name ORDER BY total_revenue DESC LIMIT 5;",
          explanation: "Joins customers and orders to calculate total revenue per customer, showing top 5",
          complexity: 'complex',
          queryType: 'join'
        }
      ],

      dialectSpecific: {
        postgresql: {
          systemPrompt: `Additional PostgreSQL-specific guidelines:
- Use ILIKE for case-insensitive pattern matching
- Use DATE_TRUNC for date grouping
- Use INTERVAL for date arithmetic
- Use COALESCE for NULL handling
- Use window functions (ROW_NUMBER, RANK, etc.) for analytics`
        },
        mysql: {
          systemPrompt: `Additional MySQL-specific guidelines:
- Use LIKE with LOWER() for case-insensitive matching
- Use DATE_FORMAT for date formatting
- Use IFNULL for NULL handling
- Use LIMIT with OFFSET for pagination`
        },
        sqlite: {
          systemPrompt: `Additional SQLite-specific guidelines:
- Use LIKE with LOWER() for case-insensitive matching
- Use strftime for date functions
- Limited window function support
- Use COALESCE for NULL handling`
        }
      }
    };
  }

  // Chain-of-thought template for complex queries
  static getChainOfThoughtTemplate(): PromptTemplate {
    return {
      name: 'chain-of-thought-sql',
      description: 'Step-by-step reasoning for complex SQL generation',
      systemPrompt: `You are an expert SQL developer who thinks step-by-step through complex database queries.
Break down each request into logical steps before generating the final SQL.

REASONING PROCESS:
1. UNDERSTAND: What is the user asking for?
2. IDENTIFY: Which tables and columns are needed?
3. RELATIONSHIPS: What JOINs are required?
4. FILTERS: What WHERE conditions are needed?
5. AGGREGATION: Are GROUP BY, COUNT, SUM, etc. needed?
6. SORTING: How should results be ordered?
7. LIMITS: Should results be limited?
8. OPTIMIZE: Can the query be made more efficient?`,

      userPromptTemplate: `DATABASE SCHEMA:
{schema}

USER REQUEST: "{userQuery}"

STEP-BY-STEP REASONING:

Step 1 - UNDERSTAND THE REQUEST:
{step1_understanding}

Step 2 - IDENTIFY REQUIRED TABLES:
{step2_tables}

Step 3 - DETERMINE RELATIONSHIPS:
{step3_relationships}

Step 4 - APPLY FILTERS:
{step4_filters}

Step 5 - HANDLE AGGREGATION:
{step5_aggregation}

Step 6 - SORT AND LIMIT:
{step6_sorting}

FINAL SQL QUERY:`,

      examples: [
        {
          userQuery: "customers from New York who have placed orders worth more than $1000 in the last 6 months",
          schema: "customers (id, name, city), orders (id, customer_id, order_date, total_amount)",
          sql: `SELECT DISTINCT c.id, c.name, c.city 
FROM customers c 
JOIN orders o ON c.id = o.customer_id 
WHERE c.city = 'New York' 
  AND o.total_amount > 1000 
  AND o.order_date >= CURRENT_DATE - INTERVAL '6 months'
ORDER BY c.name;`,
          explanation: "Multi-step query with JOIN, multiple filters, and date arithmetic",
          complexity: 'complex',
          queryType: 'filter'
        }
      ]
    };
  }

  // Analytics-focused template for business intelligence queries
  static getAnalyticsTemplate(): PromptTemplate {
    return {
      name: 'analytics-sql',
      description: 'Business intelligence and analytics queries',
      systemPrompt: `You are a business intelligence expert specializing in analytical SQL queries.
Focus on generating queries that provide business insights through aggregations, trends, and comparisons.

ANALYTICS PATTERNS:
- Time-series analysis with date grouping
- Ranking and percentile calculations
- Year-over-year and period comparisons
- Cohort analysis and retention metrics
- Revenue and performance analytics
- Customer segmentation and behavior analysis

ADVANCED TECHNIQUES:
- Window functions for running totals and rankings
- CTEs for complex multi-step calculations
- CASE statements for conditional logic
- Subqueries for comparative analysis
- Date functions for time-based grouping`,

      userPromptTemplate: `DATABASE SCHEMA:
{schema}

BUSINESS CONTEXT:
{businessContext}

ANALYTICS REQUEST: "{userQuery}"

EXPECTED OUTPUT FORMAT:
{outputFormat}

Generate analytical SQL query:`,

      examples: [
        {
          userQuery: "monthly revenue trend for the last 12 months",
          schema: "orders (id, order_date, total_amount)",
          sql: `SELECT 
  DATE_TRUNC('month', order_date) as month,
  SUM(total_amount) as monthly_revenue,
  COUNT(*) as order_count,
  AVG(total_amount) as avg_order_value
FROM orders 
WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;`,
          explanation: "Time-series analysis showing monthly revenue trends with key metrics",
          complexity: 'complex',
          queryType: 'analytics'
        }
      ]
    };
  }

  // Generate chain-of-thought steps for complex queries
  static generateChainOfThought(userQuery: string, schema: SchemaInfo): ChainOfThoughtStep[] {
    const steps: ChainOfThoughtStep[] = [];
    const lowerQuery = userQuery.toLowerCase();

    // Step 1: Understanding
    steps.push({
      step: 1,
      description: "Understanding the request",
      reasoning: `User wants: ${userQuery}`,
    });

    // Step 2: Table identification
    const relevantTables = this.identifyRelevantTables(userQuery, schema);
    steps.push({
      step: 2,
      description: "Identifying required tables",
      reasoning: `Tables needed: ${relevantTables.join(', ')}`,
    });

    // Step 3: Relationships
    if (relevantTables.length > 1) {
      const relationships = this.identifyRelationships(relevantTables, schema);
      steps.push({
        step: 3,
        description: "Determining table relationships",
        reasoning: `JOINs needed: ${relationships.join(', ')}`,
      });
    }

    // Step 4: Filters
    const filters = this.identifyFilters(userQuery);
    if (filters.length > 0) {
      steps.push({
        step: 4,
        description: "Applying filters",
        reasoning: `WHERE conditions: ${filters.join(', ')}`,
      });
    }

    // Step 5: Aggregation
    if (this.needsAggregation(userQuery)) {
      steps.push({
        step: 5,
        description: "Handling aggregation",
        reasoning: this.getAggregationReasoning(userQuery),
      });
    }

    // Step 6: Sorting and limiting
    const sortingInfo = this.getSortingInfo(userQuery);
    steps.push({
      step: 6,
      description: "Sorting and limiting results",
      reasoning: sortingInfo,
    });

    return steps;
  }

  // Helper methods for chain-of-thought generation
  private static identifyRelevantTables(userQuery: string, schema: SchemaInfo): string[] {
    const lowerQuery = userQuery.toLowerCase();
    const relevantTables: string[] = [];

    Object.keys(schema.tables).forEach(tableName => {
      const tableWords = tableName.toLowerCase().split('_');
      const singularForms = tableWords.map(word => {
        if (word.endsWith('s') && word.length > 3) {
          return word.slice(0, -1);
        }
        return word;
      });

      if (tableWords.some(word => lowerQuery.includes(word)) || 
          singularForms.some(word => lowerQuery.includes(word))) {
        relevantTables.push(tableName);
      }
    });

    return relevantTables;
  }

  private static identifyRelationships(tables: string[], schema: SchemaInfo): string[] {
    const relationships: string[] = [];
    
    if (schema.relationships) {
      schema.relationships.forEach(rel => {
        if (tables.includes(rel.table) && tables.includes(rel.referencedTable)) {
          relationships.push(`${rel.table}.${rel.column} = ${rel.referencedTable}.${rel.referencedColumn}`);
        }
      });
    }

    return relationships;
  }

  private static identifyFilters(userQuery: string): string[] {
    const filters: string[] = [];
    const lowerQuery = userQuery.toLowerCase();

    if (lowerQuery.includes('last month') || lowerQuery.includes('past month')) {
      filters.push('date >= last month');
    }
    if (lowerQuery.includes('this year') || lowerQuery.includes('current year')) {
      filters.push('date >= current year');
    }
    if (lowerQuery.match(/from\s+\w+|in\s+\w+/)) {
      filters.push('location-based filter');
    }
    if (lowerQuery.match(/greater than|more than|above|\>/)) {
      filters.push('threshold filter (>)');
    }
    if (lowerQuery.match(/less than|fewer than|below|\</)) {
      filters.push('threshold filter (<)');
    }

    return filters;
  }

  private static needsAggregation(userQuery: string): boolean {
    const lowerQuery = userQuery.toLowerCase();
    return lowerQuery.includes('count') || 
           lowerQuery.includes('sum') || 
           lowerQuery.includes('total') || 
           lowerQuery.includes('average') || 
           lowerQuery.includes('max') || 
           lowerQuery.includes('min') ||
           lowerQuery.includes('group by') ||
           lowerQuery.includes('per ');
  }

  private static getAggregationReasoning(userQuery: string): string {
    const lowerQuery = userQuery.toLowerCase();
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      return 'COUNT() function needed to count records';
    }
    if (lowerQuery.includes('sum') || lowerQuery.includes('total')) {
      return 'SUM() function needed to calculate totals';
    }
    if (lowerQuery.includes('average') || lowerQuery.includes('avg')) {
      return 'AVG() function needed to calculate averages';
    }
    if (lowerQuery.includes('max') || lowerQuery.includes('highest')) {
      return 'MAX() function needed to find maximum values';
    }
    if (lowerQuery.includes('min') || lowerQuery.includes('lowest')) {
      return 'MIN() function needed to find minimum values';
    }
    
    return 'GROUP BY needed for aggregation';
  }

  private static getSortingInfo(userQuery: string): string {
    const lowerQuery = userQuery.toLowerCase();
    
    if (lowerQuery.includes('top') || lowerQuery.includes('highest') || lowerQuery.includes('best')) {
      return 'ORDER BY DESC with LIMIT for top results';
    }
    if (lowerQuery.includes('bottom') || lowerQuery.includes('lowest') || lowerQuery.includes('worst')) {
      return 'ORDER BY ASC with LIMIT for bottom results';
    }
    if (lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
      return 'ORDER BY date DESC for most recent';
    }
    if (lowerQuery.includes('oldest') || lowerQuery.includes('first')) {
      return 'ORDER BY date ASC for oldest';
    }
    
    return 'ORDER BY appropriate column, LIMIT if needed';
  }

  // Build complete prompt with template and context
  static buildPrompt(
    template: PromptTemplate, 
    userQuery: string, 
    schema: SchemaInfo, 
    dialect: string = 'postgresql'
  ): string {
    const schemaContext = this.buildSchemaContext(schema);
    const relationships = this.buildRelationshipContext(schema);
    const examples = this.formatExamples(template.examples);
    const chainOfThought = this.formatChainOfThought(
      this.generateChainOfThought(userQuery, schema)
    );

    // Apply dialect-specific modifications
    let systemPrompt = template.systemPrompt;
    if (template.dialectSpecific && template.dialectSpecific[dialect]) {
      systemPrompt += '\n\n' + template.dialectSpecific[dialect].systemPrompt;
    }

    const userPrompt = template.userPromptTemplate
      .replace('{schema}', schemaContext)
      .replace('{relationships}', relationships)
      .replace('{examples}', examples)
      .replace('{chainOfThought}', chainOfThought)
      .replace('{userQuery}', userQuery)
      .replace('{dialect}', dialect);

    return `${systemPrompt}\n\n${userPrompt}`;
  }

  private static buildSchemaContext(schema: SchemaInfo): string {
    let context = "";
    
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      context += `\nTable: ${tableName}`;
      if (tableInfo.rowCount !== undefined) {
        context += ` (${tableInfo.rowCount.toLocaleString()} rows)`;
      }
      
      context += "\nColumns:\n";
      tableInfo.columns.forEach(col => {
        let columnInfo = `  - ${col.column_name}: ${col.data_type}`;
        
        const constraints = [];
        if (col.is_primary_key) constraints.push('PK');
        if (col.is_foreign_key) constraints.push('FK');
        if (col.is_nullable === 'NO') constraints.push('NOT NULL');
        if (constraints.length > 0) {
          columnInfo += ` [${constraints.join(', ')}]`;
        }
        
        context += columnInfo + "\n";
      });
    });

    return context;
  }

  private static buildRelationshipContext(schema: SchemaInfo): string {
    if (!schema.relationships || schema.relationships.length === 0) {
      return "No foreign key relationships found.";
    }
    
    return schema.relationships
      .map(rel => `${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn}`)
      .join('\n');
  }

  private static formatExamples(examples: FewShotExample[]): string {
    return examples.map((example, index) => 
      `Example ${index + 1} (${example.complexity} ${example.queryType}):
Query: "${example.userQuery}"
Schema: ${example.schema}
SQL: ${example.sql}
Explanation: ${example.explanation}
`
    ).join('\n');
  }

  private static formatChainOfThought(steps: ChainOfThoughtStep[]): string {
    return steps.map(step => 
      `Step ${step.step} - ${step.description.toUpperCase()}:
${step.reasoning}${step.sqlFragment ? '\nSQL Fragment: ' + step.sqlFragment : ''}`
    ).join('\n\n');
  }
}