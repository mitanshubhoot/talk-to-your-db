import fs from 'fs/promises';
import path from 'path';
import { QueryPerformance, ExplainPlan, OptimizationSuggestion, DatabaseConnection } from '../types/database.js';
import { ConnectionManager } from './connectionManager.js';

export class QueryPerformanceService {
  private performanceFilePath = path.join(process.cwd(), 'data', 'query-performance.json');
  private connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.ensureDataFile();
  }

  private async ensureDataFile() {
    try {
      await fs.access(this.performanceFilePath);
    } catch {
      await fs.writeFile(this.performanceFilePath, JSON.stringify([], null, 2));
    }
  }

  private async loadPerformanceData(): Promise<QueryPerformance[]> {
    try {
      const data = await fs.readFile(this.performanceFilePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async savePerformanceData(data: QueryPerformance[]) {
    await fs.writeFile(this.performanceFilePath, JSON.stringify(data, null, 2));
  }

  async recordQueryPerformance(
    queryId: string,
    sql: string,
    executionTime: number,
    rowsReturned: number,
    connectionId: string
  ): Promise<QueryPerformance> {
    const performance: QueryPerformance = {
      queryId,
      sql,
      executionTime,
      rowsReturned,
      connectionId,
      timestamp: new Date(),
      optimizationSuggestions: await this.generateOptimizationSuggestions(sql, executionTime, connectionId)
    };

    // Add explain plan if supported
    try {
      performance.explainPlan = await this.getExplainPlan(sql, connectionId);
    } catch (error) {
      console.warn(`Failed to get explain plan: ${error}`);
    }

    // Save to file
    const allPerformance = await this.loadPerformanceData();
    allPerformance.push(performance);
    
    // Keep only last 1000 records to prevent file from growing too large
    if (allPerformance.length > 1000) {
      allPerformance.splice(0, allPerformance.length - 1000);
    }
    
    await this.savePerformanceData(allPerformance);
    return performance;
  }

  async getExplainPlan(sql: string, connectionId: string): Promise<ExplainPlan> {
    const connectionPool = await this.connectionManager.getConnection(connectionId);
    const { pool, type, connection } = connectionPool;
    const dialect = this.connectionManager.getDatabaseDialect(type);

    if (!dialect.supportsExplain) {
      throw new Error(`Explain plans not supported for ${dialect.name}`);
    }

    const explainSql = `${dialect.explainKeyword} ${sql}`;
    
    try {
      let explainResult: any;
      
      switch (type) {
        case 'postgresql':
          const pgResult = await pool.query(explainSql);
          explainResult = pgResult.rows;
          break;
        
        case 'mysql':
          const [mysqlRows] = await pool.execute(explainSql);
          explainResult = mysqlRows;
          break;
        
        case 'sqlite':
          explainResult = await pool.all(explainSql);
          break;
        
        default:
          throw new Error(`Explain plan not implemented for ${type}`);
      }

      return this.parseExplainPlan(explainResult, type);
    } catch (error) {
      throw new Error(`Failed to execute explain plan: ${error}`);
    }
  }

  private parseExplainPlan(explainResult: any[], dbType: DatabaseConnection['type']): ExplainPlan {
    switch (dbType) {
      case 'postgresql':
        // PostgreSQL EXPLAIN ANALYZE returns detailed execution stats
        const pgPlan = explainResult[0]?.['QUERY PLAN'] || explainResult;
        return {
          plan: explainResult,
          totalCost: this.extractPostgresCost(explainResult),
          estimatedRows: this.extractPostgresRows(explainResult),
          actualTime: this.extractPostgresTime(explainResult),
          planType: 'PostgreSQL Execution Plan'
        };
      
      case 'mysql':
        return {
          plan: explainResult,
          totalCost: this.extractMySQLCost(explainResult),
          estimatedRows: this.extractMySQLRows(explainResult),
          planType: 'MySQL Execution Plan'
        };
      
      case 'sqlite':
        return {
          plan: explainResult,
          totalCost: 0, // SQLite doesn't provide cost estimates
          estimatedRows: this.extractSQLiteRows(explainResult),
          planType: 'SQLite Query Plan'
        };
      
      default:
        throw new Error(`Explain plan parsing not implemented for ${dbType}`);
    }
  }

  private extractPostgresCost(plan: any[]): number {
    const planText = plan.map(row => row['QUERY PLAN'] || row).join(' ');
    const costMatch = planText.match(/cost=[\d.]+\.\.([\d.]+)/);
    return costMatch ? parseFloat(costMatch[1]) : 0;
  }

  private extractPostgresRows(plan: any[]): number {
    const planText = plan.map(row => row['QUERY PLAN'] || row).join(' ');
    const rowsMatch = planText.match(/rows=([\d]+)/);
    return rowsMatch ? parseInt(rowsMatch[1]) : 0;
  }

  private extractPostgresTime(plan: any[]): number {
    const planText = plan.map(row => row['QUERY PLAN'] || row).join(' ');
    const timeMatch = planText.match(/actual time=[\d.]+\.\.([\d.]+)/);
    return timeMatch ? parseFloat(timeMatch[1]) : 0;
  }

  private extractMySQLCost(plan: any[]): number {
    // MySQL doesn't provide direct cost estimates in EXPLAIN
    return 0;
  }

  private extractMySQLRows(plan: any[]): number {
    return plan.reduce((total, row) => total + (row.rows || 0), 0);
  }

  private extractSQLiteRows(plan: any[]): number {
    // SQLite EXPLAIN QUERY PLAN doesn't provide row estimates
    return 0;
  }

  async generateOptimizationSuggestions(
    sql: string,
    executionTime: number,
    connectionId: string
  ): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const normalizedSql = sql.toLowerCase().trim();

    // Performance-based suggestions
    if (executionTime > 5000) { // > 5 seconds
      suggestions.push({
        type: 'performance',
        severity: 'high',
        message: 'Query execution time is very slow (>5s). Consider optimizing.',
        impact: 'High performance impact'
      });
    } else if (executionTime > 1000) { // > 1 second
      suggestions.push({
        type: 'performance',
        severity: 'medium',
        message: 'Query execution time is slow (>1s). Consider optimization.',
        impact: 'Medium performance impact'
      });
    }

    // SQL pattern-based suggestions
    if (normalizedSql.includes('select *')) {
      suggestions.push({
        type: 'rewrite',
        severity: 'medium',
        message: 'Avoid SELECT * - specify only needed columns for better performance.',
        suggestedSql: sql.replace(/select\s+\*/i, 'SELECT column1, column2, ...'),
        impact: 'Reduces data transfer and memory usage'
      });
    }

    if (normalizedSql.includes('where') && normalizedSql.includes('like') && normalizedSql.includes('%')) {
      const likePattern = normalizedSql.match(/like\s+'%[^']*'/);
      if (likePattern && likePattern[0].startsWith("like '%")) {
        suggestions.push({
          type: 'index',
          severity: 'high',
          message: 'Leading wildcard in LIKE clause prevents index usage. Consider full-text search.',
          impact: 'Cannot use indexes, causing full table scans'
        });
      }
    }

    if (normalizedSql.includes('order by') && !normalizedSql.includes('limit')) {
      suggestions.push({
        type: 'performance',
        severity: 'medium',
        message: 'ORDER BY without LIMIT can be expensive on large datasets.',
        suggestedSql: sql + ' LIMIT 100',
        impact: 'Unlimited sorting can consume excessive memory'
      });
    }

    // Join optimization suggestions
    if (normalizedSql.includes('join') && !normalizedSql.includes('where')) {
      suggestions.push({
        type: 'performance',
        severity: 'medium',
        message: 'JOIN without WHERE clause might produce cartesian product.',
        impact: 'Could result in unexpectedly large result sets'
      });
    }

    // Subquery suggestions
    if (normalizedSql.includes('in (select')) {
      suggestions.push({
        type: 'rewrite',
        severity: 'medium',
        message: 'Consider using EXISTS instead of IN with subquery for better performance.',
        impact: 'EXISTS can be more efficient than IN with subqueries'
      });
    }

    // Index suggestions based on WHERE clauses
    const whereMatch = normalizedSql.match(/where\s+(\w+)\s*[=<>]/);
    if (whereMatch) {
      const column = whereMatch[1];
      suggestions.push({
        type: 'index',
        severity: 'low',
        message: `Consider adding an index on column '${column}' to improve WHERE clause performance.`,
        impact: 'Indexes can significantly speed up WHERE clause filtering'
      });
    }

    return suggestions;
  }

  async getPerformanceAnalytics(connectionId?: string): Promise<{
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: QueryPerformance[];
    mostFrequentQueries: { sql: string; count: number; avgTime: number }[];
    performanceTrend: { date: string; avgTime: number; queryCount: number }[];
  }> {
    const allPerformance = await this.loadPerformanceData();
    let filteredPerformance = allPerformance;
    
    if (connectionId) {
      filteredPerformance = allPerformance.filter(p => p.connectionId === connectionId);
    }

    const totalQueries = filteredPerformance.length;
    const averageExecutionTime = totalQueries > 0 
      ? filteredPerformance.reduce((sum, p) => sum + p.executionTime, 0) / totalQueries 
      : 0;

    // Slow queries (top 10 slowest)
    const slowQueries = filteredPerformance
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    // Most frequent queries
    const queryFrequency = new Map<string, { count: number; totalTime: number }>();
    filteredPerformance.forEach(p => {
      const normalizedSql = p.sql.trim().toLowerCase();
      const existing = queryFrequency.get(normalizedSql) || { count: 0, totalTime: 0 };
      queryFrequency.set(normalizedSql, {
        count: existing.count + 1,
        totalTime: existing.totalTime + p.executionTime
      });
    });

    const mostFrequentQueries = Array.from(queryFrequency.entries())
      .map(([sql, stats]) => ({
        sql,
        count: stats.count,
        avgTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Performance trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPerformance = filteredPerformance.filter(
      p => new Date(p.timestamp) >= thirtyDaysAgo
    );

    const dailyStats = new Map<string, { totalTime: number; count: number }>();
    recentPerformance.forEach(p => {
      const date = new Date(p.timestamp).toISOString().split('T')[0];
      const existing = dailyStats.get(date) || { totalTime: 0, count: 0 };
      dailyStats.set(date, {
        totalTime: existing.totalTime + p.executionTime,
        count: existing.count + 1
      });
    });

    const performanceTrend = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        avgTime: stats.totalTime / stats.count,
        queryCount: stats.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      mostFrequentQueries,
      performanceTrend
    };
  }

  async getOptimizationReport(connectionId?: string): Promise<{
    totalSuggestions: number;
    suggestionsByType: { [key: string]: number };
    suggestionsBySeverity: { [key: string]: number };
    topSuggestions: OptimizationSuggestion[];
  }> {
    const allPerformance = await this.loadPerformanceData();
    let filteredPerformance = allPerformance;
    
    if (connectionId) {
      filteredPerformance = allPerformance.filter(p => p.connectionId === connectionId);
    }

    const allSuggestions = filteredPerformance
      .flatMap(p => p.optimizationSuggestions || []);

    const totalSuggestions = allSuggestions.length;

    const suggestionsByType = allSuggestions.reduce((acc, suggestion) => {
      acc[suggestion.type] = (acc[suggestion.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const suggestionsBySeverity = allSuggestions.reduce((acc, suggestion) => {
      acc[suggestion.severity] = (acc[suggestion.severity] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Get unique top suggestions (deduplicate by message)
    const uniqueSuggestions = new Map<string, OptimizationSuggestion>();
    allSuggestions.forEach(suggestion => {
      if (!uniqueSuggestions.has(suggestion.message)) {
        uniqueSuggestions.set(suggestion.message, suggestion);
      }
    });

    const topSuggestions = Array.from(uniqueSuggestions.values())
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 10);

    return {
      totalSuggestions,
      suggestionsByType,
      suggestionsBySeverity,
      topSuggestions
    };
  }
} 