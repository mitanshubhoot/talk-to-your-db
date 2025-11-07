import { SchemaInfo } from './database';
import { FreeAIService, TextToSqlRequest, TextToSqlResponse } from './freeAiService';
import { enhancedModelManager, EnhancedGenerationRequest, EnhancedGenerationResult } from './enhancedModelManager';
import { featureFlagService } from './featureFlagService';
import { productionMonitoringService } from './productionMonitoringService';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'logs/enhanced-integration.log' }),
    new transports.Console({ format: format.simple() })
  ]
});

export interface EnhancedIntegrationRequest extends TextToSqlRequest {
  userId?: string;
  sessionId?: string;
  useEnsemble?: boolean;
  retryAttempt?: number;
  previousError?: string;
}

export interface EnhancedIntegrationResponse extends TextToSqlResponse {
  enhancedFeatures?: {
    validationResult?: any;
    queryPattern?: any;
    ensembleInfo?: any;
    queryId?: string;
    featureFlagsUsed?: string[];
  };
  fallbackUsed?: boolean;
  processingTime?: number;
}

/**
 * Enhanced integration service that provides backward compatibility while enabling advanced features
 */
export class EnhancedIntegrationService {
  private freeAIService: FreeAIService;

  constructor() {
    this.freeAIService = new FreeAIService();
  }

  /**
   * Generate SQL with enhanced features when enabled, fallback to basic service otherwise
   */
  async generateSql(request: EnhancedIntegrationRequest): Promise<EnhancedIntegrationResponse> {
    const startTime = Date.now();
    
    // Determine context for feature flag evaluation
    const context = {
      userId: request.userId,
      connectionType: request.connectionType,
      sessionId: request.sessionId,
      queryPattern: this.detectQueryPattern(request.userQuery)
    };

    // Check if enhanced SQL generation is enabled
    const useEnhanced = featureFlagService.isEnabled('enhanced_sql_generation', context);
    const useDialectAware = featureFlagService.isEnabled('dialect_aware_prompting', context);
    const useEnsemble = featureFlagService.isEnabled('ensemble_generation', context) && request.useEnsemble;
    const useAdvancedValidation = featureFlagService.isEnabled('advanced_validation', context);
    const useOptimizationSuggestions = featureFlagService.isEnabled('query_optimization_suggestions', context);
    const useMonitoring = featureFlagService.isEnabled('production_monitoring', context);

    const featureFlagsUsed = [];
    if (useEnhanced) featureFlagsUsed.push('enhanced_sql_generation');
    if (useDialectAware) featureFlagsUsed.push('dialect_aware_prompting');
    if (useEnsemble) featureFlagsUsed.push('ensemble_generation');
    if (useAdvancedValidation) featureFlagsUsed.push('advanced_validation');
    if (useOptimizationSuggestions) featureFlagsUsed.push('query_optimization_suggestions');
    if (useMonitoring) featureFlagsUsed.push('production_monitoring');

    logger.info('SQL Generation Request', {
      userQuery: request.userQuery.substring(0, 100),
      connectionType: request.connectionType,
      useEnhanced,
      useDialectAware,
      useEnsemble,
      featureFlagsUsed,
      context
    });

    try {
      let result: EnhancedIntegrationResponse;
      let fallbackUsed = false;

      if (useEnhanced) {
        // Use enhanced model manager
        try {
          const enhancedRequest: EnhancedGenerationRequest = {
            userQuery: request.userQuery,
            schema: request.schema,
            connectionId: 'default', // This would come from the request in a real implementation
            databaseDialect: request.databaseDialect,
            useEnsemble,
            retryAttempt: request.retryAttempt,
            previousError: request.previousError
          };

          const enhancedResult = await enhancedModelManager.generateEnhancedSQL(enhancedRequest);
          
          result = {
            sql: enhancedResult.sql,
            explanation: enhancedResult.explanation.summary,
            confidence: enhancedResult.confidence,
            warnings: this.extractWarnings(enhancedResult.validationResult),
            provider: enhancedResult.modelUsed,
            dialectUsed: request.connectionType || 'postgresql',
            optimizationSuggestions: useOptimizationSuggestions ? 
              enhancedResult.optimizationSuggestions?.map(s => s.description) : undefined,
            enhancedFeatures: {
              validationResult: useAdvancedValidation ? enhancedResult.validationResult : undefined,
              queryPattern: enhancedResult.queryPattern,
              ensembleInfo: enhancedResult.ensembleInfo,
              queryId: enhancedResult.queryId,
              featureFlagsUsed
            },
            fallbackUsed: false,
            processingTime: Date.now() - startTime
          };

        } catch (enhancedError) {
          logger.warn('Enhanced SQL generation failed, falling back to basic service', {
            error: enhancedError instanceof Error ? enhancedError.message : String(enhancedError),
            userQuery: request.userQuery.substring(0, 100)
          });

          // Fallback to basic service
          const basicResult = await this.freeAIService.generateSql(request);
          result = {
            ...basicResult,
            enhancedFeatures: {
              featureFlagsUsed
            },
            fallbackUsed: true,
            processingTime: Date.now() - startTime
          };
          fallbackUsed = true;
        }
      } else {
        // Use basic free AI service
        const basicResult = await this.freeAIService.generateSql(request);
        result = {
          ...basicResult,
          enhancedFeatures: {
            featureFlagsUsed
          },
          fallbackUsed: false,
          processingTime: Date.now() - startTime
        };
      }

      // Log successful generation
      logger.info('SQL Generation Successful', {
        provider: result.provider,
        confidence: result.confidence,
        fallbackUsed,
        processingTime: result.processingTime,
        featureFlagsUsed
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('SQL Generation Failed', {
        error: error instanceof Error ? error.message : String(error),
        userQuery: request.userQuery.substring(0, 100),
        processingTime,
        featureFlagsUsed
      });

      // Track error if monitoring is enabled
      if (useMonitoring) {
        await productionMonitoringService.trackError(
          'enhanced_integration_service',
          'generation_failure',
          error instanceof Error ? error.message : String(error),
          request.userQuery,
          request.retryAttempt || 0,
          error instanceof Error ? error.stack : undefined
        );
      }

      throw error;
    }
  }

  /**
   * Detect query pattern for feature flag context
   */
  private detectQueryPattern(userQuery: string): string {
    const lowerQuery = userQuery.toLowerCase();
    
    if (lowerQuery.includes('join') || 
        (lowerQuery.includes('customer') && lowerQuery.includes('order')) ||
        (lowerQuery.includes('product') && lowerQuery.includes('category'))) {
      return 'join';
    }
    
    if (lowerQuery.includes('count') || lowerQuery.includes('sum') || 
        lowerQuery.includes('avg') || lowerQuery.includes('group by')) {
      return 'aggregation';
    }
    
    if (lowerQuery.includes('trend') || lowerQuery.includes('over time') ||
        lowerQuery.includes('monthly') || lowerQuery.includes('yearly') ||
        lowerQuery.includes('growth') || lowerQuery.includes('analysis')) {
      return 'analytical';
    }
    
    if (lowerQuery.includes('where') || lowerQuery.includes('filter') ||
        lowerQuery.includes('between') || lowerQuery.includes('like')) {
      return 'filtering';
    }
    
    // Check complexity
    const complexityIndicators = [
      'subquery', 'nested', 'cte', 'with', 'window function',
      'rank', 'partition', 'case when', 'exists'
    ];
    
    if (complexityIndicators.some(indicator => lowerQuery.includes(indicator))) {
      return 'complex';
    }
    
    return 'simple';
  }

  /**
   * Extract warnings from validation result
   */
  private extractWarnings(validationResult?: any): string[] | undefined {
    if (!validationResult) return undefined;
    
    const warnings: string[] = [];
    
    if (validationResult.syntaxErrors && validationResult.syntaxErrors.length > 0) {
      warnings.push(...validationResult.syntaxErrors);
    }
    
    if (validationResult.semanticWarnings && validationResult.semanticWarnings.length > 0) {
      warnings.push(...validationResult.semanticWarnings);
    }
    
    if (validationResult.performanceWarnings && validationResult.performanceWarnings.length > 0) {
      warnings.push(...validationResult.performanceWarnings);
    }
    
    return warnings.length > 0 ? warnings : undefined;
  }

  /**
   * Get available providers (backward compatibility)
   */
  getAvailableProviders(): string[] {
    return this.freeAIService.getAvailableProviders();
  }

  /**
   * Get feature flag status for debugging
   */
  getFeatureFlagStatus(context?: {
    userId?: string;
    connectionType?: string;
    queryPattern?: string;
    sessionId?: string;
  }) {
    const flags = [
      'enhanced_sql_generation',
      'dialect_aware_prompting',
      'ensemble_generation',
      'advanced_validation',
      'query_optimization_suggestions',
      'production_monitoring'
    ];

    return flags.reduce((status, flagName) => {
      status[flagName] = {
        enabled: featureFlagService.isEnabled(flagName, context),
        evaluation: featureFlagService.getEvaluationContext(flagName, context)
      };
      return status;
    }, {} as Record<string, any>);
  }

  /**
   * Health check for the enhanced integration service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      freeAIService: boolean;
      enhancedModelManager: boolean;
      featureFlagService: boolean;
      productionMonitoring: boolean;
    };
    featureFlags: Record<string, boolean>;
  }> {
    const services = {
      freeAIService: true, // Assume healthy if no errors
      enhancedModelManager: true, // Assume healthy if no errors
      featureFlagService: true, // Assume healthy if no errors
      productionMonitoring: true // Assume healthy if no errors
    };

    // Test basic functionality
    try {
      this.freeAIService.getAvailableProviders();
    } catch {
      services.freeAIService = false;
    }

    try {
      featureFlagService.getAllFlags();
    } catch {
      services.featureFlagService = false;
    }

    const featureFlags = {
      enhanced_sql_generation: featureFlagService.isEnabled('enhanced_sql_generation'),
      dialect_aware_prompting: featureFlagService.isEnabled('dialect_aware_prompting'),
      ensemble_generation: featureFlagService.isEnabled('ensemble_generation'),
      advanced_validation: featureFlagService.isEnabled('advanced_validation'),
      query_optimization_suggestions: featureFlagService.isEnabled('query_optimization_suggestions'),
      production_monitoring: featureFlagService.isEnabled('production_monitoring')
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.values(services).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (healthyServices === 0) {
      status = 'unhealthy';
    } else if (healthyServices < totalServices) {
      status = 'degraded';
    }

    return {
      status,
      services,
      featureFlags
    };
  }
}

// Export singleton instance
export const enhancedIntegrationService = new EnhancedIntegrationService();