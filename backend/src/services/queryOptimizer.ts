import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/query-optimizer.log' })
  ]
});

export interface OptimizationSuggestion {
  type: 'performance' | 'safety' | 'best_practice';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  originalSql: string;
  suggestedSql?: string;
  impact: string;
  reasoning: string;
}

export interface QueryAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  estimatedRows: number;
  tablesInvolved: string[];
  hasJoins: boolean;
  hasAggregation: boolean;
  hasSubqueries: boolean;
  potentiallySlowOperations: string[];
  indexUsage: {
    table: string;
    column: string;
    hasIndex: boolean;
  }[];
}

export interface PerformanceWarning {
  type: 'large_dataset' | 'missing_index' | 'cartesian_product' | 'inefficient_like' | 'no_limit';
  message: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

/**
 * Query optimization and performance analysis service
 */
export class QueryOptimizer {
  
  /**
   * Analyze query performance and provide optimization suggestions
   */
  async analyzeQuery(sql: string, schema: SchemaInfo): Promise<{
    analysis: QueryAnalysis;
    suggestions: OptimizationSuggestion[];
    warnings: PerformanceWarning[];
    executionTimeEstimate: number;
  }> {
    try {
      const analysis = this.performQueryAnalysis(sql, schema);
      const suggestions = this.generateOptimizationSuggestions(sql, schema, analysis);
      const warnings = this.generatePerformanceWarnings(sql, schema, analysis);
      const executionTimeEstimate = this.estimateExecutionTime(analysis, schema);

      logger.info('Query analysis completed', {
        complexity: analysis.complexity,
        tablesInvolved: analysis.tablesInvolved.length,
        suggestionsCount: suggestions.length,
        warningsCount: warnings.length
      });

      return {
        analysis,
        suggestions,
        warnings,
        executionTimeEstimate
      };

    } catch (error) {
      logger.error('Failed to analyze query:', error);
      throw error;
    }
  }

  /**
   * Get quick optimization tips for a query
   */
  getQuickOptimizationTips(sql: string, schema: SchemaInfo): string[] {
    const tips: string[] = [];
    const lowerSql = sql.toLowerCase();

    // Check for SELECT *
    if (lowerSql.includes('select *')) {
      tips.push('Consider selecting only the columns you need instead of using SELECT *');
    }

    // Check for missing LIMIT
    if (!lowerSql.includes('limit') && !lowerSql.includes('count(')) {
      tips.push('Add a LIMIT clause to prevent accidentally retrieving too many rows');
    }

    // Check for inefficient LIKE patterns
    if (lowerSql.includes("like '%")) {
      tips.push('LIKE patterns starting with % can be slow. Consider using full-text search if available');
    }

    // Check for missing indexes on WHERE columns
    const whereColumns = this.extractWhereColumns(sql);
    whereColumns.forEach(column => {
      const table = this.findTableForColumn(column, schema);
      if (table && !this.hasIndexOnColumn(table, column, schema)) {
        tips.push(`Consider adding an index on ${table}.${column} for better WHERE clause performance`);
      }
    });

    // Check for potential Cartesian products
    const tables = this.extractTableNames(sql);
    if (tables.length > 1 && !lowerSql.includes('join') && !lowerSql.includes('where')) {
      tips.push('Multiple tables without JOIN conditions may result in a Cartesian product');
    }

    return tips;
  }

  /**
   * Suggest query improvements
   */
  suggestQueryImprovements(sql: string, schema: SchemaInfo): {
    improvedSql: string;
    improvements: string[];
  } {
    let improvedSql = sql;
    const improvements: string[] = [];

    // Add LIMIT if missing and not a COUNT query
    if (!sql.toLowerCase().includes('limit') && 
        !sql.toLowerCase().includes('count(') &&
        sql.toLowerCase().startsWith('select')) {
      improvedSql = improvedSql.replace(/;?\s*$/, ' LIMIT 100;');
      improvements.push('Added LIMIT 100 to prevent large result sets');
    }

    // Replace SELECT * with specific columns where possible
    if (sql.toLowerCase().includes('select *')) {
      const tables = this.extractTableNames(sql);
      if (tables.length === 1 && schema.tables[tables[0]]) {
        const columns = schema.tables[tables[0]].columns
          .slice(0, 5) // Limit to first 5 columns
          .map(col => col.column_name)
          .join(', ');
        
        improvedSql = improvedSql.replace(/select\s+\*/i, `SELECT ${columns}`);
        improvements.push('Replaced SELECT * with specific columns for better performance');
      }
    }

    // Add ORDER BY for consistent results if missing
    if (!sql.toLowerCase().includes('order by') && 
        !sql.toLowerCase().includes('count(') &&
        sql.toLowerCase().includes('limit')) {
      const tables = this.extractTableNames(sql);
      if (tables.length === 1 && schema.tables[tables[0]]) {
        const primaryKey = schema.tables[tables[0]].primaryKeys?.[0];
        if (primaryKey) {
          improvedSql = improvedSql.replace(/\s+limit/i, ` ORDER BY ${primaryKey} LIMIT`);
          improvements.push('Added ORDER BY for consistent result ordering');
        }
      }
    }

    return {
      improvedSql,
      improvements
    };
  }

  /**
   * Track query execution performance
   */
  async trackQueryPerformance(sql: string, executionTime: number, resultCount: number): Promise<void> {
    try {
      const performanceData = {
        sql: sql.substring(0, 200), // Truncate for logging
        executionTime,
        resultCount,
        timestamp: new Date(),
        complexity: this.assessComplexity(sql)
      };

      logger.info('Query performance tracked', performanceData);

      // Log slow queries
      if (executionTime > 5000) { // 5 seconds
        logger.warn('Slow query detected', {
          ...performanceData,
          fullSql: sql
        });
      }

    } catch (error) {
      logger.error('Failed to track query performance:', error);
    }
  }

  /**
   * Perform detailed query analysis
   */
  private performQueryAnalysis(sql: string, schema: SchemaInfo): QueryAnalysis {
    const lowerSql = sql.toLowerCase();
    const tablesInvolved = this.extractTableNames(sql);
    
    // Assess complexity
    let complexity: 'simple' | 'medium' | 'complex' = 'simple';
    if (lowerSql.includes('join') || tablesInvolved.length > 1) {
      complexity = 'medium';
    }
    if (lowerSql.includes('subquery') || lowerSql.includes('exists') || 
        lowerSql.includes('window') || lowerSql.includes('cte')) {
      complexity = 'complex';
    }

    // Estimate rows
    let estimatedRows = 0;
    tablesInvolved.forEach(table => {
      if (schema.tables[table]) {
        estimatedRows += schema.tables[table].rowCount || 1000; // Default estimate
      }
    });

    // Check for various operations
    const hasJoins = lowerSql.includes('join');
    const hasAggregation = /count\(|sum\(|avg\(|min\(|max\(|group by/i.test(sql);
    const hasSubqueries = lowerSql.includes('select') && 
                         (lowerSql.match(/select/g) || []).length > 1;

    // Identify potentially slow operations
    const potentiallySlowOperations: string[] = [];
    if (lowerSql.includes("like '%")) {
      potentiallySlowOperations.push('Leading wildcard LIKE pattern');
    }
    if (lowerSql.includes('select *') && !lowerSql.includes('limit')) {
      potentiallySlowOperations.push('SELECT * without LIMIT');
    }
    if (tablesInvolved.length > 1 && !hasJoins) {
      potentiallySlowOperations.push('Potential Cartesian product');
    }

    // Analyze index usage
    const indexUsage = this.analyzeIndexUsage(sql, schema);

    return {
      complexity,
      estimatedRows,
      tablesInvolved,
      hasJoins,
      hasAggregation,
      hasSubqueries,
      potentiallySlowOperations,
      indexUsage
    };
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    sql: string, 
    schema: SchemaInfo, 
    analysis: QueryAnalysis
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const lowerSql = sql.toLowerCase();

    // Suggest adding LIMIT for large datasets
    if (!lowerSql.includes('limit') && !lowerSql.includes('count(') && analysis.estimatedRows > 1000) {
      suggestions.push({
        type: 'performance',
        severity: 'high',
        title: 'Add LIMIT clause',
        description: 'Query may return a large number of rows without a LIMIT clause',
        originalSql: sql,
        suggestedSql: sql.replace(/;?\s*$/, ' LIMIT 100;'),
        impact: 'Significantly reduces data transfer and improves response time',
        reasoning: `Estimated ${analysis.estimatedRows} rows without LIMIT`
      });
    }

    // Suggest specific columns instead of SELECT *
    if (lowerSql.includes('select *')) {
      suggestions.push({
        type: 'performance',
        severity: 'medium',
        title: 'Use specific column selection',
        description: 'SELECT * retrieves all columns, which may include unnecessary data',
        originalSql: sql,
        impact: 'Reduces data transfer and improves query performance',
        reasoning: 'Selecting only needed columns is more efficient'
      });
    }

    // Suggest indexes for WHERE clause columns
    analysis.indexUsage.forEach(usage => {
      if (!usage.hasIndex) {
        suggestions.push({
          type: 'performance',
          severity: 'medium',
          title: `Add index on ${usage.table}.${usage.column}`,
          description: `Column ${usage.column} is used in WHERE clause but has no index`,
          originalSql: sql,
          impact: 'Significantly improves query performance for filtered results',
          reasoning: 'Indexes on WHERE clause columns enable faster data retrieval'
        });
      }
    });

    // Suggest JOIN syntax for multiple tables
    if (analysis.tablesInvolved.length > 1 && !analysis.hasJoins) {
      suggestions.push({
        type: 'best_practice',
        severity: 'high',
        title: 'Use explicit JOIN syntax',
        description: 'Multiple tables without explicit JOINs may create Cartesian products',
        originalSql: sql,
        impact: 'Prevents accidental Cartesian products and improves readability',
        reasoning: 'Explicit JOINs make relationships clear and prevent errors'
      });
    }

    // Suggest ORDER BY for consistent results
    if (lowerSql.includes('limit') && !lowerSql.includes('order by')) {
      suggestions.push({
        type: 'best_practice',
        severity: 'low',
        title: 'Add ORDER BY for consistent results',
        description: 'LIMIT without ORDER BY may return different results on each execution',
        originalSql: sql,
        impact: 'Ensures consistent and predictable query results',
        reasoning: 'Database engines may return rows in different orders without explicit sorting'
      });
    }

    return suggestions;
  }

  /**
   * Generate performance warnings
   */
  private generatePerformanceWarnings(
    sql: string, 
    schema: SchemaInfo, 
    analysis: QueryAnalysis
  ): PerformanceWarning[] {
    const warnings: PerformanceWarning[] = [];
    const lowerSql = sql.toLowerCase();

    // Large dataset warning
    if (analysis.estimatedRows > 10000 && !lowerSql.includes('limit')) {
      warnings.push({
        type: 'large_dataset',
        message: `Query may return ${analysis.estimatedRows.toLocaleString()} rows`,
        severity: 'high',
        suggestion: 'Add LIMIT clause or more specific WHERE conditions'
      });
    }

    // Missing index warning
    const unindexedColumns = analysis.indexUsage.filter(usage => !usage.hasIndex);
    if (unindexedColumns.length > 0) {
      warnings.push({
        type: 'missing_index',
        message: `${unindexedColumns.length} columns in WHERE clause lack indexes`,
        severity: 'medium',
        suggestion: 'Consider adding indexes on frequently queried columns'
      });
    }

    // Cartesian product warning
    if (analysis.tablesInvolved.length > 1 && !analysis.hasJoins) {
      warnings.push({
        type: 'cartesian_product',
        message: 'Multiple tables without JOIN conditions detected',
        severity: 'high',
        suggestion: 'Add explicit JOIN conditions to prevent Cartesian products'
      });
    }

    // Inefficient LIKE warning
    if (lowerSql.includes("like '%")) {
      warnings.push({
        type: 'inefficient_like',
        message: 'LIKE patterns starting with % cannot use indexes effectively',
        severity: 'medium',
        suggestion: 'Consider full-text search or restructuring the query'
      });
    }

    // No LIMIT warning
    if (!lowerSql.includes('limit') && !lowerSql.includes('count(') && 
        analysis.tablesInvolved.some(table => (schema.tables[table]?.rowCount || 0) > 1000)) {
      warnings.push({
        type: 'no_limit',
        message: 'Query on large tables without LIMIT clause',
        severity: 'medium',
        suggestion: 'Add LIMIT clause to control result set size'
      });
    }

    return warnings;
  }

  /**
   * Estimate query execution time
   */
  private estimateExecutionTime(analysis: QueryAnalysis, schema: SchemaInfo): number {
    let baseTime = 10; // Base 10ms

    // Add time based on complexity
    switch (analysis.complexity) {
      case 'simple':
        baseTime += 50;
        break;
      case 'medium':
        baseTime += 200;
        break;
      case 'complex':
        baseTime += 1000;
        break;
    }

    // Add time based on estimated rows
    if (analysis.estimatedRows > 10000) {
      baseTime += 500;
    } else if (analysis.estimatedRows > 1000) {
      baseTime += 100;
    }

    // Add time for JOINs
    if (analysis.hasJoins) {
      baseTime += analysis.tablesInvolved.length * 100;
    }

    // Add time for aggregations
    if (analysis.hasAggregation) {
      baseTime += 200;
    }

    // Add time for subqueries
    if (analysis.hasSubqueries) {
      baseTime += 300;
    }

    // Reduce time if good indexes are available
    const indexedColumns = analysis.indexUsage.filter(usage => usage.hasIndex);
    if (indexedColumns.length > 0) {
      baseTime *= 0.7; // 30% improvement with indexes
    }

    return Math.round(baseTime);
  }

  /**
   * Analyze index usage in the query
   */
  private analyzeIndexUsage(sql: string, schema: SchemaInfo): {
    table: string;
    column: string;
    hasIndex: boolean;
  }[] {
    const usage: { table: string; column: string; hasIndex: boolean }[] = [];
    const whereColumns = this.extractWhereColumns(sql);

    whereColumns.forEach(column => {
      const table = this.findTableForColumn(column, schema);
      if (table) {
        const hasIndex = this.hasIndexOnColumn(table, column, schema);
        usage.push({ table, column, hasIndex });
      }
    });

    return usage;
  }

  /**
   * Extract table names from SQL
   */
  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    const lowerSql = sql.toLowerCase();

    // Extract FROM clause tables
    const fromMatches = lowerSql.match(/from\s+(\w+)/g);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const table = match.replace('from ', '').trim();
        tables.push(table);
      });
    }

    // Extract JOIN clause tables
    const joinMatches = lowerSql.match(/join\s+(\w+)/g);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const table = match.replace('join ', '').trim();
        tables.push(table);
      });
    }

    return [...new Set(tables)]; // Remove duplicates
  }

  /**
   * Extract columns used in WHERE clause
   */
  private extractWhereColumns(sql: string): string[] {
    const columns: string[] = [];
    const whereMatch = sql.match(/where\s+(.*?)(?:\s+group\s+by|\s+order\s+by|\s+limit|$)/is);
    
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g);
      if (columnMatches) {
        columnMatches.forEach(match => {
          const column = match.replace(/\s*[=<>!].*/, '').trim();
          columns.push(column);
        });
      }
    }

    return columns;
  }

  /**
   * Find which table a column belongs to
   */
  private findTableForColumn(column: string, schema: SchemaInfo): string | null {
    for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
      const hasColumn = tableInfo.columns.some(col => 
        col.column_name.toLowerCase() === column.toLowerCase()
      );
      if (hasColumn) {
        return tableName;
      }
    }
    return null;
  }

  /**
   * Check if a table has an index on a specific column
   */
  private hasIndexOnColumn(table: string, column: string, schema: SchemaInfo): boolean {
    const tableInfo = schema.tables[table];
    if (!tableInfo || !tableInfo.indexes) {
      return false;
    }

    return tableInfo.indexes.some(index => 
      index.columns.some(indexCol => 
        indexCol.toLowerCase() === column.toLowerCase()
      )
    );
  }

  /**
   * Assess query complexity
   */
  private assessComplexity(sql: string): 'simple' | 'medium' | 'complex' {
    const lowerSql = sql.toLowerCase();
    
    if (lowerSql.includes('subquery') || lowerSql.includes('exists') || 
        lowerSql.includes('window') || lowerSql.includes('cte')) {
      return 'complex';
    }
    
    if (lowerSql.includes('join') || lowerSql.includes('group by') || 
        lowerSql.includes('having')) {
      return 'medium';
    }
    
    return 'simple';
  }
}

// Export singleton instance
export const queryOptimizer = new QueryOptimizer();