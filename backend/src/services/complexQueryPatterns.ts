import { SchemaInfo } from './database';

export interface QueryPattern {
  type: 'aggregation' | 'join' | 'filtering' | 'sorting' | 'analytical' | 'subquery';
  complexity: 'simple' | 'medium' | 'complex';
  requiredTables: string[];
  suggestedColumns: string[];
  joinConditions?: JoinCondition[];
  aggregations?: AggregationInfo[];
  filters?: FilterInfo[];
  sortingInfo?: SortingInfo;
}

export interface JoinCondition {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

export interface AggregationInfo {
  function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'GROUP_CONCAT';
  column: string;
  alias?: string;
  groupBy?: string[];
}

export interface FilterInfo {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
  value: string | number | string[];
  table?: string;
}

export interface SortingInfo {
  column: string;
  direction: 'ASC' | 'DESC';
  table?: string;
}

export interface ComplexQueryPrompt {
  systemPrompt: string;
  userPrompt: string;
  examples: string[];
  schemaContext: string;
  patternSpecificInstructions: string;
}

export class ComplexQueryPatternHandler {
  /**
   * Generate specialized prompts for aggregation queries
   */
  generateAggregationPrompt(
    userQuery: string, 
    schema: SchemaInfo, 
    pattern: QueryPattern
  ): ComplexQueryPrompt {
    const systemPrompt = `You are an expert SQL developer specializing in aggregation queries. 
Generate precise SQL queries that use aggregate functions (COUNT, SUM, AVG, MIN, MAX) with proper GROUP BY clauses.
Always consider performance implications and use appropriate HAVING clauses when needed.`;

    const examples = [
      `-- Example 1: Count customers by city
User: "How many customers are in each city?"
SQL: SELECT city, COUNT(*) as customer_count FROM customers GROUP BY city ORDER BY customer_count DESC;`,

      `-- Example 2: Total revenue by product category
User: "What's the total revenue for each product category?"
SQL: SELECT p.category, SUM(oi.quantity * oi.price) as total_revenue 
FROM products p 
JOIN order_items oi ON p.product_id = oi.product_id 
GROUP BY p.category 
ORDER BY total_revenue DESC;`,

      `-- Example 3: Average order value by month
User: "What's the average order value by month?"
SQL: SELECT DATE_TRUNC('month', order_date) as month, AVG(total_amount) as avg_order_value 
FROM orders 
GROUP BY DATE_TRUNC('month', order_date) 
ORDER BY month;`,

      `-- Example 4: Top customers by total spending
User: "Who are the top 10 customers by total spending?"
SQL: SELECT c.name, c.email, SUM(o.total_amount) as total_spent 
FROM customers c 
JOIN orders o ON c.customer_id = o.customer_id 
GROUP BY c.customer_id, c.name, c.email 
ORDER BY total_spent DESC 
LIMIT 10;`,

      `-- Example 5: Products with sales above average
User: "Which products have sales above the average?"
SQL: SELECT p.name, SUM(oi.quantity * oi.price) as total_sales 
FROM products p 
JOIN order_items oi ON p.product_id = oi.product_id 
GROUP BY p.product_id, p.name 
HAVING SUM(oi.quantity * oi.price) > (
  SELECT AVG(total_sales) FROM (
    SELECT SUM(oi2.quantity * oi2.price) as total_sales 
    FROM order_items oi2 
    GROUP BY oi2.product_id
  ) avg_calc
);`
    ];

    const patternSpecificInstructions = `
AGGREGATION QUERY GUIDELINES:
1. Always use appropriate aggregate functions: COUNT(), SUM(), AVG(), MIN(), MAX()
2. Include GROUP BY for all non-aggregate columns in SELECT
3. Use HAVING clause for filtering aggregated results
4. Consider using ORDER BY to sort results meaningfully
5. Add LIMIT when showing "top N" results
6. Use table aliases for better readability in JOINs
7. Consider performance - avoid unnecessary columns in GROUP BY
8. Use DATE_TRUNC() for time-based grouping
9. Handle NULL values appropriately in aggregations
10. Use descriptive aliases for calculated columns`;

    return {
      systemPrompt,
      userPrompt: this.buildUserPrompt(userQuery, schema, pattern),
      examples,
      schemaContext: this.buildSchemaContext(schema, pattern.requiredTables),
      patternSpecificInstructions
    };
  }

  /**
   * Generate specialized prompts for JOIN queries
   */
  generateJoinPrompt(
    userQuery: string, 
    schema: SchemaInfo, 
    pattern: QueryPattern
  ): ComplexQueryPrompt {
    const systemPrompt = `You are an expert SQL developer specializing in JOIN operations. 
Generate efficient SQL queries that properly join related tables using foreign key relationships.
Always use explicit JOIN syntax and appropriate JOIN types (INNER, LEFT, RIGHT, FULL).`;

    const examples = [
      `-- Example 1: Customers with their orders
User: "Show me customers and their orders"
SQL: SELECT c.name, c.email, o.order_id, o.order_date, o.total_amount 
FROM customers c 
LEFT JOIN orders o ON c.customer_id = o.customer_id 
ORDER BY c.name, o.order_date DESC;`,

      `-- Example 2: Orders with product details
User: "Show orders with product information"
SQL: SELECT o.order_id, o.order_date, p.name as product_name, oi.quantity, oi.price 
FROM orders o 
JOIN order_items oi ON o.order_id = oi.order_id 
JOIN products p ON oi.product_id = p.product_id 
ORDER BY o.order_date DESC, o.order_id;`,

      `-- Example 3: Customers without orders
User: "Which customers haven't placed any orders?"
SQL: SELECT c.customer_id, c.name, c.email 
FROM customers c 
LEFT JOIN orders o ON c.customer_id = o.customer_id 
WHERE o.customer_id IS NULL 
ORDER BY c.name;`,

      `-- Example 4: Products and their categories with sales
User: "Show products with their categories and total sales"
SQL: SELECT p.name, p.category, COALESCE(SUM(oi.quantity * oi.price), 0) as total_sales 
FROM products p 
LEFT JOIN order_items oi ON p.product_id = oi.product_id 
GROUP BY p.product_id, p.name, p.category 
ORDER BY total_sales DESC;`,

      `-- Example 5: Complex multi-table join
User: "Show customer orders with product details and categories"
SQL: SELECT c.name as customer_name, o.order_date, p.name as product_name, 
       p.category, oi.quantity, oi.price, (oi.quantity * oi.price) as line_total 
FROM customers c 
JOIN orders o ON c.customer_id = o.customer_id 
JOIN order_items oi ON o.order_id = oi.order_id 
JOIN products p ON oi.product_id = p.product_id 
ORDER BY o.order_date DESC, c.name;`
    ];

    const patternSpecificInstructions = `
JOIN QUERY GUIDELINES:
1. Use explicit JOIN syntax (INNER JOIN, LEFT JOIN, etc.) instead of WHERE clause joins
2. Choose appropriate JOIN types:
   - INNER JOIN: Only matching records from both tables
   - LEFT JOIN: All records from left table, matching from right
   - RIGHT JOIN: All records from right table, matching from left
   - FULL JOIN: All records from both tables
3. Always specify ON conditions using foreign key relationships
4. Use table aliases for better readability (c for customers, o for orders, etc.)
5. Consider NULL handling with LEFT/RIGHT JOINs using COALESCE or IS NULL
6. Order JOINs logically (main table first, then related tables)
7. Use meaningful column aliases for calculated fields
8. Consider performance - join on indexed columns when possible
9. Avoid Cartesian products by ensuring proper JOIN conditions
10. Use WHERE clause for additional filtering after JOINs`;

    return {
      systemPrompt,
      userPrompt: this.buildUserPrompt(userQuery, schema, pattern),
      examples,
      schemaContext: this.buildSchemaContext(schema, pattern.requiredTables),
      patternSpecificInstructions
    };
  }

  /**
   * Generate specialized prompts for filtering and sorting queries
   */
  generateFilteringSortingPrompt(
    userQuery: string, 
    schema: SchemaInfo, 
    pattern: QueryPattern
  ): ComplexQueryPrompt {
    const systemPrompt = `You are an expert SQL developer specializing in data filtering and sorting. 
Generate precise SQL queries with efficient WHERE clauses and appropriate ORDER BY statements.
Consider index usage and query performance when designing filters.`;

    const examples = [
      `-- Example 1: Filter by date range
User: "Show orders from last month"
SQL: SELECT order_id, customer_id, order_date, total_amount 
FROM orders 
WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
  AND order_date < DATE_TRUNC('month', CURRENT_DATE) 
ORDER BY order_date DESC;`,

      `-- Example 2: Filter by multiple conditions
User: "Show customers from New York or California with orders over $100"
SQL: SELECT DISTINCT c.name, c.email, c.city, c.state 
FROM customers c 
JOIN orders o ON c.customer_id = o.customer_id 
WHERE c.state IN ('NY', 'CA') 
  AND o.total_amount > 100 
ORDER BY c.state, c.name;`,

      `-- Example 3: Text pattern matching
User: "Find customers whose name contains 'Smith'"
SQL: SELECT customer_id, name, email, city 
FROM customers 
WHERE name ILIKE '%Smith%' 
ORDER BY name;`,

      `-- Example 4: Range filtering with sorting
User: "Show products priced between $10 and $50, sorted by price"
SQL: SELECT product_id, name, price, category 
FROM products 
WHERE price BETWEEN 10 AND 50 
ORDER BY price ASC, name;`,

      `-- Example 5: Complex filtering with aggregation
User: "Show customers who have placed more than 5 orders this year"
SQL: SELECT c.customer_id, c.name, c.email, COUNT(o.order_id) as order_count 
FROM customers c 
JOIN orders o ON c.customer_id = o.customer_id 
WHERE o.order_date >= DATE_TRUNC('year', CURRENT_DATE) 
GROUP BY c.customer_id, c.name, c.email 
HAVING COUNT(o.order_id) > 5 
ORDER BY order_count DESC;`
    ];

    const patternSpecificInstructions = `
FILTERING AND SORTING GUIDELINES:
1. Use appropriate comparison operators: =, !=, >, <, >=, <=, BETWEEN, IN, LIKE
2. Use ILIKE for case-insensitive text matching (PostgreSQL)
3. Use DATE_TRUNC() for date-based filtering
4. Use IN clause for multiple value matching
5. Use BETWEEN for range queries
6. Combine conditions with AND/OR logically
7. Use parentheses to group complex conditions
8. Consider NULL handling with IS NULL / IS NOT NULL
9. Use DISTINCT when needed to avoid duplicates
10. Order results meaningfully - dates DESC, names ASC, etc.
11. Use indexes on filtered columns for performance
12. Use HAVING for filtering aggregated results
13. Consider using EXISTS for subquery filtering
14. Use LIMIT for large result sets
15. Use appropriate data type casting when needed`;

    return {
      systemPrompt,
      userPrompt: this.buildUserPrompt(userQuery, schema, pattern),
      examples,
      schemaContext: this.buildSchemaContext(schema, pattern.requiredTables),
      patternSpecificInstructions
    };
  }

  /**
   * Generate specialized prompts for analytical queries
   */
  generateAnalyticalPrompt(
    userQuery: string, 
    schema: SchemaInfo, 
    pattern: QueryPattern
  ): ComplexQueryPrompt {
    const systemPrompt = `You are an expert SQL analyst specializing in business intelligence and analytical queries. 
Generate sophisticated SQL queries using window functions, CTEs, and advanced analytical techniques.
Focus on providing actionable business insights through data analysis.`;

    const examples = [
      `-- Example 1: Running totals with window functions
User: "Show running total of sales by month"
SQL: SELECT DATE_TRUNC('month', order_date) as month, 
       SUM(total_amount) as monthly_sales,
       SUM(SUM(total_amount)) OVER (ORDER BY DATE_TRUNC('month', order_date)) as running_total 
FROM orders 
GROUP BY DATE_TRUNC('month', order_date) 
ORDER BY month;`,

      `-- Example 2: Ranking customers by revenue
User: "Rank customers by total revenue with percentiles"
SQL: SELECT c.name, 
       SUM(o.total_amount) as total_revenue,
       RANK() OVER (ORDER BY SUM(o.total_amount) DESC) as revenue_rank,
       PERCENT_RANK() OVER (ORDER BY SUM(o.total_amount)) as revenue_percentile 
FROM customers c 
JOIN orders o ON c.customer_id = o.customer_id 
GROUP BY c.customer_id, c.name 
ORDER BY total_revenue DESC;`,

      `-- Example 3: Year-over-year growth analysis
User: "Show year-over-year sales growth"
SQL: WITH yearly_sales AS (
  SELECT EXTRACT(YEAR FROM order_date) as year, 
         SUM(total_amount) as total_sales 
  FROM orders 
  GROUP BY EXTRACT(YEAR FROM order_date)
)
SELECT year, 
       total_sales,
       LAG(total_sales) OVER (ORDER BY year) as previous_year_sales,
       ROUND(((total_sales - LAG(total_sales) OVER (ORDER BY year)) / 
              LAG(total_sales) OVER (ORDER BY year)) * 100, 2) as growth_percentage 
FROM yearly_sales 
ORDER BY year;`,

      `-- Example 4: Customer cohort analysis
User: "Analyze customer retention by cohort"
SQL: WITH customer_cohorts AS (
  SELECT customer_id, 
         DATE_TRUNC('month', MIN(order_date)) as cohort_month 
  FROM orders 
  GROUP BY customer_id
),
cohort_sizes AS (
  SELECT cohort_month, COUNT(*) as cohort_size 
  FROM customer_cohorts 
  GROUP BY cohort_month
)
SELECT cc.cohort_month, 
       cs.cohort_size,
       DATE_TRUNC('month', o.order_date) as order_month,
       COUNT(DISTINCT o.customer_id) as active_customers,
       ROUND(COUNT(DISTINCT o.customer_id)::numeric / cs.cohort_size * 100, 2) as retention_rate 
FROM customer_cohorts cc 
JOIN orders o ON cc.customer_id = o.customer_id 
JOIN cohort_sizes cs ON cc.cohort_month = cs.cohort_month 
GROUP BY cc.cohort_month, cs.cohort_size, DATE_TRUNC('month', o.order_date) 
ORDER BY cc.cohort_month, order_month;`,

      `-- Example 5: Product performance analysis
User: "Analyze product performance with moving averages"
SQL: WITH daily_product_sales AS (
  SELECT p.product_id, p.name, 
         DATE(o.order_date) as sale_date,
         SUM(oi.quantity * oi.price) as daily_sales 
  FROM products p 
  JOIN order_items oi ON p.product_id = oi.product_id 
  JOIN orders o ON oi.order_id = o.order_id 
  GROUP BY p.product_id, p.name, DATE(o.order_date)
)
SELECT product_id, name, sale_date, daily_sales,
       AVG(daily_sales) OVER (
         PARTITION BY product_id 
         ORDER BY sale_date 
         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) as seven_day_avg 
FROM daily_product_sales 
ORDER BY product_id, sale_date;`
    ];

    const patternSpecificInstructions = `
ANALYTICAL QUERY GUIDELINES:
1. Use window functions for advanced analytics: ROW_NUMBER(), RANK(), DENSE_RANK(), PERCENT_RANK()
2. Use LAG() and LEAD() for time-series comparisons
3. Use SUM() OVER() for running totals and cumulative calculations
4. Use CTEs (WITH clauses) for complex multi-step analysis
5. Use PARTITION BY in window functions for grouped calculations
6. Use appropriate date functions: DATE_TRUNC(), EXTRACT(), DATE()
7. Calculate growth rates, percentages, and ratios
8. Use CASE statements for conditional logic
9. Consider performance with proper indexing on date and key columns
10. Use subqueries for complex filtering and calculations
11. Apply statistical functions: STDDEV(), VARIANCE(), PERCENTILE_CONT()
12. Use COALESCE() for handling NULL values in calculations
13. Format numbers appropriately with ROUND() for readability
14. Use meaningful aliases for calculated columns
15. Consider data freshness and time zones in date calculations`;

    return {
      systemPrompt,
      userPrompt: this.buildUserPrompt(userQuery, schema, pattern),
      examples,
      schemaContext: this.buildSchemaContext(schema, pattern.requiredTables),
      patternSpecificInstructions
    };
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(userQuery: string, schema: SchemaInfo, pattern: QueryPattern): string {
    return `Generate a SQL query for the following request:
"${userQuery}"

Query Pattern: ${pattern.type} (${pattern.complexity} complexity)
Required Tables: ${pattern.requiredTables.join(', ')}
Database Dialect: PostgreSQL

Please generate only the SQL query with proper formatting and comments.`;
  }

  /**
   * Build schema context for specific tables
   */
  private buildSchemaContext(schema: SchemaInfo, requiredTables: string[]): string {
    let context = "Relevant Database Schema:\n\n";

    requiredTables.forEach(tableName => {
      const tableInfo = schema.tables[tableName];
      if (tableInfo) {
        context += `Table: ${tableName}\n`;
        context += "Columns:\n";
        
        tableInfo.columns.forEach(col => {
          let columnInfo = `  - ${col.column_name}: ${col.data_type}`;
          
          if (col.character_maximum_length) {
            columnInfo += `(${col.character_maximum_length})`;
          }
          
          const constraints = [];
          if (col.is_primary_key) constraints.push('PK');
          if (col.is_foreign_key) constraints.push('FK');
          if (col.is_nullable === 'NO') constraints.push('NOT NULL');
          
          if (constraints.length > 0) {
            columnInfo += ` [${constraints.join(', ')}]`;
          }
          
          context += columnInfo + "\n";
        });

        // Add foreign key relationships
        if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
          context += "Foreign Keys:\n";
          tableInfo.foreignKeys.forEach(fk => {
            context += `  - ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
          });
        }

        context += "\n";
      }
    });

    // Add relationship information
    if (schema.relationships && schema.relationships.length > 0) {
      context += "Table Relationships:\n";
      const relevantRelationships = schema.relationships.filter(rel =>
        requiredTables.includes(rel.table) && requiredTables.includes(rel.referencedTable)
      );
      
      relevantRelationships.forEach(rel => {
        context += `  - ${rel.table}.${rel.column} → ${rel.referencedTable}.${rel.referencedColumn}\n`;
      });
    }

    return context;
  }

  /**
   * Detect query pattern from user input
   */
  detectQueryPattern(userQuery: string, schema: SchemaInfo): QueryPattern {
    const lowerQuery = userQuery.toLowerCase();
    
    // Detect aggregation patterns
    if (this.isAggregationQuery(lowerQuery)) {
      return this.buildAggregationPattern(userQuery, schema);
    }
    
    // Detect join patterns
    if (this.isJoinQuery(lowerQuery, schema)) {
      return this.buildJoinPattern(userQuery, schema);
    }
    
    // Detect analytical patterns
    if (this.isAnalyticalQuery(lowerQuery)) {
      return this.buildAnalyticalPattern(userQuery, schema);
    }
    
    // Detect filtering/sorting patterns
    if (this.isFilteringSortingQuery(lowerQuery)) {
      return this.buildFilteringSortingPattern(userQuery, schema);
    }
    
    // Default to simple filtering
    return this.buildSimplePattern(userQuery, schema);
  }

  private isAggregationQuery(query: string): boolean {
    const aggregationKeywords = [
      'count', 'sum', 'total', 'average', 'avg', 'min', 'max',
      'how many', 'number of', 'total revenue', 'total sales',
      'by category', 'by month', 'by year', 'group by', 'each'
    ];
    
    return aggregationKeywords.some(keyword => query.includes(keyword));
  }

  private isJoinQuery(query: string, schema: SchemaInfo): boolean {
    const tableNames = Object.keys(schema.tables);
    const mentionedTables = tableNames.filter(table => 
      query.includes(table) || query.includes(table.slice(0, -1)) // singular form
    );
    
    return mentionedTables.length > 1 || 
           query.includes('with their') || 
           query.includes('and their') ||
           query.includes('join') ||
           query.includes('customers and orders') ||
           query.includes('orders with products');
  }

  private isAnalyticalQuery(query: string): boolean {
    const analyticalKeywords = [
      'trend', 'growth', 'analysis', 'compare', 'rank', 'top',
      'performance', 'over time', 'year over year', 'month over month',
      'cohort', 'retention', 'moving average', 'running total',
      'percentile', 'distribution'
    ];
    
    return analyticalKeywords.some(keyword => query.includes(keyword));
  }

  private isFilteringSortingQuery(query: string): boolean {
    const filteringKeywords = [
      'where', 'filter', 'from', 'in', 'between', 'greater than',
      'less than', 'contains', 'like', 'sort', 'order', 'arrange'
    ];
    
    return filteringKeywords.some(keyword => query.includes(keyword));
  }

  private buildAggregationPattern(userQuery: string, schema: SchemaInfo): QueryPattern {
    const requiredTables = this.extractRequiredTables(userQuery, schema);
    
    return {
      type: 'aggregation',
      complexity: requiredTables.length > 1 ? 'medium' : 'simple',
      requiredTables,
      suggestedColumns: this.extractSuggestedColumns(userQuery, schema, requiredTables)
    };
  }

  private buildJoinPattern(userQuery: string, schema: SchemaInfo): QueryPattern {
    const requiredTables = this.extractRequiredTables(userQuery, schema);
    
    return {
      type: 'join',
      complexity: requiredTables.length > 2 ? 'complex' : 'medium',
      requiredTables,
      suggestedColumns: this.extractSuggestedColumns(userQuery, schema, requiredTables),
      joinConditions: this.suggestJoinConditions(requiredTables, schema)
    };
  }

  private buildAnalyticalPattern(userQuery: string, schema: SchemaInfo): QueryPattern {
    const requiredTables = this.extractRequiredTables(userQuery, schema);
    
    return {
      type: 'analytical',
      complexity: 'complex',
      requiredTables,
      suggestedColumns: this.extractSuggestedColumns(userQuery, schema, requiredTables)
    };
  }

  private buildFilteringSortingPattern(userQuery: string, schema: SchemaInfo): QueryPattern {
    const requiredTables = this.extractRequiredTables(userQuery, schema);
    
    return {
      type: 'filtering',
      complexity: 'simple',
      requiredTables,
      suggestedColumns: this.extractSuggestedColumns(userQuery, schema, requiredTables)
    };
  }

  private buildSimplePattern(userQuery: string, schema: SchemaInfo): QueryPattern {
    const requiredTables = this.extractRequiredTables(userQuery, schema);
    
    return {
      type: 'filtering',
      complexity: 'simple',
      requiredTables: requiredTables.length > 0 ? requiredTables : ['customers'], // Default fallback
      suggestedColumns: []
    };
  }

  private extractRequiredTables(userQuery: string, schema: SchemaInfo): string[] {
    const tableNames = Object.keys(schema.tables);
    const lowerQuery = userQuery.toLowerCase();
    
    const mentionedTables = tableNames.filter(table => {
      const singular = table.endsWith('s') ? table.slice(0, -1) : table;
      return lowerQuery.includes(table.toLowerCase()) || 
             lowerQuery.includes(singular.toLowerCase());
    });
    
    return mentionedTables.length > 0 ? mentionedTables : ['customers']; // Default fallback
  }

  private extractSuggestedColumns(userQuery: string, schema: SchemaInfo, tables: string[]): string[] {
    const columns: string[] = [];
    const lowerQuery = userQuery.toLowerCase();
    
    tables.forEach(tableName => {
      const tableInfo = schema.tables[tableName];
      if (tableInfo) {
        tableInfo.columns.forEach(col => {
          if (lowerQuery.includes(col.column_name.toLowerCase())) {
            columns.push(`${tableName}.${col.column_name}`);
          }
        });
      }
    });
    
    return columns;
  }

  private suggestJoinConditions(tables: string[], schema: SchemaInfo): JoinCondition[] {
    const joinConditions: JoinCondition[] = [];
    
    if (schema.relationships) {
      schema.relationships.forEach(rel => {
        if (tables.includes(rel.table) && tables.includes(rel.referencedTable)) {
          joinConditions.push({
            leftTable: rel.table,
            leftColumn: rel.column,
            rightTable: rel.referencedTable,
            rightColumn: rel.referencedColumn,
            joinType: 'INNER'
          });
        }
      });
    }
    
    return joinConditions;
  }
}

// Export singleton instance
export const complexQueryPatternHandler = new ComplexQueryPatternHandler();