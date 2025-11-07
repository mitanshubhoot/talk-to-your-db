import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface NLSQLExample {
  id: string;
  naturalLanguage: string;
  sql: string;
  explanation: string;
  schemaContext: string;
  queryPattern: QueryPattern;
  qualityScore: number;
  usageCount: number;
  successRate: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryPattern {
  type: 'select_all' | 'filter' | 'aggregate' | 'join' | 'subquery' | 'analytics' | 'count' | 'top_n';
  complexity: 'simple' | 'medium' | 'complex';
  tables: string[];
  operations: string[];
  keywords: string[];
}

export interface ExampleSelectionCriteria {
  userQuery: string;
  schemaContext: SchemaInfo;
  maxExamples: number;
  minSimilarityScore?: number;
  preferredPatterns?: string[];
}

export interface RankedExample extends NLSQLExample {
  similarityScore: number;
  relevanceScore: number;
  finalScore: number;
}

export class ExampleRepository {
  private examples: Map<string, NLSQLExample> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> example IDs
  private patternIndex: Map<string, Set<string>> = new Map(); // pattern -> example IDs

  constructor() {
    this.initializeWithCuratedExamples();
  }

  /**
   * Initialize repository with high-quality curated examples
   */
  private initializeWithCuratedExamples(): void {
    // Try to load examples from JSON file first
    try {
      const fs = require('fs');
      const path = require('path');
      const examplesPath = path.join(__dirname, '../../data/nl-sql-examples.json');
      
      if (fs.existsSync(examplesPath)) {
        const examplesData = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
        
        examplesData.examples.forEach((example: any, index: number) => {
          const fullExample: NLSQLExample = {
            id: example.id || `curated_${index + 1}`,
            naturalLanguage: example.naturalLanguage,
            sql: example.sql,
            explanation: example.explanation,
            schemaContext: example.schemaContext,
            queryPattern: example.queryPattern,
            qualityScore: example.qualityScore || 85,
            usageCount: 0,
            successRate: 100,
            tags: example.tags || [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          this.addExample(fullExample);
        });
        
        logger.info(`Initialized example repository with ${examplesData.examples.length} curated examples from JSON file`);
        return;
      }
    } catch (error) {
      logger.warn('Could not load examples from JSON file, using fallback examples:', error);
    }

    // Fallback to hardcoded examples if JSON file is not available
    const curatedExamples: Omit<NLSQLExample, 'id' | 'usageCount' | 'successRate' | 'createdAt' | 'updatedAt'>[] = [
      // Basic SELECT queries
      {
        naturalLanguage: "show me all customers",
        sql: "SELECT customer_id, name, email, city, country FROM customers ORDER BY name LIMIT 20;",
        explanation: "Retrieves all customer information with a reasonable limit and sorted by name for readability",
        schemaContext: "customers table with customer_id, name, email, city, country columns",
        queryPattern: {
          type: 'select_all',
          complexity: 'simple',
          tables: ['customers'],
          operations: ['SELECT', 'ORDER BY', 'LIMIT'],
          keywords: ['show', 'all', 'customers']
        },
        qualityScore: 95,
        tags: ['basic', 'select', 'customers', 'list']
      },
      {
        naturalLanguage: "list all products",
        sql: "SELECT product_id, name, price, category, description FROM products ORDER BY name LIMIT 20;",
        explanation: "Shows all products with key information, sorted alphabetically",
        schemaContext: "products table with product_id, name, price, category, description columns",
        queryPattern: {
          type: 'select_all',
          complexity: 'simple',
          tables: ['products'],
          operations: ['SELECT', 'ORDER BY', 'LIMIT'],
          keywords: ['list', 'all', 'products']
        },
        qualityScore: 95,
        tags: ['basic', 'select', 'products', 'list']
      },

      // COUNT queries
      {
        naturalLanguage: "how many customers do we have",
        sql: "SELECT COUNT(*) as customer_count FROM customers;",
        explanation: "Counts the total number of customers in the database",
        schemaContext: "customers table",
        queryPattern: {
          type: 'count',
          complexity: 'simple',
          tables: ['customers'],
          operations: ['COUNT'],
          keywords: ['how', 'many', 'customers']
        },
        qualityScore: 98,
        tags: ['count', 'aggregate', 'customers', 'total']
      },
      {
        naturalLanguage: "count the number of orders",
        sql: "SELECT COUNT(*) as order_count FROM orders;",
        explanation: "Returns the total count of orders in the system",
        schemaContext: "orders table",
        queryPattern: {
          type: 'count',
          complexity: 'simple',
          tables: ['orders'],
          operations: ['COUNT'],
          keywords: ['count', 'number', 'orders']
        },
        qualityScore: 98,
        tags: ['count', 'aggregate', 'orders', 'total']
      },

      // FILTER queries
      {
        naturalLanguage: "customers from New York",
        sql: "SELECT customer_id, name, email, city FROM customers WHERE city = 'New York' ORDER BY name;",
        explanation: "Filters customers to show only those located in New York",
        schemaContext: "customers table with city column",
        queryPattern: {
          type: 'filter',
          complexity: 'simple',
          tables: ['customers'],
          operations: ['SELECT', 'WHERE', 'ORDER BY'],
          keywords: ['customers', 'from', 'new york', 'city']
        },
        qualityScore: 92,
        tags: ['filter', 'location', 'customers', 'city']
      },
      {
        naturalLanguage: "products with price greater than 100",
        sql: "SELECT product_id, name, price, category FROM products WHERE price > 100 ORDER BY price DESC;",
        explanation: "Shows products priced above $100, sorted by price from highest to lowest",
        schemaContext: "products table with price column",
        queryPattern: {
          type: 'filter',
          complexity: 'simple',
          tables: ['products'],
          operations: ['SELECT', 'WHERE', 'ORDER BY'],
          keywords: ['products', 'price', 'greater', 'than']
        },
        qualityScore: 90,
        tags: ['filter', 'price', 'products', 'threshold']
      },

      // TOP N queries
      {
        naturalLanguage: "top 5 customers by total orders",
        sql: `SELECT c.customer_id, c.name, COUNT(o.order_id) as total_orders 
              FROM customers c 
              JOIN orders o ON c.customer_id = o.customer_id 
              GROUP BY c.customer_id, c.name 
              ORDER BY total_orders DESC 
              LIMIT 5;`,
        explanation: "Finds the 5 customers with the most orders by joining customers and orders tables",
        schemaContext: "customers and orders tables with foreign key relationship",
        queryPattern: {
          type: 'top_n',
          complexity: 'medium',
          tables: ['customers', 'orders'],
          operations: ['SELECT', 'JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'COUNT'],
          keywords: ['top', '5', 'customers', 'total', 'orders']
        },
        qualityScore: 88,
        tags: ['top', 'ranking', 'customers', 'orders', 'join']
      },
      {
        naturalLanguage: "top 10 products by revenue",
        sql: `SELECT p.product_id, p.name, SUM(oi.quantity * oi.price) as total_revenue 
              FROM products p 
              JOIN order_items oi ON p.product_id = oi.product_id 
              GROUP BY p.product_id, p.name 
              ORDER BY total_revenue DESC 
              LIMIT 10;`,
        explanation: "Calculates revenue for each product and shows the top 10 by total sales",
        schemaContext: "products and order_items tables with foreign key relationship",
        queryPattern: {
          type: 'top_n',
          complexity: 'medium',
          tables: ['products', 'order_items'],
          operations: ['SELECT', 'JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'SUM'],
          keywords: ['top', '10', 'products', 'revenue', 'sales']
        },
        qualityScore: 85,
        tags: ['top', 'ranking', 'products', 'revenue', 'join']
      },

      // AGGREGATE queries
      {
        naturalLanguage: "total revenue by month",
        sql: `SELECT 
                DATE_TRUNC('month', order_date) as month,
                SUM(total_amount) as monthly_revenue
              FROM orders 
              GROUP BY DATE_TRUNC('month', order_date)
              ORDER BY month DESC;`,
        explanation: "Groups orders by month and calculates total revenue for each month",
        schemaContext: "orders table with order_date and total_amount columns",
        queryPattern: {
          type: 'aggregate',
          complexity: 'medium',
          tables: ['orders'],
          operations: ['SELECT', 'GROUP BY', 'ORDER BY', 'SUM', 'DATE_TRUNC'],
          keywords: ['total', 'revenue', 'by', 'month']
        },
        qualityScore: 87,
        tags: ['aggregate', 'revenue', 'monthly', 'time-series']
      },
      {
        naturalLanguage: "average order value by customer",
        sql: `SELECT 
                c.customer_id, 
                c.name, 
                AVG(o.total_amount) as avg_order_value,
                COUNT(o.order_id) as order_count
              FROM customers c 
              JOIN orders o ON c.customer_id = o.customer_id 
              GROUP BY c.customer_id, c.name 
              ORDER BY avg_order_value DESC;`,
        explanation: "Calculates the average order value for each customer along with their order count",
        schemaContext: "customers and orders tables with foreign key relationship",
        queryPattern: {
          type: 'aggregate',
          complexity: 'medium',
          tables: ['customers', 'orders'],
          operations: ['SELECT', 'JOIN', 'GROUP BY', 'ORDER BY', 'AVG', 'COUNT'],
          keywords: ['average', 'order', 'value', 'by', 'customer']
        },
        qualityScore: 86,
        tags: ['aggregate', 'average', 'customers', 'orders', 'join']
      },

      // JOIN queries
      {
        naturalLanguage: "orders with customer information",
        sql: `SELECT 
                o.order_id, 
                o.order_date, 
                o.total_amount,
                c.name as customer_name,
                c.email as customer_email
              FROM orders o 
              JOIN customers c ON o.customer_id = c.customer_id 
              ORDER BY o.order_date DESC 
              LIMIT 20;`,
        explanation: "Combines order data with customer details to show comprehensive order information",
        schemaContext: "orders and customers tables with foreign key relationship",
        queryPattern: {
          type: 'join',
          complexity: 'medium',
          tables: ['orders', 'customers'],
          operations: ['SELECT', 'JOIN', 'ORDER BY', 'LIMIT'],
          keywords: ['orders', 'with', 'customer', 'information']
        },
        qualityScore: 90,
        tags: ['join', 'orders', 'customers', 'details']
      },

      // Complex analytical queries
      {
        naturalLanguage: "customers who haven't placed orders in the last 6 months",
        sql: `SELECT c.customer_id, c.name, c.email, MAX(o.order_date) as last_order_date
              FROM customers c
              LEFT JOIN orders o ON c.customer_id = o.customer_id
              GROUP BY c.customer_id, c.name, c.email
              HAVING MAX(o.order_date) < CURRENT_DATE - INTERVAL '6 months' 
                 OR MAX(o.order_date) IS NULL
              ORDER BY last_order_date DESC NULLS LAST;`,
        explanation: "Identifies inactive customers using LEFT JOIN and date filtering to find those without recent orders",
        schemaContext: "customers and orders tables with foreign key relationship",
        queryPattern: {
          type: 'analytics',
          complexity: 'complex',
          tables: ['customers', 'orders'],
          operations: ['SELECT', 'LEFT JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'MAX'],
          keywords: ['customers', 'haven\'t', 'placed', 'orders', 'last', '6', 'months']
        },
        qualityScore: 82,
        tags: ['analytics', 'inactive', 'customers', 'complex', 'left-join']
      }
    ];

    // Add curated examples to repository
    curatedExamples.forEach((example, index) => {
      const id = `curated_${index + 1}`;
      const fullExample: NLSQLExample = {
        ...example,
        id,
        usageCount: 0,
        successRate: 100, // Start with perfect success rate for curated examples
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.addExample(fullExample);
    });

    logger.info(`Initialized example repository with ${curatedExamples.length} curated examples`);
  }

  /**
   * Add a new example to the repository
   */
  addExample(example: NLSQLExample): void {
    this.examples.set(example.id, example);
    this.updateIndexes(example);
    logger.debug(`Added example: ${example.id}`);
  }

  /**
   * Update indexes for fast keyword and pattern lookup
   */
  private updateIndexes(example: NLSQLExample): void {
    // Index keywords from natural language query
    const keywords = this.extractKeywords(example.naturalLanguage);
    keywords.forEach(keyword => {
      if (!this.keywordIndex.has(keyword)) {
        this.keywordIndex.set(keyword, new Set());
      }
      this.keywordIndex.get(keyword)!.add(example.id);
    });

    // Index query patterns
    const patternKey = `${example.queryPattern.type}_${example.queryPattern.complexity}`;
    if (!this.patternIndex.has(patternKey)) {
      this.patternIndex.set(patternKey, new Set());
    }
    this.patternIndex.get(patternKey)!.add(example.id);

    // Index by tables
    example.queryPattern.tables.forEach(table => {
      const tableKey = `table_${table}`;
      if (!this.patternIndex.has(tableKey)) {
        this.patternIndex.set(tableKey, new Set());
      }
      this.patternIndex.get(tableKey)!.add(example.id);
    });
  }

  /**
   * Extract keywords from natural language query
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can']);
    
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter(word => !word.match(/^\d+$/)); // Remove pure numbers
  }

  /**
   * Select the most relevant examples for a given query
   */
  selectExamples(criteria: ExampleSelectionCriteria): RankedExample[] {
    const candidates = this.getCandidateExamples(criteria);
    const rankedExamples = this.rankExamples(criteria, candidates);
    
    // Filter by minimum similarity score if specified
    const filtered = criteria.minSimilarityScore 
      ? rankedExamples.filter(ex => ex.similarityScore >= criteria.minSimilarityScore!)
      : rankedExamples;
    
    // Return top N examples
    const selected = filtered.slice(0, criteria.maxExamples);
    
    logger.debug(`Selected ${selected.length} examples from ${candidates.length} candidates for query: "${criteria.userQuery}"`);
    
    return selected;
  }

  /**
   * Get candidate examples using keyword and pattern matching
   */
  private getCandidateExamples(criteria: ExampleSelectionCriteria): NLSQLExample[] {
    const candidateIds = new Set<string>();
    const queryKeywords = this.extractKeywords(criteria.userQuery);
    const relevantTables = this.identifyRelevantTables(criteria.userQuery, criteria.schemaContext);

    // Find examples by keyword matching
    queryKeywords.forEach(keyword => {
      const exampleIds = this.keywordIndex.get(keyword);
      if (exampleIds) {
        exampleIds.forEach(id => candidateIds.add(id));
      }
    });

    // Find examples by table matching
    relevantTables.forEach(table => {
      const tableKey = `table_${table}`;
      const exampleIds = this.patternIndex.get(tableKey);
      if (exampleIds) {
        exampleIds.forEach(id => candidateIds.add(id));
      }
    });

    // Find examples by preferred patterns
    if (criteria.preferredPatterns) {
      criteria.preferredPatterns.forEach(pattern => {
        const exampleIds = this.patternIndex.get(pattern);
        if (exampleIds) {
          exampleIds.forEach(id => candidateIds.add(id));
        }
      });
    }

    // If no candidates found, return some high-quality examples
    if (candidateIds.size === 0) {
      const allExamples = Array.from(this.examples.values());
      const highQuality = allExamples
        .filter(ex => ex.qualityScore >= 85)
        .sort((a, b) => b.qualityScore - a.qualityScore)
        .slice(0, 10);
      return highQuality;
    }

    return Array.from(candidateIds).map(id => this.examples.get(id)!).filter(Boolean);
  }

  /**
   * Rank examples by relevance to the user query
   */
  private rankExamples(criteria: ExampleSelectionCriteria, candidates: NLSQLExample[]): RankedExample[] {
    const queryKeywords = this.extractKeywords(criteria.userQuery);
    const relevantTables = this.identifyRelevantTables(criteria.userQuery, criteria.schemaContext);

    return candidates.map(example => {
      const similarityScore = this.calculateSimilarityScore(criteria.userQuery, example, queryKeywords);
      const relevanceScore = this.calculateRelevanceScore(example, relevantTables, criteria.schemaContext);
      const qualityScore = example.qualityScore / 100; // Normalize to 0-1
      const usageScore = Math.min(example.usageCount / 10, 1); // Normalize usage count
      const successScore = example.successRate / 100; // Normalize to 0-1

      // Weighted final score
      const finalScore = (
        similarityScore * 0.35 +
        relevanceScore * 0.25 +
        qualityScore * 0.20 +
        successScore * 0.15 +
        usageScore * 0.05
      );

      return {
        ...example,
        similarityScore,
        relevanceScore,
        finalScore
      } as RankedExample;
    }).sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculate similarity score between user query and example
   */
  private calculateSimilarityScore(userQuery: string, example: NLSQLExample, queryKeywords: string[]): number {
    const exampleKeywords = this.extractKeywords(example.naturalLanguage);
    
    if (queryKeywords.length === 0 || exampleKeywords.length === 0) {
      return 0;
    }

    // Calculate Jaccard similarity
    const intersection = queryKeywords.filter(keyword => exampleKeywords.includes(keyword));
    const union = [...new Set([...queryKeywords, ...exampleKeywords])];
    
    const jaccardSimilarity = intersection.length / union.length;

    // Boost score for exact phrase matches
    const lowerUserQuery = userQuery.toLowerCase();
    const lowerExampleQuery = example.naturalLanguage.toLowerCase();
    
    let phraseBoost = 0;
    if (lowerUserQuery.includes(lowerExampleQuery) || lowerExampleQuery.includes(lowerUserQuery)) {
      phraseBoost = 0.3;
    } else {
      // Check for common phrases
      const commonPhrases = ['show me', 'how many', 'top 5', 'top 10', 'total revenue', 'by month'];
      for (const phrase of commonPhrases) {
        if (lowerUserQuery.includes(phrase) && lowerExampleQuery.includes(phrase)) {
          phraseBoost = Math.max(phraseBoost, 0.2);
        }
      }
    }

    return Math.min(jaccardSimilarity + phraseBoost, 1.0);
  }

  /**
   * Calculate relevance score based on schema context
   */
  private calculateRelevanceScore(example: NLSQLExample, relevantTables: string[], schema: SchemaInfo): number {
    let score = 0;

    // Table overlap score
    const exampleTables = example.queryPattern.tables;
    const tableOverlap = exampleTables.filter(table => relevantTables.includes(table));
    const tableScore = tableOverlap.length / Math.max(exampleTables.length, relevantTables.length);
    score += tableScore * 0.6;

    // Schema compatibility score
    const schemaCompatibility = this.calculateSchemaCompatibility(example, schema);
    score += schemaCompatibility * 0.4;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate how compatible an example is with the current schema
   */
  private calculateSchemaCompatibility(example: NLSQLExample, schema: SchemaInfo): number {
    const exampleTables = example.queryPattern.tables;
    const schemaTables = Object.keys(schema.tables);
    
    // Check if all example tables exist in schema
    const existingTables = exampleTables.filter(table => schemaTables.includes(table));
    
    if (exampleTables.length === 0) return 1.0; // Generic examples are always compatible
    
    return existingTables.length / exampleTables.length;
  }

  /**
   * Identify relevant tables from user query and schema
   */
  private identifyRelevantTables(userQuery: string, schema: SchemaInfo): string[] {
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

  /**
   * Update example quality based on user feedback
   */
  updateExampleQuality(exampleId: string, wasSuccessful: boolean): void {
    const example = this.examples.get(exampleId);
    if (!example) return;

    example.usageCount++;
    
    // Update success rate using exponential moving average
    const alpha = 0.1; // Learning rate
    const newSuccessValue = wasSuccessful ? 100 : 0;
    example.successRate = (1 - alpha) * example.successRate + alpha * newSuccessValue;
    
    // Update quality score based on success rate
    if (example.successRate < 70 && example.qualityScore > 60) {
      example.qualityScore = Math.max(example.qualityScore - 5, 50);
    } else if (example.successRate > 90 && example.qualityScore < 95) {
      example.qualityScore = Math.min(example.qualityScore + 2, 95);
    }
    
    example.updatedAt = new Date();
    
    logger.debug(`Updated example ${exampleId}: usage=${example.usageCount}, success=${example.successRate.toFixed(1)}%, quality=${example.qualityScore}`);
  }

  /**
   * Get repository statistics
   */
  getStats(): {
    totalExamples: number;
    averageQuality: number;
    patternDistribution: Record<string, number>;
    complexityDistribution: Record<string, number>;
  } {
    const examples = Array.from(this.examples.values());
    
    const patternDistribution: Record<string, number> = {};
    const complexityDistribution: Record<string, number> = {};
    
    examples.forEach(example => {
      patternDistribution[example.queryPattern.type] = (patternDistribution[example.queryPattern.type] || 0) + 1;
      complexityDistribution[example.queryPattern.complexity] = (complexityDistribution[example.queryPattern.complexity] || 0) + 1;
    });

    return {
      totalExamples: examples.length,
      averageQuality: examples.reduce((sum, ex) => sum + ex.qualityScore, 0) / examples.length,
      patternDistribution,
      complexityDistribution
    };
  }
}

// Export singleton instance
export const exampleRepository = new ExampleRepository();