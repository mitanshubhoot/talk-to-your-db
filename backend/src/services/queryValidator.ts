import { SchemaInfo } from './database';

export interface ValidationResult {
  isValid: boolean;
  syntaxErrors: string[];
  semanticErrors: string[];
  warnings: string[];
  suggestions: string[];
  confidence: number;
  safetyChecks: SafetyCheckResult;
}

export interface SafetyCheckResult {
  isDestructive: boolean;
  hasUnlimitedSelect: boolean;
  unsafeOperations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ConfidenceFactors {
  syntaxCorrectness: number;
  schemaAlignment: number;
  queryComplexity: number;
  tableExistence: number;
  columnExistence: number;
  relationshipUsage: number;
  overall: number;
}

export class QueryValidator {
  /**
   * Comprehensive SQL query validation
   */
  async validateSQL(sql: string, schema: SchemaInfo): Promise<ValidationResult> {
    const syntaxErrors = this.validateSyntax(sql);
    const semanticErrors = this.validateSemantics(sql, schema);
    const warnings = this.generateWarnings(sql, schema);
    const suggestions = this.generateSuggestions(sql, schema);
    const safetyChecks = this.performSafetyChecks(sql);
    const confidence = this.calculateConfidence(sql, schema, syntaxErrors, semanticErrors);

    return {
      isValid: syntaxErrors.length === 0 && semanticErrors.length === 0,
      syntaxErrors,
      semanticErrors,
      warnings,
      suggestions,
      confidence,
      safetyChecks
    };
  }

  /**
   * Basic SQL syntax validation
   */
  private validateSyntax(sql: string): string[] {
    const errors: string[] = [];
    const cleanSql = sql.trim().toLowerCase();

    // Check if SQL is empty
    if (!cleanSql) {
      errors.push('SQL query is empty');
      return errors;
    }

    // Check for basic SQL structure
    if (!cleanSql.startsWith('select') && !cleanSql.startsWith('with')) {
      errors.push('Query must start with SELECT or WITH clause');
    }

    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`);
    }

    // Check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    const doubleQuotes = (sql.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push('Unbalanced single quotes');
    }
    if (doubleQuotes % 2 !== 0) {
      errors.push('Unbalanced double quotes');
    }

    // Check for common syntax errors
    if (cleanSql.includes('select select')) {
      errors.push('Duplicate SELECT keyword detected');
    }

    if (cleanSql.includes('from from')) {
      errors.push('Duplicate FROM keyword detected');
    }

    // Check for missing FROM clause in SELECT statements
    if (cleanSql.startsWith('select') && !cleanSql.includes('from') && !cleanSql.includes('dual')) {
      errors.push('SELECT statement missing FROM clause');
    }

    // Check for invalid characters in identifiers
    const invalidIdentifierPattern = /[^\w\s\.,\(\)\[\]'"`;=<>!+-/*%]/;
    if (invalidIdentifierPattern.test(sql)) {
      errors.push('Query contains invalid characters');
    }

    // Check for proper semicolon termination
    if (!sql.trim().endsWith(';')) {
      errors.push('Query should end with a semicolon');
    }

    return errors;
  }

  /**
   * Schema-aware semantic validation
   */
  private validateSemantics(sql: string, schema: SchemaInfo): string[] {
    const errors: string[] = [];
    const cleanSql = sql.toLowerCase();

    // Extract table names from the query
    const referencedTables = this.extractTableNames(sql);
    const availableTables = Object.keys(schema.tables);

    // Check if referenced tables exist
    for (const table of referencedTables) {
      if (!availableTables.includes(table)) {
        errors.push(`Table '${table}' does not exist in the schema`);
      }
    }

    // Extract column names and validate against schema
    const referencedColumns = this.extractColumnReferences(sql);
    for (const columnRef of referencedColumns) {
      const { table, column } = columnRef;
      
      if (table && schema.tables[table]) {
        const tableColumns = schema.tables[table].columns.map(col => col.column_name.toLowerCase());
        if (!tableColumns.includes(column.toLowerCase())) {
          errors.push(`Column '${column}' does not exist in table '${table}'`);
        }
      } else if (!table) {
        // Check if column exists in any of the referenced tables
        let columnExists = false;
        for (const refTable of referencedTables) {
          if (schema.tables[refTable]) {
            const tableColumns = schema.tables[refTable].columns.map(col => col.column_name.toLowerCase());
            if (tableColumns.includes(column.toLowerCase())) {
              columnExists = true;
              break;
            }
          }
        }
        if (!columnExists && column !== '*') {
          errors.push(`Column '${column}' does not exist in any referenced table`);
        }
      }
    }

    // Validate JOIN conditions
    if (cleanSql.includes('join')) {
      const joinErrors = this.validateJoins(sql, schema);
      errors.push(...joinErrors);
    }

    // Validate aggregate functions usage
    if (this.hasAggregateFunction(sql) && !cleanSql.includes('group by')) {
      const nonAggregateColumns = this.extractNonAggregateColumns(sql);
      if (nonAggregateColumns.length > 0) {
        errors.push('Non-aggregate columns in SELECT must be included in GROUP BY clause');
      }
    }

    return errors;
  }

  /**
   * Generate warnings for potential issues
   */
  private generateWarnings(sql: string, schema: SchemaInfo): string[] {
    const warnings: string[] = [];
    const cleanSql = sql.toLowerCase();

    // Check for SELECT * without LIMIT
    if (cleanSql.includes('select *') && !cleanSql.includes('limit')) {
      const referencedTables = this.extractTableNames(sql);
      const hasLargeTables = referencedTables.some(table => {
        const tableInfo = schema.tables[table];
        return tableInfo && (tableInfo.rowCount || 0) > 1000;
      });
      
      if (hasLargeTables) {
        warnings.push('SELECT * without LIMIT may return large datasets. Consider adding LIMIT clause.');
      }
    }

    // Check for missing indexes on WHERE conditions
    const whereColumns = this.extractWhereColumns(sql);
    for (const column of whereColumns) {
      const table = this.findTableForColumn(column, schema);
      if (table && schema.tables[table]) {
        const hasIndex = schema.tables[table].indexes?.some(idx => 
          idx.columns.includes(column)
        );
        if (!hasIndex) {
          warnings.push(`Column '${column}' in WHERE clause may benefit from an index`);
        }
      }
    }

    // Check for Cartesian products
    const referencedTables = this.extractTableNames(sql);
    if (referencedTables.length > 1 && !cleanSql.includes('join') && !cleanSql.includes('where')) {
      warnings.push('Multiple tables without JOIN conditions may result in Cartesian product');
    }

    // Check for potential performance issues
    if (cleanSql.includes('like') && cleanSql.includes("'%")) {
      warnings.push('LIKE patterns starting with % may be slow on large datasets');
    }

    return warnings;
  }

  /**
   * Generate suggestions for query improvement
   */
  private generateSuggestions(sql: string, schema: SchemaInfo): string[] {
    const suggestions: string[] = [];
    const cleanSql = sql.toLowerCase();

    // Suggest using specific columns instead of *
    if (cleanSql.includes('select *')) {
      suggestions.push('Consider selecting specific columns instead of * for better performance');
    }

    // Suggest adding LIMIT for large result sets
    if (!cleanSql.includes('limit') && !cleanSql.includes('count(')) {
      suggestions.push('Consider adding LIMIT clause to control result set size');
    }

    // Suggest using indexes
    const referencedTables = this.extractTableNames(sql);
    for (const table of referencedTables) {
      if (schema.tables[table] && (!schema.tables[table].indexes || schema.tables[table].indexes.length === 0)) {
        suggestions.push(`Consider adding indexes to table '${table}' for better performance`);
      }
    }

    // Suggest using JOINs instead of WHERE for table relationships
    if (referencedTables.length > 1 && !cleanSql.includes('join')) {
      const relationships = schema.relationships?.filter(rel => 
        referencedTables.includes(rel.table) && referencedTables.includes(rel.referencedTable)
      );
      if (relationships && relationships.length > 0) {
        suggestions.push('Consider using explicit JOIN syntax for better readability');
      }
    }

    return suggestions;
  }

  /**
   * Perform safety checks for destructive operations
   */
  private performSafetyChecks(sql: string): SafetyCheckResult {
    const cleanSql = sql.toLowerCase();
    const unsafeOperations: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check for destructive operations
    const isDestructive = cleanSql.includes('delete') || 
                         cleanSql.includes('drop') || 
                         cleanSql.includes('truncate') ||
                         cleanSql.includes('update');

    if (isDestructive) {
      unsafeOperations.push('Contains destructive operations (DELETE, DROP, TRUNCATE, UPDATE)');
      riskLevel = 'high';
    }

    // Check for unlimited SELECT
    const hasUnlimitedSelect = cleanSql.includes('select') && 
                              !cleanSql.includes('limit') && 
                              !cleanSql.includes('top');

    if (hasUnlimitedSelect) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    // Check for potentially expensive operations
    if (cleanSql.includes('select *') && cleanSql.includes('join')) {
      unsafeOperations.push('SELECT * with JOINs may be expensive');
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }

    if (cleanSql.includes('like') && cleanSql.includes("'%")) {
      unsafeOperations.push('LIKE patterns starting with % can be slow');
    }

    return {
      isDestructive,
      hasUnlimitedSelect,
      unsafeOperations,
      riskLevel
    };
  }

  /**
   * Calculate comprehensive confidence score
   */
  private calculateConfidence(
    sql: string, 
    schema: SchemaInfo, 
    syntaxErrors: string[], 
    semanticErrors: string[]
  ): number {
    let confidence = 100;

    // Deduct for syntax errors
    confidence -= syntaxErrors.length * 20;

    // Deduct for semantic errors
    confidence -= semanticErrors.length * 15;

    // Check schema alignment
    const referencedTables = this.extractTableNames(sql);
    const validTables = referencedTables.filter(table => schema.tables[table]);
    const schemaAlignment = referencedTables.length > 0 ? 
      (validTables.length / referencedTables.length) * 100 : 50;
    
    confidence = confidence * (schemaAlignment / 100);

    // Bonus for proper query structure
    const cleanSql = sql.toLowerCase();
    if (cleanSql.includes('where')) confidence += 5;
    if (cleanSql.includes('order by')) confidence += 5;
    if (cleanSql.includes('limit')) confidence += 5;
    if (cleanSql.includes('join') && referencedTables.length > 1) confidence += 10;

    // Ensure confidence is within bounds
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Extract table names from SQL query
   */
  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    const cleanSql = sql.toLowerCase();

    // Extract FROM clause tables
    const fromMatches = cleanSql.match(/from\s+(\w+)(?:\s+as\s+\w+)?/g);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const tableMatch = match.match(/from\s+(\w+)/);
        if (tableMatch) {
          tables.push(tableMatch[1]);
        }
      });
    }

    // Extract JOIN clause tables
    const joinMatches = cleanSql.match(/join\s+(\w+)(?:\s+as\s+\w+)?/g);
    if (joinMatches) {
      joinMatches.forEach(match => {
        const tableMatch = match.match(/join\s+(\w+)/);
        if (tableMatch) {
          tables.push(tableMatch[1]);
        }
      });
    }

    return [...new Set(tables)]; // Remove duplicates
  }

  /**
   * Extract column references from SQL query
   */
  private extractColumnReferences(sql: string): Array<{ table?: string; column: string }> {
    const columns: Array<{ table?: string; column: string }> = [];
    
    // Simple extraction - in production, you'd use a proper SQL parser
    const selectMatch = sql.match(/select\s+(.*?)\s+from/is);
    if (selectMatch) {
      const selectClause = selectMatch[1];
      const columnParts = selectClause.split(',').map(part => part.trim());
      
      columnParts.forEach(part => {
        if (part.includes('.')) {
          const [table, column] = part.split('.');
          columns.push({ table: table.trim(), column: column.trim() });
        } else {
          columns.push({ column: part.trim() });
        }
      });
    }

    return columns;
  }

  /**
   * Validate JOIN conditions
   */
  private validateJoins(sql: string, schema: SchemaInfo): string[] {
    const errors: string[] = [];
    // This would be implemented with proper SQL parsing
    // For now, basic validation
    return errors;
  }

  /**
   * Check if query has aggregate functions
   */
  private hasAggregateFunction(sql: string): boolean {
    const aggregateFunctions = ['count', 'sum', 'avg', 'min', 'max', 'group_concat'];
    const cleanSql = sql.toLowerCase();
    return aggregateFunctions.some(func => cleanSql.includes(func + '('));
  }

  /**
   * Extract non-aggregate columns from SELECT clause
   */
  private extractNonAggregateColumns(sql: string): string[] {
    // This would be implemented with proper SQL parsing
    return [];
  }

  /**
   * Extract columns used in WHERE clause
   */
  private extractWhereColumns(sql: string): string[] {
    const columns: string[] = [];
    const whereMatch = sql.match(/where\s+(.*?)(?:\s+group\s+by|\s+order\s+by|\s+limit|$)/is);
    
    if (whereMatch) {
      const whereClause = whereMatch[1];
      // Simple extraction - would use proper parsing in production
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
}

// Export singleton instance
export const queryValidator = new QueryValidator();