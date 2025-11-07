import { createLogger, format, transports } from 'winston';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/performance.log' })
  ]
});

export interface PerformanceMetrics {
  modelId: string;
  queryType: string;
  accuracy: number;
  latency: number;
  userSatisfaction: number;
  errorRate: number;
  timestamp: Date;
  apiCost?: number;
  provider?: string;
}

export interface QueryExecutionMetrics {
  queryId: string;
  userQuery: string;
  generatedSql: string;
  executionTime: number;
  resultCount: number;
  success: boolean;
  errorMessage?: string;
  confidence: number;
  modelUsed: string;
  timestamp: Date;
}

export interface AlertConfig {
  errorRateThreshold: number;
  latencyThreshold: number;
  confidenceThreshold: number;
  enabled: boolean;
}

export interface PerformanceDashboard {
  totalQueries: number;
  successRate: number;
  averageConfidence: number;
  averageLatency: number;
  modelDistribution: Record<string, number>;
  queryTypeDistribution: Record<string, number>;
  errorsByType: Record<string, number>;
  apiCosts: Record<string, number>;
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Performance monitoring service for SQL generation system
 */
export class PerformanceMonitor {
  private metricsFile = path.join(process.cwd(), 'backend/data/performance-metrics.json');
  private queryMetricsFile = path.join(process.cwd(), 'backend/data/query-metrics.json');
  private alertConfig: AlertConfig = {
    errorRateThreshold: 0.2, // 20% error rate
    latencyThreshold: 5000, // 5 seconds
    confidenceThreshold: 60, // 60% confidence
    enabled: true
  };

  constructor() {
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      const dataDir = path.dirname(this.metricsFile);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  /**
   * Record performance metrics for a model
   */
  async recordPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      const existingMetrics = await this.loadMetrics();
      existingMetrics.push(metrics);

      // Keep only last 10,000 metrics to prevent file from growing too large
      if (existingMetrics.length > 10000) {
        existingMetrics.splice(0, existingMetrics.length - 10000);
      }

      await fs.writeFile(this.metricsFile, JSON.stringify(existingMetrics, null, 2));
      
      logger.info('Performance metrics recorded', {
        modelId: metrics.modelId,
        queryType: metrics.queryType,
        accuracy: metrics.accuracy,
        latency: metrics.latency
      });

      // Check for alerts
      await this.checkAlerts(metrics);

    } catch (error) {
      logger.error('Failed to record performance metrics:', error);
    }
  }

  /**
   * Record query execution metrics
   */
  async recordQueryExecution(metrics: QueryExecutionMetrics): Promise<void> {
    try {
      const existingMetrics = await this.loadQueryMetrics();
      existingMetrics.push(metrics);

      // Keep only last 5,000 query metrics
      if (existingMetrics.length > 5000) {
        existingMetrics.splice(0, existingMetrics.length - 5000);
      }

      await fs.writeFile(this.queryMetricsFile, JSON.stringify(existingMetrics, null, 2));
      
      logger.info('Query execution metrics recorded', {
        queryId: metrics.queryId,
        success: metrics.success,
        executionTime: metrics.executionTime,
        confidence: metrics.confidence
      });

    } catch (error) {
      logger.error('Failed to record query execution metrics:', error);
    }
  }

  /**
   * Get performance dashboard data
   */
  async getPerformanceDashboard(timeRange?: { start: Date; end: Date }): Promise<PerformanceDashboard> {
    try {
      const metrics = await this.loadMetrics();
      const queryMetrics = await this.loadQueryMetrics();

      // Filter by time range if provided
      const filteredMetrics = timeRange 
        ? metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end)
        : metrics.filter(m => m.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Last 7 days

      const filteredQueryMetrics = timeRange
        ? queryMetrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end)
        : queryMetrics.filter(m => m.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

      // Calculate dashboard metrics
      const totalQueries = filteredQueryMetrics.length;
      const successfulQueries = filteredQueryMetrics.filter(m => m.success).length;
      const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;

      const averageConfidence = filteredQueryMetrics.length > 0
        ? filteredQueryMetrics.reduce((sum, m) => sum + m.confidence, 0) / filteredQueryMetrics.length
        : 0;

      const averageLatency = filteredMetrics.length > 0
        ? filteredMetrics.reduce((sum, m) => sum + m.latency, 0) / filteredMetrics.length
        : 0;

      // Model distribution
      const modelDistribution: Record<string, number> = {};
      filteredQueryMetrics.forEach(m => {
        modelDistribution[m.modelUsed] = (modelDistribution[m.modelUsed] || 0) + 1;
      });

      // Query type distribution
      const queryTypeDistribution: Record<string, number> = {};
      filteredMetrics.forEach(m => {
        queryTypeDistribution[m.queryType] = (queryTypeDistribution[m.queryType] || 0) + 1;
      });

      // Errors by type
      const errorsByType: Record<string, number> = {};
      filteredQueryMetrics.filter(m => !m.success).forEach(m => {
        const errorType = this.categorizeError(m.errorMessage || 'Unknown error');
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });

      // API costs by provider
      const apiCosts: Record<string, number> = {};
      filteredMetrics.forEach(m => {
        if (m.provider && m.apiCost) {
          apiCosts[m.provider] = (apiCosts[m.provider] || 0) + m.apiCost;
        }
      });

      return {
        totalQueries,
        successRate,
        averageConfidence,
        averageLatency,
        modelDistribution,
        queryTypeDistribution,
        errorsByType,
        apiCosts,
        timeRange: timeRange || {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      };

    } catch (error) {
      logger.error('Failed to generate performance dashboard:', error);
      throw error;
    }
  }

  /**
   * Get model statistics
   */
  async getModelStats(modelId: string, timeRange?: { start: Date; end: Date }): Promise<{
    totalQueries: number;
    successRate: number;
    averageConfidence: number;
    averageLatency: number;
    errorRate: number;
    averageUserSatisfaction: number;
  }> {
    try {
      const metrics = await this.loadMetrics();
      const queryMetrics = await this.loadQueryMetrics();

      // Filter by model and time range
      const modelMetrics = metrics.filter(m => {
        const matchesModel = m.modelId === modelId;
        const inTimeRange = timeRange 
          ? m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
          : true;
        return matchesModel && inTimeRange;
      });

      const modelQueryMetrics = queryMetrics.filter(m => {
        const matchesModel = m.modelUsed === modelId;
        const inTimeRange = timeRange
          ? m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
          : true;
        return matchesModel && inTimeRange;
      });

      const totalQueries = modelQueryMetrics.length;
      const successfulQueries = modelQueryMetrics.filter(m => m.success).length;
      const successRate = totalQueries > 0 ? (successfulQueries / totalQueries) * 100 : 0;

      const averageConfidence = modelQueryMetrics.length > 0
        ? modelQueryMetrics.reduce((sum, m) => sum + m.confidence, 0) / modelQueryMetrics.length
        : 0;

      const averageLatency = modelMetrics.length > 0
        ? modelMetrics.reduce((sum, m) => sum + m.latency, 0) / modelMetrics.length
        : 0;

      const errorRate = modelMetrics.length > 0
        ? modelMetrics.reduce((sum, m) => sum + m.errorRate, 0) / modelMetrics.length
        : 0;

      const averageUserSatisfaction = modelMetrics.length > 0
        ? modelMetrics.reduce((sum, m) => sum + m.userSatisfaction, 0) / modelMetrics.length
        : 0;

      return {
        totalQueries,
        successRate,
        averageConfidence,
        averageLatency,
        errorRate,
        averageUserSatisfaction
      };

    } catch (error) {
      logger.error('Failed to get model stats:', error);
      throw error;
    }
  }

  /**
   * Update user satisfaction for a query
   */
  async updateUserSatisfaction(queryId: string, satisfaction: number): Promise<void> {
    try {
      const queryMetrics = await this.loadQueryMetrics();
      const queryIndex = queryMetrics.findIndex(m => m.queryId === queryId);
      
      if (queryIndex !== -1) {
        // Update the query metrics with satisfaction score
        const query = queryMetrics[queryIndex];
        
        // Record performance metrics with satisfaction
        await this.recordPerformanceMetrics({
          modelId: query.modelUsed,
          queryType: this.categorizeQuery(query.userQuery),
          accuracy: query.confidence,
          latency: query.executionTime,
          userSatisfaction: satisfaction,
          errorRate: query.success ? 0 : 1,
          timestamp: new Date(),
          provider: this.extractProvider(query.modelUsed)
        });

        logger.info('User satisfaction updated', {
          queryId,
          satisfaction,
          modelUsed: query.modelUsed
        });
      }

    } catch (error) {
      logger.error('Failed to update user satisfaction:', error);
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkAlerts(metrics: PerformanceMetrics): Promise<void> {
    if (!this.alertConfig.enabled) return;

    const alerts: string[] = [];

    // Check error rate
    if (metrics.errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}% for ${metrics.modelId}`);
    }

    // Check latency
    if (metrics.latency > this.alertConfig.latencyThreshold) {
      alerts.push(`High latency: ${metrics.latency}ms for ${metrics.modelId}`);
    }

    // Check confidence
    if (metrics.accuracy < this.alertConfig.confidenceThreshold) {
      alerts.push(`Low confidence: ${metrics.accuracy}% for ${metrics.modelId}`);
    }

    // Send alerts if any
    if (alerts.length > 0) {
      await this.sendAlerts(alerts);
    }
  }

  /**
   * Send performance alerts
   */
  private async sendAlerts(alerts: string[]): Promise<void> {
    // Log alerts (in production, you might send emails, Slack messages, etc.)
    alerts.forEach(alert => {
      logger.warn('PERFORMANCE ALERT:', alert);
      console.warn('🚨 PERFORMANCE ALERT:', alert);
    });
  }

  /**
   * Load performance metrics from file
   */
  private async loadMetrics(): Promise<PerformanceMetrics[]> {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf-8');
      const metrics = JSON.parse(data);
      
      // Convert timestamp strings back to Date objects
      return metrics.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  /**
   * Load query metrics from file
   */
  private async loadQueryMetrics(): Promise<QueryExecutionMetrics[]> {
    try {
      const data = await fs.readFile(this.queryMetricsFile, 'utf-8');
      const metrics = JSON.parse(data);
      
      // Convert timestamp strings back to Date objects
      return metrics.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  /**
   * Categorize error messages
   */
  private categorizeError(errorMessage: string): string {
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('timeout') || lowerError.includes('time out')) {
      return 'Timeout';
    } else if (lowerError.includes('api') || lowerError.includes('rate limit')) {
      return 'API Error';
    } else if (lowerError.includes('syntax') || lowerError.includes('parse')) {
      return 'SQL Syntax Error';
    } else if (lowerError.includes('schema') || lowerError.includes('table') || lowerError.includes('column')) {
      return 'Schema Error';
    } else if (lowerError.includes('network') || lowerError.includes('connection')) {
      return 'Network Error';
    } else {
      return 'Other';
    }
  }

  /**
   * Categorize query type
   */
  private categorizeQuery(userQuery: string): string {
    const lowerQuery = userQuery.toLowerCase();
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      return 'count';
    } else if (lowerQuery.includes('sum') || lowerQuery.includes('total') || lowerQuery.includes('revenue')) {
      return 'aggregation';
    } else if (lowerQuery.includes('join') || (lowerQuery.includes('customer') && lowerQuery.includes('order'))) {
      return 'join';
    } else if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest')) {
      return 'ranking';
    } else if (lowerQuery.includes('where') || lowerQuery.includes('filter')) {
      return 'filtering';
    } else {
      return 'simple';
    }
  }

  /**
   * Extract provider from model name
   */
  private extractProvider(modelName: string): string {
    if (modelName.includes('OpenAI') || modelName.includes('GPT')) {
      return 'OpenAI';
    } else if (modelName.includes('Anthropic') || modelName.includes('Claude')) {
      return 'Anthropic';
    } else if (modelName.includes('Google') || modelName.includes('Gemini')) {
      return 'Google';
    } else if (modelName.includes('Hugging Face') || modelName.includes('SQLCoder') || modelName.includes('CodeT5')) {
      return 'Hugging Face';
    } else if (modelName.includes('Cohere')) {
      return 'Cohere';
    } else {
      return 'Other';
    }
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    logger.info('Alert configuration updated', this.alertConfig);
  }

  /**
   * Get current alert configuration
   */
  getAlertConfig(): AlertConfig {
    return { ...this.alertConfig };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();