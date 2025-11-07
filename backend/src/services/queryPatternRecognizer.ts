import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface QueryIntent {
  type: 'select_all' | 'filter' | 'aggregate' | 'join' | 'subquery' | 'analytics' | 'count' | 'top_n' | 'comparison' | 'time_series';
  complexity: QueryComplexity;
  entities: string[];
  operations: string[];
  conditions: string[];
  confidence: number;
  patterns: RecognizedPattern[];
}

export type QueryComplexity = 'simple' | 'medium' | 'complex';

export interface RecognizedPattern {
  type: string;
  confidence: number;
  keywords: string[];
  sqlHints: string[];
}

export interface PatternRule {
  name: string;
  type: QueryIntent['type'];
  complexity: QueryComplexity;
  keywords: string[];
  requiredKeywords?: string[];
  excludeKeywords?: string[];
  patterns: RegExp[];
  operations: string[];
  confidence: number;
  sqlHints: string[];
}

export class QueryPatternRecognizer {
  private patterns: PatternRule[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize pattern recognition rules
   */
  private initializePatterns(): void {
    this.patterns = [
      // SELECT ALL patterns
      {
        name: 'basic_select_all',
        type: 'select_all',
        complexity: 'simple',
        keywords: ['show', 'list', 'all', 'display', 'get'],
        patterns: [
          /^(show|list|display|get)\s+(me\s+)?(all\s+)?(\w+)s?$/i,
          /^(all\s+)?(\w+)s?$/i
        ],
        operations: ['SELECT'],
        confidence: 90,
        sqlHints: ['SELECT * FROM table', 'ORDER BY', 'LIMIT']
      },

      // COUNT patterns
      {
        name: 'simple_count',
        type: 'count',
        complexity: 'simple',
        keywords: ['count', 'how many', 'number of', 'total number'],
        requiredKeywords: ['count', 'many', 'number'],
        patterns: [
          /^(how\s+many|count|number\s+of)\s+(\w+)s?/i,
          /^total\s+number\s+of\s+(\w+)s?/i
        ],
        operations: ['COUNT'],
        confidence: 95,
        sqlHints: ['SELECT COUNT(*) FROM table']
      },

      // FILTER patterns
      {
        name: 'location_filter',
        type: 'filter',
        complexity: 'simple',
        keywords: ['from', 'in', 'located', 'city', 'country', 'state'],
        patterns: [
          /(\w+)s?\s+(from|in)\s+([a-zA-Z\s]+)/i,
          /(from|in)\s+([a-zA-Z\s]+)/i
        ],
        operations: ['SELECT', 'WHERE'],
        confidence: 85,
        sqlHints: ['WHERE city = ?', 'WHERE country = ?']
      },
      {
        name: 'threshold_filter',
        type: 'filter',
        complexity: 'simple',
        keywords: ['greater than', 'more than', 'above', 'over', 'less than', 'below', 'under'],
        patterns: [
          /(greater\s+than|more\s+than|above|over|\>)\s*(\d+)/i,
          /(less\s+than|fewer\s+than|below|under|\<)\s*(\d+)/i,
          /(\w+)\s+(greater\s+than|more\s+than|above|over)\s*(\d+)/i
        ],
        operations: ['SELECT', 'WHERE'],
        confidence: 88,
        sqlHints: ['WHERE column > value', 'WHERE column < value']
      },
      {
        name: 'date_filter',
        type: 'filter',
        complexity: 'medium',
        keywords: ['last', 'past', 'this', 'current', 'month', 'year', 'week', 'day'],
        patterns: [
          /(last|past)\s+(month|year|week|day|(\d+)\s+(months|years|weeks|days))/i,
          /(this|current)\s+(month|year|week|day)/i,
          /in\s+the\s+(last|past)\s+(\d+)\s+(months|years|weeks|days)/i
        ],
        operations: ['SELECT', 'WHERE'],
        confidence: 80,
        sqlHints: ['WHERE date >= CURRENT_DATE - INTERVAL', 'DATE_TRUNC']
      },

      // TOP N patterns
      {
        name: 'top_n_ranking',
        type: 'top_n',
        complexity: 'medium',
        keywords: ['top', 'best', 'highest', 'largest', 'bottom', 'worst', 'lowest', 'smallest'],
        requiredKeywords: ['top', 'best', 'highest', 'largest', 'bottom', 'worst', 'lowest', 'smallest'],
        patterns: [
          /(top|best|highest|largest)\s*(\d+)?\s+(\w+)s?/i,
          /(bottom|worst|lowest|smallest)\s*(\d+)?\s+(\w+)s?/i,
          /(\d+)\s+(top|best|highest|largest|bottom|worst|lowest|smallest)\s+(\w+)s?/i
        ],
        operations: ['SELECT', 'ORDER BY', 'LIMIT'],
        confidence: 92,
        sqlHints: ['ORDER BY column DESC LIMIT N', 'ORDER BY column ASC LIMIT N']
      },

      // AGGREGATE patterns
      {
        name: 'sum_total',
        type: 'aggregate',
        complexity: 'medium',
        keywords: ['total', 'sum', 'revenue', 'sales', 'amount'],
        patterns: [
          /(total|sum)\s+(\w+)/i,
          /(revenue|sales)\s+(by|per|for)\s+(\w+)/i,
          /total\s+(\w+)\s+(by|per|for)\s+(\w+)/i
        ],
        operations: ['SELECT', 'SUM', 'GROUP BY'],
        confidence: 87,
        sqlHints: ['SELECT SUM(column)', 'GROUP BY category']
      },
      {
        name: 'average_calculation',
        type: 'aggregate',
        complexity: 'medium',
        keywords: ['average', 'avg', 'mean'],
        patterns: [
          /(average|avg|mean)\s+(\w+)/i,
          /(average|avg|mean)\s+(\w+)\s+(by|per|for)\s+(\w+)/i
        ],
        operations: ['SELECT', 'AVG', 'GROUP BY'],
        confidence: 90,
        sqlHints: ['SELECT AVG(column)', 'GROUP BY category']
      },
      {
        name: 'group_by_analysis',
        type: 'aggregate',
        complexity: 'medium',
        keywords: ['by', 'per', 'for each', 'group by', 'breakdown'],
        patterns: [
          /(\w+)\s+(by|per)\s+(\w+)/i,
          /(for\s+each|group\s+by)\s+(\w+)/i,
          /breakdown\s+(of\s+)?(\w+)\s+(by|per)\s+(\w+)/i
        ],
        operations: ['SELECT', 'GROUP BY'],
        confidence: 85,
        sqlHints: ['GROUP BY column', 'aggregate functions needed']
      },

      // JOIN patterns
      {
        name: 'basic_join',
        type: 'join',
        complexity: 'medium',
        keywords: ['with', 'and their', 'along with', 'including', 'together with'],
        patterns: [
          /(\w+)s?\s+(with|and\s+their|along\s+with|including)\s+(\w+)s?/i,
          /(\w+)s?\s+together\s+with\s+(\w+)s?/i
        ],
        operations: ['SELECT', 'JOIN'],
        confidence: 80,
        sqlHints: ['JOIN table ON foreign_key = primary_key']
      },
      {
        name: 'relationship_join',
        type: 'join',
        complexity: 'medium',
        keywords: ['customers who', 'products that', 'orders with', 'users who have'],
        patterns: [
          /(\w+)s?\s+who\s+(have|placed|bought|ordered)/i,
          /(\w+)s?\s+that\s+(are|were|have|contain)/i,
          /(\w+)s?\s+with\s+(\w+)s?/i
        ],
        operations: ['SELECT', 'JOIN', 'WHERE'],
        confidence: 82,
        sqlHints: ['JOIN with WHERE conditions']
      },

      // ANALYTICS patterns
      {
        name: 'trend_analysis',
        type: 'analytics',
        complexity: 'complex',
        keywords: ['trend', 'over time', 'monthly', 'yearly', 'growth', 'change'],
        patterns: [
          /(\w+)\s+(trend|over\s+time)/i,
          /(monthly|yearly|daily)\s+(\w+)/i,
          /(\w+)\s+(growth|change)\s+(over|by)/i
        ],
        operations: ['SELECT', 'GROUP BY', 'ORDER BY', 'DATE_TRUNC'],
        confidence: 75,
        sqlHints: ['GROUP BY date period', 'ORDER BY date', 'time series analysis']
      },
      {
        name: 'comparison_analysis',
        type: 'comparison',
        complexity: 'complex',
        keywords: ['compare', 'vs', 'versus', 'compared to', 'difference between'],
        patterns: [
          /compare\s+(\w+)\s+(vs|versus|to|with)\s+(\w+)/i,
          /(\w+)\s+(vs|versus)\s+(\w+)/i,
          /difference\s+between\s+(\w+)\s+and\s+(\w+)/i
        ],
        operations: ['SELECT', 'CASE', 'UNION', 'JOIN'],
        confidence: 70,
        sqlHints: ['CASE statements', 'subqueries for comparison']
      },

      // TIME SERIES patterns
      {
        name: 'time_series',
        type: 'time_series',
        complexity: 'complex',
        keywords: ['by month', 'by year', 'by day', 'by week', 'over time', 'time series'],
        patterns: [
          /(\w+)\s+by\s+(month|year|day|week)/i,
          /(\w+)\s+over\s+time/i,
          /(monthly|yearly|daily|weekly)\s+(\w+)/i
        ],
        operations: ['SELECT', 'GROUP BY', 'DATE_TRUNC', 'ORDER BY'],
        confidence: 78,
        sqlHints: ['DATE_TRUNC for grouping', 'ORDER BY date']
      },

      // SUBQUERY patterns
      {
        name: 'nested_condition',
        type: 'subquery',
        complexity: 'complex',
        keywords: ['who have', 'that have', 'with more than', 'with less than', 'without'],
        patterns: [
          /(\w+)s?\s+who\s+have\s+(more\s+than|less\s+than|at\s+least)\s*(\d+)/i,
          /(\w+)s?\s+that\s+have\s+(never|not|no)/i,
          /(\w+)s?\s+without\s+(\w+)s?/i
        ],
        operations: ['SELECT', 'WHERE', 'EXISTS', 'NOT EXISTS'],
        confidence: 72,
        sqlHints: ['subqueries with EXISTS', 'correlated subqueries']
      }
    ];

    logger.info(`Initialized ${this.patterns.length} query pattern recognition rules`);
  }

  /**
   * Recognize query patterns and intent
   */
  recognizeQuery(userQuery: string, schema?: SchemaInfo): QueryIntent {
    const normalizedQuery = userQuery.toLowerCase().trim();
    const matchedPatterns: RecognizedPattern[] = [];
    const entities = this.extractEntities(userQuery, schema);
    const operations: string[] = [];
    const conditions: string[] = [];

    let bestMatch: PatternRule | null = null;
    let bestScore = 0;

    // Test each pattern rule
    for (const rule of this.patterns) {
      const score = this.calculatePatternScore(normalizedQuery, rule);
      
      if (score > 0) {
        matchedPatterns.push({
          type: rule.name,
          confidence: score,
          keywords: rule.keywords.filter(kw => normalizedQuery.includes(kw)),
          sqlHints: rule.sqlHints
        });

        // Track best overall match
        if (score > bestScore) {
          bestScore = score;
          bestMatch = rule;
        }

        // Collect operations and conditions
        operations.push(...rule.operations);
        conditions.push(...this.extractConditions(normalizedQuery, rule));
      }
    }

    // Determine final intent
    const intent: QueryIntent = {
      type: bestMatch?.type || 'select_all',
      complexity: this.assessComplexity(userQuery, entities, matchedPatterns),
      entities: entities,
      operations: [...new Set(operations)], // Remove duplicates
      conditions: [...new Set(conditions)], // Remove duplicates
      confidence: bestScore,
      patterns: matchedPatterns.sort((a, b) => b.confidence - a.confidence)
    };

    logger.debug(`Recognized query intent: ${intent.type} (${intent.complexity}) with ${intent.confidence}% confidence`);

    return intent;
  }

  /**
   * Calculate pattern matching score
   */
  private calculatePatternScore(query: string, rule: PatternRule): number {
    let score = 0;

    // Check required keywords
    if (rule.requiredKeywords) {
      const hasRequired = rule.requiredKeywords.some(keyword => 
        query.includes(keyword.toLowerCase())
      );
      if (!hasRequired) return 0;
    }

    // Check excluded keywords
    if (rule.excludeKeywords) {
      const hasExcluded = rule.excludeKeywords.some(keyword => 
        query.includes(keyword.toLowerCase())
      );
      if (hasExcluded) return 0;
    }

    // Score based on keyword matches
    const keywordMatches = rule.keywords.filter(keyword => 
      query.includes(keyword.toLowerCase())
    ).length;
    const keywordScore = (keywordMatches / rule.keywords.length) * 40;
    score += keywordScore;

    // Score based on regex pattern matches
    const patternMatches = rule.patterns.filter(pattern => 
      pattern.test(query)
    ).length;
    const patternScore = (patternMatches / rule.patterns.length) * 40;
    score += patternScore;

    // Base confidence from rule
    score += rule.confidence * 0.2;

    return Math.min(score, 100);
  }

  /**
   * Extract entities (table names) from query
   */
  private extractEntities(query: string, schema?: SchemaInfo): string[] {
    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (schema) {
      // Use schema to identify table references
      Object.keys(schema.tables).forEach(tableName => {
        const tableWords = tableName.toLowerCase().split('_');
        const singularForms = tableWords.map(word => {
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
      // Fallback to common entity detection
      const commonEntities = [
        { patterns: ['customer', 'client'], table: 'customers' },
        { patterns: ['product', 'item'], table: 'products' },
        { patterns: ['order'], table: 'orders' },
        { patterns: ['user'], table: 'users' },
        { patterns: ['category'], table: 'categories' },
        { patterns: ['payment'], table: 'payments' },
        { patterns: ['invoice'], table: 'invoices' }
      ];

      commonEntities.forEach(entity => {
        if (entity.patterns.some(pattern => lowerQuery.includes(pattern))) {
          entities.push(entity.table);
        }
      });
    }

    return [...new Set(entities)]; // Remove duplicates
  }

  /**
   * Extract conditions from query based on pattern rule
   */
  private extractConditions(query: string, rule: PatternRule): string[] {
    const conditions: string[] = [];

    // Location conditions
    if (rule.name === 'location_filter') {
      const locationMatch = query.match(/(from|in)\s+([a-zA-Z\s]+)/i);
      if (locationMatch) {
        conditions.push(`location: ${locationMatch[2].trim()}`);
      }
    }

    // Threshold conditions
    if (rule.name === 'threshold_filter') {
      const thresholdMatch = query.match(/(greater\s+than|more\s+than|above|over|less\s+than|below|under)\s*(\d+)/i);
      if (thresholdMatch) {
        conditions.push(`threshold: ${thresholdMatch[1]} ${thresholdMatch[2]}`);
      }
    }

    // Date conditions
    if (rule.name === 'date_filter') {
      const dateMatch = query.match(/(last|past|this|current)\s+(month|year|week|day|\d+\s+(months|years|weeks|days))/i);
      if (dateMatch) {
        conditions.push(`date: ${dateMatch[1]} ${dateMatch[2]}`);
      }
    }

    // Top N conditions
    if (rule.name === 'top_n_ranking') {
      const topMatch = query.match(/(top|bottom)\s*(\d+)?/i);
      if (topMatch) {
        const direction = topMatch[1].toLowerCase();
        const count = topMatch[2] || '10';
        conditions.push(`ranking: ${direction} ${count}`);
      }
    }

    return conditions;
  }

  /**
   * Assess query complexity based on various factors
   */
  private assessComplexity(query: string, entities: string[], patterns: RecognizedPattern[]): QueryComplexity {
    let complexityScore = 0;

    // Multiple entities increase complexity
    if (entities.length > 2) complexityScore += 2;
    else if (entities.length > 1) complexityScore += 1;

    // Complex patterns increase complexity
    const complexPatterns = patterns.filter(p => 
      p.type.includes('analytics') || 
      p.type.includes('subquery') || 
      p.type.includes('comparison') ||
      p.type.includes('time_series')
    );
    complexityScore += complexPatterns.length;

    // Multiple conditions increase complexity
    const lowerQuery = query.toLowerCase();
    const conditionWords = ['where', 'and', 'or', 'having', 'case when', 'exists'];
    const conditionCount = conditionWords.filter(word => lowerQuery.includes(word)).length;
    if (conditionCount > 2) complexityScore += 1;

    // Advanced SQL features
    const advancedFeatures = ['join', 'group by', 'order by', 'subquery', 'window function'];
    const advancedCount = advancedFeatures.filter(feature => lowerQuery.includes(feature)).length;
    complexityScore += advancedCount;

    // Time-based analysis
    if (lowerQuery.includes('trend') || lowerQuery.includes('over time') || 
        lowerQuery.includes('monthly') || lowerQuery.includes('yearly')) {
      complexityScore += 1;
    }

    // Determine final complexity
    if (complexityScore >= 4) return 'complex';
    if (complexityScore >= 2) return 'medium';
    return 'simple';
  }

  /**
   * Get specialized handling suggestions for recognized patterns
   */
  getHandlingSuggestions(intent: QueryIntent): {
    sqlTemplate: string;
    optimizations: string[];
    warnings: string[];
  } {
    const suggestions = {
      sqlTemplate: '',
      optimizations: [] as string[],
      warnings: [] as string[]
    };

    switch (intent.type) {
      case 'select_all':
        suggestions.sqlTemplate = 'SELECT columns FROM table ORDER BY column LIMIT N';
        suggestions.optimizations.push('Add LIMIT to prevent large result sets');
        suggestions.optimizations.push('Specify columns instead of SELECT *');
        break;

      case 'count':
        suggestions.sqlTemplate = 'SELECT COUNT(*) FROM table WHERE conditions';
        suggestions.optimizations.push('Use COUNT(*) for better performance');
        break;

      case 'filter':
        suggestions.sqlTemplate = 'SELECT columns FROM table WHERE conditions ORDER BY column';
        suggestions.optimizations.push('Use indexes on filtered columns');
        suggestions.optimizations.push('Use ILIKE for case-insensitive text matching');
        break;

      case 'top_n':
        suggestions.sqlTemplate = 'SELECT columns FROM table ORDER BY column DESC LIMIT N';
        suggestions.optimizations.push('Ensure ORDER BY column is indexed');
        suggestions.warnings.push('Large tables may need optimization');
        break;

      case 'aggregate':
        suggestions.sqlTemplate = 'SELECT column, AGG_FUNC(column) FROM table GROUP BY column';
        suggestions.optimizations.push('Include all non-aggregated columns in GROUP BY');
        suggestions.optimizations.push('Consider using indexes on GROUP BY columns');
        break;

      case 'join':
        suggestions.sqlTemplate = 'SELECT columns FROM table1 t1 JOIN table2 t2 ON t1.id = t2.foreign_id';
        suggestions.optimizations.push('Use proper foreign key relationships');
        suggestions.optimizations.push('Consider JOIN order for performance');
        suggestions.warnings.push('Verify foreign key relationships exist');
        break;

      case 'analytics':
        suggestions.sqlTemplate = 'SELECT date_column, AGG_FUNC(column) FROM table GROUP BY date_column ORDER BY date_column';
        suggestions.optimizations.push('Use DATE_TRUNC for time grouping');
        suggestions.optimizations.push('Consider partitioning for large time series data');
        suggestions.warnings.push('Complex analytics may require optimization');
        break;

      case 'time_series':
        suggestions.sqlTemplate = 'SELECT DATE_TRUNC(\'period\', date_col), AGG_FUNC(col) FROM table GROUP BY 1 ORDER BY 1';
        suggestions.optimizations.push('Use appropriate date functions for grouping');
        suggestions.optimizations.push('Index date columns for better performance');
        break;

      case 'subquery':
        suggestions.sqlTemplate = 'SELECT columns FROM table WHERE EXISTS (SELECT 1 FROM other_table WHERE condition)';
        suggestions.optimizations.push('Consider JOINs instead of subqueries when possible');
        suggestions.optimizations.push('Use EXISTS instead of IN for better performance');
        suggestions.warnings.push('Complex subqueries may impact performance');
        break;
    }

    return suggestions;
  }

  /**
   * Get pattern statistics for monitoring
   */
  getPatternStats(): {
    totalPatterns: number;
    patternsByType: Record<string, number>;
    patternsByComplexity: Record<string, number>;
  } {
    const patternsByType: Record<string, number> = {};
    const patternsByComplexity: Record<string, number> = {};

    this.patterns.forEach(pattern => {
      patternsByType[pattern.type] = (patternsByType[pattern.type] || 0) + 1;
      patternsByComplexity[pattern.complexity] = (patternsByComplexity[pattern.complexity] || 0) + 1;
    });

    return {
      totalPatterns: this.patterns.length,
      patternsByType,
      patternsByComplexity
    };
  }
}

// Export singleton instance
export const queryPatternRecognizer = new QueryPatternRecognizer();