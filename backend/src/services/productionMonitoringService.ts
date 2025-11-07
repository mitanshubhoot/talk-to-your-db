import { createLogger, format, transports } from 'winston';
import fs from 'fs/promises';
import path from 'path';

export interface APIUsageMetrics {
  provider: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalLatency: number;
  averageLatency: number;
  costEstimate: number;
  lastUsed: Date;
  rateLimitHits: number;
  timestamp: Date;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ErrorTrackingEntry {
  id: string;
  provider: string;
  errorType: string;
  errorMessage: string;
  userQuery: string;
  stackTrace?: string;
  timestamp: Date;
  retryAttempt: number;
  resolved: boolean;
}

export interface RateLimitInfo {
  provider: string;
  limit: number;
  remaining: number;
  resetTime: Date;
  windowStart: Date;
  requestCount: number;
}

/**
 * Production-ready monitoring service for SQL generation system
 */
export class ProductionMonitoringService {
  private logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json()
    ),
    transports: [
      new transports.File({ filename: 'logs/sql-generation-error.log', level: 'error' }),
      new transports.File({ filename: 'logs/sql-generation-combined.log' }),
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      })
    ]
  });

  private metricsFilePath = path.join(process.cwd(), 'data', 'api-usage-metrics.json');
  private healthCheckFilePath = path.join(process.cwd(), 'data', 'health-checks.json');
  private errorTrackingFilePath = path.join(process.cwd(), 'data', 'error-tracking.json');
  private rateLimitFilePath = path.join(process.cwd(), 'data', 'rate-limits.json');

  // In-memory caches for performance
  private metricsCache = new Map<string, APIUsageMetrics>();
  private healthCache = new Map<string, HealthCheckResult>();
  private rateLimitCache = new Map<string, RateLimitInfo>();

  // Rate limiting configuration
  private rateLimits = new Map<string, { limit: number; window: number }>([
    ['OpenAI GPT-4', { limit: 500, window: 3600000 }], // 500 requests per hour
    ['OpenAI GPT-3.5-Turbo', { limit: 3500, window: 3600000 }], // 3500 requests per hour
    ['Anthropic Claude', { limit: 1000, window: 3600000 }], // 1000 requests per hour
    ['Google Gemini', { limit: 1500, window: 3600000 }], // 1500 requests per hour
    ['Hugging Face SQLCoder', { limit: 1000, window: 3600000 }], // 1000 requests per hour
    ['Cohere Command', { limit: 1000, window: 3600000 }], // 1000 requests per hour
    ['Text2SQL.ai', { limit: 50, window: 86400000 }], // 50 requests per day
  ]);

  // Cost estimates per 1K tokens (in USD)
  private costEstimates = new Map<string, number>([
    ['OpenAI GPT-4', 0.03],
    ['OpenAI GPT-3.5-Turbo', 0.002],
    ['Anthropic Claude', 0.008],
    ['Google Gemini', 0.0], // Free tier
    ['Hugging Face SQLCoder', 0.0], // Free tier
    ['Cohere Command', 0.0], // Free tier
    ['Text2SQL.ai', 0.0], // Free tier
  ]);

  constructor() {
    this.initializeDataDirectory();
    this.loadCachedData();
    this.startPeriodicTasks();
  }

  private async initializeDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    const logsDir = path.join(process.cwd(), 'logs');
    
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    try {
      await fs.access(logsDir);
    } catch {
      await fs.mkdir(logsDir, { recursive: true });
    }
  }

  private async loadCachedData() {
    try {
      // Load metrics
      const metricsData = await fs.readFile(this.metricsFilePath, 'utf-8');
      const metrics: APIUsageMetrics[] = JSON.parse(metricsData);
      metrics.forEach(metric => {
        this.metricsCache.set(metric.provider, metric);
      });
    } catch (error) {
      this.logger.info('No existing metrics data found, starting fresh');
    }

    try {
      // Load health checks
      const healthData = await fs.readFile(this.healthCheckFilePath, 'utf-8');
      const healthChecks: HealthCheckResult[] = JSON.parse(healthData);
      healthChecks.forEach(check => {
        this.healthCache.set(check.service, check);
      });
    } catch (error) {
      this.logger.info('No existing health check data found, starting fresh');
    }

    try {
      // Load rate limits
      const rateLimitData = await fs.readFile(this.rateLimitFilePath, 'utf-8');
      const rateLimits: RateLimitInfo[] = JSON.parse(rateLimitData);
      rateLimits.forEach(limit => {
        this.rateLimitCache.set(limit.provider, limit);
      });
    } catch (error) {
      this.logger.info('No existing rate limit data found, starting fresh');
    }
  }

  private startPeriodicTasks() {
    // Save metrics every 5 minutes
    setInterval(() => {
      this.saveMetricsToFile().catch(error => {
        this.logger.error('Failed to save metrics:', error);
      });
    }, 5 * 60 * 1000);

    // Run health checks every 2 minutes
    setInterval(() => {
      this.runHealthChecks().catch(error => {
        this.logger.error('Failed to run health checks:', error);
      });
    }, 2 * 60 * 1000);

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData().catch(error => {
        this.logger.error('Failed to cleanup old data:', error);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Record API usage metrics
   */
  async recordAPIUsage(
    provider: string,
    success: boolean,
    latency: number,
    tokenCount: number = 1000,
    retryAttempt: number = 0
  ): Promise<void> {
    const existing = this.metricsCache.get(provider) || {
      provider,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      costEstimate: 0,
      lastUsed: new Date(),
      rateLimitHits: 0,
      timestamp: new Date()
    };

    existing.requestCount++;
    existing.totalLatency += latency;
    existing.averageLatency = existing.totalLatency / existing.requestCount;
    existing.lastUsed = new Date();
    existing.timestamp = new Date();

    if (success) {
      existing.successCount++;
    } else {
      existing.errorCount++;
    }

    // Estimate cost
    const costPerToken = this.costEstimates.get(provider) || 0;
    existing.costEstimate += (tokenCount / 1000) * costPerToken;

    this.metricsCache.set(provider, existing);

    // Log the usage
    this.logger.info('API Usage Recorded', {
      provider,
      success,
      latency,
      tokenCount,
      retryAttempt,
      totalRequests: existing.requestCount,
      successRate: (existing.successCount / existing.requestCount) * 100
    });
  }

  /**
   * Check if provider is within rate limits
   */
  checkRateLimit(provider: string): { allowed: boolean; remaining: number; resetTime: Date } {
    const config = this.rateLimits.get(provider);
    if (!config) {
      return { allowed: true, remaining: Infinity, resetTime: new Date() };
    }

    const now = new Date();
    const existing = this.rateLimitCache.get(provider);

    if (!existing) {
      // First request for this provider
      const resetTime = new Date(now.getTime() + config.window);
      this.rateLimitCache.set(provider, {
        provider,
        limit: config.limit,
        remaining: config.limit - 1,
        resetTime,
        windowStart: now,
        requestCount: 1
      });
      return { allowed: true, remaining: config.limit - 1, resetTime };
    }

    // Check if window has reset
    if (now >= existing.resetTime) {
      const resetTime = new Date(now.getTime() + config.window);
      this.rateLimitCache.set(provider, {
        provider,
        limit: config.limit,
        remaining: config.limit - 1,
        resetTime,
        windowStart: now,
        requestCount: 1
      });
      return { allowed: true, remaining: config.limit - 1, resetTime };
    }

    // Check if within limits
    if (existing.requestCount >= config.limit) {
      // Record rate limit hit
      const metrics = this.metricsCache.get(provider);
      if (metrics) {
        metrics.rateLimitHits++;
        this.metricsCache.set(provider, metrics);
      }

      this.logger.warn('Rate limit exceeded', {
        provider,
        limit: config.limit,
        requestCount: existing.requestCount,
        resetTime: existing.resetTime
      });

      return { allowed: false, remaining: 0, resetTime: existing.resetTime };
    }

    // Update request count
    existing.requestCount++;
    existing.remaining = config.limit - existing.requestCount;
    this.rateLimitCache.set(provider, existing);

    return { allowed: true, remaining: existing.remaining, resetTime: existing.resetTime };
  }

  /**
   * Track errors with automatic retry logic
   */
  async trackError(
    provider: string,
    errorType: string,
    errorMessage: string,
    userQuery: string,
    retryAttempt: number = 0,
    stackTrace?: string
  ): Promise<string> {
    const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorEntry: ErrorTrackingEntry = {
      id: errorId,
      provider,
      errorType,
      errorMessage,
      userQuery,
      stackTrace,
      timestamp: new Date(),
      retryAttempt,
      resolved: false
    };

    // Save to file
    try {
      let existingErrors: ErrorTrackingEntry[] = [];
      try {
        const data = await fs.readFile(this.errorTrackingFilePath, 'utf-8');
        existingErrors = JSON.parse(data);
      } catch {
        // File doesn't exist, start with empty array
      }

      existingErrors.push(errorEntry);
      await fs.writeFile(this.errorTrackingFilePath, JSON.stringify(existingErrors, null, 2));
    } catch (saveError) {
      this.logger.error('Failed to save error tracking data:', saveError);
    }

    // Log the error
    this.logger.error('SQL Generation Error Tracked', {
      errorId,
      provider,
      errorType,
      errorMessage,
      userQuery: userQuery.substring(0, 100),
      retryAttempt,
      stackTrace: stackTrace?.substring(0, 500)
    });

    // Determine if automatic retry should be attempted
    if (this.shouldRetry(errorType, retryAttempt)) {
      this.logger.info('Automatic retry recommended', {
        errorId,
        provider,
        retryAttempt: retryAttempt + 1
      });
    }

    return errorId;
  }

  /**
   * Determine if error should trigger automatic retry
   */
  private shouldRetry(errorType: string, currentAttempt: number): boolean {
    const maxRetries = 2;
    if (currentAttempt >= maxRetries) return false;

    const retryableErrors = [
      'network_error',
      'timeout',
      'rate_limit',
      'server_error',
      'temporary_unavailable'
    ];

    return retryableErrors.includes(errorType.toLowerCase());
  }

  /**
   * Run health checks for external API dependencies
   */
  async runHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const providers = [
      { name: 'OpenAI', url: 'https://api.openai.com/v1/models', key: process.env.OPENAI_API_KEY },
      { name: 'Anthropic', url: 'https://api.anthropic.com/v1/messages', key: process.env.ANTHROPIC_API_KEY },
      { name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models', key: process.env.GOOGLE_API_KEY },
      { name: 'Hugging Face', url: 'https://api-inference.huggingface.co/models/defog/sqlcoder-7b-2', key: process.env.HUGGING_FACE_API_KEY },
      { name: 'Cohere', url: 'https://api.cohere.ai/v1/models', key: process.env.COHERE_API_KEY }
    ];

    for (const provider of providers) {
      if (!provider.key) {
        results.push({
          service: provider.name,
          status: 'unhealthy',
          responseTime: 0,
          lastCheck: new Date(),
          errorMessage: 'API key not configured'
        });
        continue;
      }

      const startTime = Date.now();
      try {
        const response = await fetch(provider.url, {
          method: 'GET',
          headers: {
            'Authorization': provider.name === 'Google Gemini' 
              ? `key=${provider.key}`
              : `Bearer ${provider.key}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        const responseTime = Date.now() - startTime;
        const status = response.ok ? 'healthy' : 'degraded';

        const result: HealthCheckResult = {
          service: provider.name,
          status,
          responseTime,
          lastCheck: new Date(),
          metadata: {
            statusCode: response.status,
            statusText: response.statusText
          }
        };

        if (!response.ok) {
          result.errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        results.push(result);
        this.healthCache.set(provider.name, result);

      } catch (error) {
        const responseTime = Date.now() - startTime;
        const result: HealthCheckResult = {
          service: provider.name,
          status: 'unhealthy',
          responseTime,
          lastCheck: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };

        results.push(result);
        this.healthCache.set(provider.name, result);
      }
    }

    // Save health check results
    try {
      await fs.writeFile(this.healthCheckFilePath, JSON.stringify(results, null, 2));
    } catch (error) {
      this.logger.error('Failed to save health check results:', error);
    }

    // Log unhealthy services
    const unhealthyServices = results.filter(r => r.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      this.logger.warn('Unhealthy services detected', {
        count: unhealthyServices.length,
        services: unhealthyServices.map(s => s.service)
      });
    }

    return results;
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: HealthCheckResult[];
    summary: {
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  } {
    const services = Array.from(this.healthCache.values());
    const summary = {
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length
    };

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overall = summary.unhealthy >= services.length / 2 ? 'unhealthy' : 'degraded';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    return { overall, services, summary };
  }

  /**
   * Get API usage statistics
   */
  getAPIUsageStats(): {
    providers: APIUsageMetrics[];
    totals: {
      requests: number;
      successes: number;
      errors: number;
      averageLatency: number;
      totalCost: number;
    };
  } {
    const providers = Array.from(this.metricsCache.values());
    
    const totals = providers.reduce((acc, provider) => ({
      requests: acc.requests + provider.requestCount,
      successes: acc.successes + provider.successCount,
      errors: acc.errors + provider.errorCount,
      averageLatency: acc.averageLatency + provider.averageLatency,
      totalCost: acc.totalCost + provider.costEstimate
    }), {
      requests: 0,
      successes: 0,
      errors: 0,
      averageLatency: 0,
      totalCost: 0
    });

    if (providers.length > 0) {
      totals.averageLatency = totals.averageLatency / providers.length;
    }

    return { providers, totals };
  }

  /**
   * Get error statistics
   */
  async getErrorStats(): Promise<{
    totalErrors: number;
    errorsByProvider: Record<string, number>;
    errorsByType: Record<string, number>;
    recentErrors: ErrorTrackingEntry[];
  }> {
    try {
      const data = await fs.readFile(this.errorTrackingFilePath, 'utf-8');
      const errors: ErrorTrackingEntry[] = JSON.parse(data);

      const errorsByProvider: Record<string, number> = {};
      const errorsByType: Record<string, number> = {};

      errors.forEach(error => {
        errorsByProvider[error.provider] = (errorsByProvider[error.provider] || 0) + 1;
        errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
      });

      // Get recent errors (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentErrors = errors
        .filter(error => new Date(error.timestamp) > oneDayAgo)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      return {
        totalErrors: errors.length,
        errorsByProvider,
        errorsByType,
        recentErrors
      };
    } catch (error) {
      return {
        totalErrors: 0,
        errorsByProvider: {},
        errorsByType: {},
        recentErrors: []
      };
    }
  }

  /**
   * Save metrics to file
   */
  private async saveMetricsToFile(): Promise<void> {
    try {
      const metrics = Array.from(this.metricsCache.values());
      await fs.writeFile(this.metricsFilePath, JSON.stringify(metrics, null, 2));
    } catch (error) {
      this.logger.error('Failed to save metrics to file:', error);
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Clean up old errors
      const errorData = await fs.readFile(this.errorTrackingFilePath, 'utf-8');
      const errors: ErrorTrackingEntry[] = JSON.parse(errorData);
      const recentErrors = errors.filter(error => new Date(error.timestamp) > thirtyDaysAgo);
      
      if (recentErrors.length !== errors.length) {
        await fs.writeFile(this.errorTrackingFilePath, JSON.stringify(recentErrors, null, 2));
        this.logger.info(`Cleaned up ${errors.length - recentErrors.length} old error entries`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old error data:', error);
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getMonitoringDashboard() {
    const [systemHealth, apiUsage, errorStats] = await Promise.all([
      this.getSystemHealth(),
      this.getAPIUsageStats(),
      this.getErrorStats()
    ]);

    return {
      systemHealth,
      apiUsage,
      errorStats,
      rateLimits: Array.from(this.rateLimitCache.values()),
      timestamp: new Date()
    };
  }
}

// Export singleton instance
export const productionMonitoringService = new ProductionMonitoringService();