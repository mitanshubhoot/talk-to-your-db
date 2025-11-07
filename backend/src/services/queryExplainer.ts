import { SchemaInfo } from './database';

export interface QueryExplanation {
  summary: string;
  breakdown: QueryBreakdown;
  businessContext: string;
  suggestions: string[];
  complexity: 'simple' | 'medium' | 'complex';
  estimatedPerformance: PerformanceEstimate;
}

export interface QueryBreakdown {
  operation: string;
  tables: TableUsage[];
  columns: ColumnUsage[];
  joins: JoinExplanation[];
  filters: FilterExplanation[];
  aggregations: AggregationExplanation[];
  sorting: SortingExplanation[];
  limitations: LimitationExplanation[];
}

export interface TableUsage {
  name: string;
  alias?: string;
  purpose: string;
  rowCount?: number;
}

export interface ColumnUsage {
  name: string;
  table: string;
  purpose: 'selection' | 'filtering' | 'joining' | 'grouping' | 'sorting' | 'aggregation';
  dataType: string;
}

export interface JoinExplanation {
  type: string;
  leftTable: string;
  rightTable: string;
  condition: string;
  purpose: string;
}

export interface FilterExplanation {
  column: string;
  operator: string;
  value: string;
  purpose: string;
}

export interface AggregationExplanation {
  function: string;
  column: string;
  purpose: string;
  groupBy?: string[];
}

export interface SortingExplanation {
  column: string;
  direction: string;
  purpose: string;
}

export interface LimitationExplanation {
  type: 'limit' | 'offset';
  value: number;
  purpose: string;
}

export interface PerformanceEstimate {
  level: 'fast' | 'moderate' | 'slow' | 'very_slow';
  factors: string[];
  recommendations: string[];
  estimatedRows?: number;
}

export class QueryExplainer {
  /**
   * Generate comprehensive explanation for a SQL query
   */
  explainQuery(sql: string, userQuery: string, schema: SchemaInfo): QueryExplanation {
    const breakdown = this.analyzeQuery(sql, schema);
    const summary = this.generateSummary(breakdown, userQuery);
    const businessContext = this.generateBusinessContext(breakdown, userQuery);
    const suggestions = this.generateSuggestions(breakdown, schema);
    const complexity = this.assessComplexity(breakdown);
    const estimatedPerformance = this.estimatePerformance(breakdown, schema);

    return {
      summary,
      breakdown,
      businessContext,
      suggestions,
      complexity,
      estimatedPerformance
    };
  }

  /**
   * Analyze SQL query structure
   */
  private analyzeQuery(sql: string, schema: SchemaInfo): QueryBreakdown {
    const cleanSql = sql.toLowerCase().trim();
    
    return {
      operation: this.extractOperation(cleanSql),
      tables: this.extractTableUsage(cleanSql, schema),
      columns: this.extractColumnUsage(cleanSql, schema),
      joins: this.extractJoins(cleanSql, schema),
      filters: this.extractFilters(cleanSql, schema),
      aggregations: this.extractAggregations(cleanSql, schema),
      sorting: this.extractSorting(cleanSql, schema),
      limitations: this.extractLimitations(cleanSql)
    };
  }

  /**
   * Extract main operation type
   */
  private extractOperation(sql: string): string {
    if (sql.startsWith('select')) return 'SELECT';
    if (sql.startsWith('insert')) return 'INSERT';
    if (sql.startsWith('update')) return 'UPDATE';
    if (sql.startsWith('delete')) return 'DELETE';
    if (sql.startsWith('with')) return 'CTE (Common Table Expression)';
    return 'UNKNOWN';
  }

  /**
   * Extract table usage information
   */
  private extractTableUsage(sql: string, schema: SchemaInfo): TableUsage[] {
    const tables: TableUsage[] = [];
    
    // Extract FROM clause tables
    const fromMatches = sql.match(/from\s+(\w+)(?:\s+(?:as\s+)?(\w+))?/g);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const parts = match.match(/from\s+(\w+)(?:\s+(?:as\s+)?(\w+))?/);
        if (parts) {
          const tableName = parts[1];
          const alias = parts[2];
          const tableInfo = schema.tables[tableName];
          
          tables.push({
            name: tableName,
            alias,
            purpose: 'Primary data source',
            rowCount: tableInfo?.rowCount
          });
        }
      });
    }

    // Extract JOIN clause tables
    const joinMatches = sql.match(/(?:inner\s+|left\s+|right\s+|full\s+)?join\s+(\w+)(?:\s+(?:as\s+)?(\w+))?/g);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const parts = match.match(/(?:inner\s+|left\s+|right\s+|full\s+)?join\s+(\w+)(?:\s+(?:as\s+)?(\w+))?/);
        if (parts) {
          const tableName = parts[1];
          const alias = parts[2];
          const tableInfo = schema.tables[tableName];
          
          tables.push({
            name: tableName,
            alias,
            purpose: 'Related data via JOIN',
            rowCount: tableInfo?.rowCount
          });
        }
      });
    }

    return tables;
  }

  /**
   * Extract column usage information
   */
  private extractColumnUsage(sql: string, schema: SchemaInfo): ColumnUsage[] {
    const columns: ColumnUsage[] = [];
    
    // Extract SELECT columns
    const selectMatch = sql.match(/select\s+(.*?)\s+from/s);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      const columnParts = selectClause.split(',').map(part => part.trim());
      
      columnParts.forEach(part => {
        if (part === '*') {
          // Handle SELECT *
          columns.push({
            name: '*',
            table: 'all',
            purpose: 'selection',
            dataType: 'mixed'
          });
        } else {
          const columnInfo = this.parseColumnExpression(part, schema);
          if (columnInfo) {
            columns.push({
              ...columnInfo,
              purpose: 'selection'
            });
          }
        }
      });
    }

    return columns;
  }

  /**
   * Extract JOIN information
   */
  private extractJoins(sql: string, schema: SchemaInfo): JoinExplanation[] {
    const joins: JoinExplanation[] = [];
    
    const joinPattern = /((?:inner\s+|left\s+|right\s+|full\s+)?join)\s+(\w+)(?:\s+(?:as\s+)?(\w+))?\s+on\s+(.*?)(?=\s+(?:inner\s+|left\s+|right\s+|full\s+)?join|\s+where|\s+group\s+by|\s+order\s+by|\s+limit|$)/gi;
    
    let match;
    while ((match = joinPattern.exec(sql)) !== null) {
      const joinType = match[1].trim().toUpperCase() || 'INNER JOIN';
      const rightTable = match[2];
      const alias = match[3];
      const condition = match[4].trim();
      
      // Find left table from previous context
      const leftTable = this.findLeftTableForJoin(sql, match.index);
      
      joins.push({
        type: joinType,
        leftTable: leftTable || 'unknown',
        rightTable,
        condition,
        purpose: this.explainJoinPurpose(leftTable || '', rightTable, condition, schema)
      });
    }

    return joins;
  }

  /**
   * Extract filter information
   */
  private extractFilters(sql: string, schema: SchemaInfo): FilterExplanation[] {
    const filters: FilterExplanation[] = [];
    
    const whereMatch = sql.match(/where\s+(.*?)(?:\s+group\s+by|\s+order\s+by|\s+limit|$)/s);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      
      // Simple filter extraction - in production, use proper SQL parsing
      const filterPatterns = [
        /(\w+(?:\.\w+)?)\s*(=|!=|<>|>|<|>=|<=)\s*([^'\s]+|'[^']*')/g,
        /(\w+(?:\.\w+)?)\s+(?:i?like)\s+([^'\s]+|'[^']*')/gi,
        /(\w+(?:\.\w+)?)\s+in\s*\([^)]+\)/gi,
        /(\w+(?:\.\w+)?)\s+between\s+([^'\s]+|'[^']*')\s+and\s+([^'\s]+|'[^']*')/gi
      ];

      filterPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(whereClause)) !== null) {
          const column = match[1];
          const operator = match[2] || (pattern.source.includes('like') ? 'LIKE' : 
                                       pattern.source.includes('in') ? 'IN' : 
                                       pattern.source.includes('between') ? 'BETWEEN' : '=');
          const value = match[3] || match[0].split(/\s+/).slice(2).join(' ');
          
          filters.push({
            column,
            operator,
            value,
            purpose: this.explainFilterPurpose(column, operator, value, schema)
          });
        }
      });
    }

    return filters;
  }

  /**
   * Extract aggregation information
   */
  private extractAggregations(sql: string, schema: SchemaInfo): AggregationExplanation[] {
    const aggregations: AggregationExplanation[] = [];
    
    const aggPattern = /(count|sum|avg|min|max|group_concat)\s*\(\s*([^)]+)\s*\)/gi;
    let match;
    
    while ((match = aggPattern.exec(sql)) !== null) {
      const func = match[1].toUpperCase();
      const column = match[2].trim();
      
      // Extract GROUP BY columns
      const groupByMatch = sql.match(/group\s+by\s+(.*?)(?:\s+having|\s+order\s+by|\s+limit|$)/i);
      const groupBy = groupByMatch ? 
        groupByMatch[1].split(',').map(col => col.trim()) : undefined;
      
      aggregations.push({
        function: func,
        column,
        purpose: this.explainAggregationPurpose(func, column, groupBy, schema),
        groupBy
      });
    }

    return aggregations;
  }

  /**
   * Extract sorting information
   */
  private extractSorting(sql: string, schema: SchemaInfo): SortingExplanation[] {
    const sorting: SortingExplanation[] = [];
    
    const orderByMatch = sql.match(/order\s+by\s+(.*?)(?:\s+limit|$)/i);
    if (orderByMatch) {
      const orderClause = orderByMatch[1];
      const orderParts = orderClause.split(',').map(part => part.trim());
      
      orderParts.forEach(part => {
        const orderMatch = part.match(/(\w+(?:\.\w+)?)\s*(asc|desc)?/i);
        if (orderMatch) {
          const column = orderMatch[1];
          const direction = (orderMatch[2] || 'ASC').toUpperCase();
          
          sorting.push({
            column,
            direction,
            purpose: this.explainSortingPurpose(column, direction, schema)
          });
        }
      });
    }

    return sorting;
  }

  /**
   * Extract limitation information
   */
  private extractLimitations(sql: string): LimitationExplanation[] {
    const limitations: LimitationExplanation[] = [];
    
    const limitMatch = sql.match(/limit\s+(\d+)/i);
    if (limitMatch) {
      limitations.push({
        type: 'limit',
        value: parseInt(limitMatch[1]),
        purpose: 'Restricts the number of rows returned to prevent large result sets'
      });
    }

    const offsetMatch = sql.match(/offset\s+(\d+)/i);
    if (offsetMatch) {
      limitations.push({
        type: 'offset',
        value: parseInt(offsetMatch[1]),
        purpose: 'Skips the specified number of rows for pagination'
      });
    }

    return limitations;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(breakdown: QueryBreakdown, userQuery: string): string {
    const { operation, tables, joins, aggregations, filters, sorting, limitations } = breakdown;
    
    let summary = `This query ${operation.toLowerCase()}s data`;
    
    // Describe tables
    if (tables.length === 1) {
      summary += ` from the ${tables[0].name} table`;
    } else if (tables.length > 1) {
      const tableNames = tables.map(t => t.name).join(', ');
      summary += ` by combining information from ${tableNames}`;
    }

    // Describe joins
    if (joins.length > 0) {
      summary += `. It connects related tables using ${joins.length} join${joins.length > 1 ? 's' : ''}`;
    }

    // Describe filters
    if (filters.length > 0) {
      summary += `, applies ${filters.length} filter${filters.length > 1 ? 's' : ''} to narrow down the results`;
    }

    // Describe aggregations
    if (aggregations.length > 0) {
      const aggFunctions = aggregations.map(a => a.function.toLowerCase()).join(', ');
      summary += `, and performs ${aggFunctions} calculations`;
    }

    // Describe sorting
    if (sorting.length > 0) {
      summary += `, then sorts the results`;
    }

    // Describe limitations
    if (limitations.length > 0) {
      const limit = limitations.find(l => l.type === 'limit');
      if (limit) {
        summary += `, limiting the output to ${limit.value} rows`;
      }
    }

    summary += ` to answer: "${userQuery}"`;

    return summary;
  }

  /**
   * Generate business context explanation
   */
  private generateBusinessContext(breakdown: QueryBreakdown, userQuery: string): string {
    const { tables, aggregations, filters } = breakdown;
    
    let context = "Business Context:\n";
    
    // Identify business domain
    const businessDomain = this.identifyBusinessDomain(tables);
    context += `• This query analyzes ${businessDomain} data\n`;
    
    // Explain business value
    if (aggregations.length > 0) {
      context += `• Provides quantitative insights through ${aggregations.map(a => a.function.toLowerCase()).join(', ')} calculations\n`;
    }
    
    if (filters.length > 0) {
      context += `• Focuses on specific business criteria to provide targeted insights\n`;
    }
    
    // Suggest use cases
    const useCases = this.suggestUseCases(breakdown, userQuery);
    if (useCases.length > 0) {
      context += `• Useful for: ${useCases.join(', ')}\n`;
    }

    return context;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(breakdown: QueryBreakdown, schema: SchemaInfo): string[] {
    const suggestions: string[] = [];
    
    // Performance suggestions
    if (breakdown.tables.some(t => (t.rowCount || 0) > 10000) && breakdown.limitations.length === 0) {
      suggestions.push('Consider adding a LIMIT clause to improve performance on large tables');
    }
    
    // Index suggestions
    breakdown.filters.forEach(filter => {
      const table = this.findTableForColumn(filter.column, schema);
      if (table && schema.tables[table]) {
        const hasIndex = schema.tables[table].indexes?.some(idx => 
          idx.columns.includes(filter.column.split('.').pop() || filter.column)
        );
        if (!hasIndex) {
          suggestions.push(`Consider adding an index on ${filter.column} for better filter performance`);
        }
      }
    });
    
    // Query structure suggestions
    if (breakdown.columns.some(c => c.name === '*')) {
      suggestions.push('Consider selecting specific columns instead of * for better performance and clarity');
    }
    
    if (breakdown.joins.length > 0 && breakdown.filters.length === 0) {
      suggestions.push('Consider adding WHERE conditions to filter the joined data');
    }

    return suggestions;
  }

  /**
   * Assess query complexity
   */
  private assessComplexity(breakdown: QueryBreakdown): 'simple' | 'medium' | 'complex' {
    let score = 0;
    
    score += breakdown.tables.length;
    score += breakdown.joins.length * 2;
    score += breakdown.aggregations.length * 2;
    score += breakdown.filters.length;
    
    if (breakdown.operation.includes('CTE')) score += 3;
    
    if (score <= 3) return 'simple';
    if (score <= 8) return 'medium';
    return 'complex';
  }

  /**
   * Estimate query performance
   */
  private estimatePerformance(breakdown: QueryBreakdown, schema: SchemaInfo): PerformanceEstimate {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let estimatedRows = 0;
    
    // Calculate estimated rows
    breakdown.tables.forEach(table => {
      estimatedRows += table.rowCount || 1000;
    });
    
    // Analyze performance factors
    if (breakdown.tables.some(t => (t.rowCount || 0) > 100000)) {
      factors.push('Large table(s) involved');
    }
    
    if (breakdown.joins.length > 2) {
      factors.push('Multiple table joins');
    }
    
    if (breakdown.columns.some(c => c.name === '*')) {
      factors.push('SELECT * may retrieve unnecessary data');
      recommendations.push('Select only needed columns');
    }
    
    if (breakdown.limitations.length === 0 && estimatedRows > 1000) {
      factors.push('No LIMIT clause on potentially large result set');
      recommendations.push('Add LIMIT clause to control result size');
    }
    
    // Determine performance level
    let level: 'fast' | 'moderate' | 'slow' | 'very_slow' = 'fast';
    
    if (estimatedRows > 1000000 || breakdown.joins.length > 3) {
      level = 'very_slow';
    } else if (estimatedRows > 100000 || breakdown.joins.length > 1) {
      level = 'slow';
    } else if (estimatedRows > 10000 || breakdown.joins.length > 0) {
      level = 'moderate';
    }

    return {
      level,
      factors,
      recommendations,
      estimatedRows
    };
  }

  // Helper methods
  private parseColumnExpression(expression: string, schema: SchemaInfo): ColumnUsage | null {
    // Simple column parsing - in production, use proper SQL parsing
    const cleanExpr = expression.replace(/\s+as\s+\w+$/i, '').trim();
    
    if (cleanExpr.includes('.')) {
      const [table, column] = cleanExpr.split('.');
      return {
        name: column,
        table,
        purpose: 'selection',
        dataType: this.getColumnDataType(table, column, schema)
      };
    } else {
      return {
        name: cleanExpr,
        table: 'unknown',
        purpose: 'selection',
        dataType: 'unknown'
      };
    }
  }

  private getColumnDataType(tableName: string, columnName: string, schema: SchemaInfo): string {
    const table = schema.tables[tableName];
    if (table) {
      const column = table.columns.find(col => col.column_name === columnName);
      return column?.data_type || 'unknown';
    }
    return 'unknown';
  }

  private findLeftTableForJoin(sql: string, joinIndex: number): string | null {
    const beforeJoin = sql.substring(0, joinIndex);
    const fromMatch = beforeJoin.match(/from\s+(\w+)/);
    return fromMatch ? fromMatch[1] : null;
  }

  private explainJoinPurpose(leftTable: string, rightTable: string, condition: string, schema: SchemaInfo): string {
    return `Connects ${leftTable} with ${rightTable} to combine related information`;
  }

  private explainFilterPurpose(column: string, operator: string, value: string, schema: SchemaInfo): string {
    const operatorExplanations: Record<string, string> = {
      '=': 'finds exact matches',
      '!=': 'excludes exact matches',
      '>': 'finds values greater than',
      '<': 'finds values less than',
      '>=': 'finds values greater than or equal to',
      '<=': 'finds values less than or equal to',
      'LIKE': 'finds text patterns',
      'IN': 'finds values in a list',
      'BETWEEN': 'finds values in a range'
    };
    
    return `Filters ${column} to ${operatorExplanations[operator] || 'match criteria'} ${value}`;
  }

  private explainAggregationPurpose(func: string, column: string, groupBy: string[] | undefined, schema: SchemaInfo): string {
    const functionExplanations: Record<string, string> = {
      'COUNT': 'counts the number of',
      'SUM': 'calculates the total of',
      'AVG': 'calculates the average of',
      'MIN': 'finds the minimum value of',
      'MAX': 'finds the maximum value of'
    };
    
    let purpose = `${functionExplanations[func] || 'processes'} ${column}`;
    
    if (groupBy && groupBy.length > 0) {
      purpose += ` grouped by ${groupBy.join(', ')}`;
    }
    
    return purpose;
  }

  private explainSortingPurpose(column: string, direction: string, schema: SchemaInfo): string {
    const directionText = direction === 'DESC' ? 'highest to lowest' : 'lowest to highest';
    return `Orders results by ${column} from ${directionText}`;
  }

  private identifyBusinessDomain(tables: TableUsage[]): string {
    const tableNames = tables.map(t => t.name.toLowerCase());
    
    if (tableNames.some(name => ['customer', 'order', 'product'].some(domain => name.includes(domain)))) {
      return 'e-commerce/sales';
    }
    if (tableNames.some(name => ['user', 'account', 'profile'].some(domain => name.includes(domain)))) {
      return 'user management';
    }
    if (tableNames.some(name => ['employee', 'department', 'payroll'].some(domain => name.includes(domain)))) {
      return 'human resources';
    }
    
    return 'business';
  }

  private suggestUseCases(breakdown: QueryBreakdown, userQuery: string): string[] {
    const useCases: string[] = [];
    
    if (breakdown.aggregations.length > 0) {
      useCases.push('reporting and analytics');
      useCases.push('KPI monitoring');
    }
    
    if (breakdown.joins.length > 0) {
      useCases.push('comprehensive data analysis');
    }
    
    if (breakdown.filters.length > 0) {
      useCases.push('targeted business insights');
    }
    
    if (breakdown.sorting.length > 0) {
      useCases.push('ranking and prioritization');
    }
    
    return useCases;
  }

  private findTableForColumn(column: string, schema: SchemaInfo): string | null {
    const columnName = column.includes('.') ? column.split('.')[1] : column;
    
    for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
      const hasColumn = tableInfo.columns.some(col => 
        col.column_name.toLowerCase() === columnName.toLowerCase()
      );
      if (hasColumn) {
        return tableName;
      }
    }
    return null;
  }
}

// Export singleton instance
export const queryExplainer = new QueryExplainer();