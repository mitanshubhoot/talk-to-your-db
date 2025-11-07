import { SchemaInfo } from './database';
import { ModelManager, GenerationContext, SQLGenerationResult, EnsembleResult } from './modelManager';
import { QueryValidator, ValidationResult } from './queryValidator';
import { ComplexQueryPatternHandler, QueryPattern } from './complexQueryPatterns';
import { QueryExplainer, QueryExplanation } from './queryExplainer';
import { FreeAIService } from './freeAiService';
import { PerformanceMonitor, PerformanceMetrics, QueryExecutionMetrics } from './performanceMonitor';
import { FeedbackCollector, UserFeedback } from './feedbackCollector';
import { QueryOptimizer, OptimizationSuggestion } from './queryOptimizer';
import { randomUUID } from 'crypto';

export interface EnhancedGenerationRequest {
  userQuery: string;
  schema: SchemaInfo;
  connectionId: string;
  databaseDialect?: string;
  useEnsemble?: boolean;
  retryAttempt?: number;
  previousError?: string;
}

export interface EnhancedGenerationResult {
  sql: string;
  explanation: QueryExplanation;
  confidence: number;
  modelUsed: string;
  generationTime: number;
  validationResult: ValidationResult;
  queryPattern: QueryPattern;
  alternatives?: string[];
  ensembleInfo?: {
    consensusScore: number;
    modelsUsed: string[];
  };
  optimizationSuggestions?: OptimizationSuggestion[];
  queryId: string;
}

/**
 * Enhanced Model Manager that integrates all advanced NL2SQL components
 */
export class EnhancedModelManager {
  private modelManager: ModelManager;
  private queryValidator: QueryValidator;
  private patternHandler: ComplexQueryPatternHandler;
  private queryExplainer: QueryExplainer;
  private freeAIService: FreeAIService;
  private performanceMonitor: PerformanceMonitor;
  private feedbackCollector: FeedbackCollector;
  private queryOptimizer: QueryOptimizer;

  constructor() {
    this.modelManager = new ModelManager();
    this.queryValidator = new QueryValidator();
    this.patternHandler = new ComplexQueryPatternHandler();
    this.queryExplainer = new QueryExplainer();
    this.freeAIService = new FreeAIService();
    this.performanceMonitor = new PerformanceMonitor();
    this.feedbackCollector = new FeedbackCollector();
    this.queryOptimizer = new QueryOptimizer();
  }

  /**
   * Generate SQL with enhanced model selection, validation, and explanation
   */
  async generateEnhancedSQL(request: EnhancedGenerationRequest): Promise<EnhancedGenerationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Detect query pattern
      const queryPattern = this.patternHandler.detectQueryPattern(request.userQuery, request.schema);
      console.log(`🎯 Detected query pattern: ${queryPattern.type} (${queryPattern.complexity})`);

      // Step 2: Generate specialized prompt based on pattern
      const specializedPrompt = this.generateSpecializedPrompt(request.userQuery, request.schema, queryPattern);

      // Step 3: Create generation context
      const queryType = queryPattern.complexity === 'medium' ? 'complex' : queryPattern.complexity;
      const context: GenerationContext = {
        userQuery: request.userQuery,
        schema: request.schema,
        queryType: queryType as 'simple' | 'complex' | 'analytics',
        databaseDialect: request.databaseDialect || 'postgresql',
        retryAttempt: request.retryAttempt,
        previousError: request.previousError
      };

      // Step 4: Generate SQL using appropriate strategy
      let result: SQLGenerationResult;
      let ensembleInfo: { consensusScore: number; modelsUsed: string[] } | undefined;

      if (request.useEnsemble && queryPattern.complexity === 'complex') {
        // Use ensemble approach for complex queries
        const ensembleResult = await this.generateWithEnsemble(context, specializedPrompt);
        result = ensembleResult.recommendedResult;
        ensembleInfo = {
          consensusScore: ensembleResult.consensusScore,
          modelsUsed: [ensembleResult.primaryResult.modelUsed, ...ensembleResult.alternativeResults.map(r => r.modelUsed)]
        };
      } else {
        // Use single model with fallback
        result = await this.generateWithFallback(context, specializedPrompt);
      }

      // Step 5: Validate the generated SQL
      const validationResult = await this.queryValidator.validateSQL(result.sql, request.schema);
      
      // Step 6: If validation fails critically, retry with different approach
      if (!validationResult.isValid && validationResult.syntaxErrors.length > 0 && !request.retryAttempt) {
        console.log('🔄 Validation failed, retrying with different approach...');
        return this.generateEnhancedSQL({
          ...request,
          retryAttempt: 1,
          previousError: validationResult.syntaxErrors.join(', ')
        });
      }

      // Step 7: Generate comprehensive explanation
      const explanation = this.queryExplainer.explainQuery(result.sql, request.userQuery, request.schema);

      // Step 8: Generate optimization suggestions
      const optimizationAnalysis = await this.queryOptimizer.analyzeQuery(result.sql, request.schema);

      // Step 9: Calculate final confidence score
      const finalConfidence = this.calculateFinalConfidence(
        result.confidence,
        validationResult.confidence,
        queryPattern.complexity,
        ensembleInfo?.consensusScore
      );

      const generationTime = Date.now() - startTime;
      const queryId = randomUUID();

      // Step 10: Record performance metrics
      await this.recordPerformance(result.modelUsed, queryPattern.type, finalConfidence, generationTime);

      // Step 11: Record query execution metrics
      await this.recordQueryExecution({
        queryId,
        userQuery: request.userQuery,
        generatedSql: result.sql,
        executionTime: generationTime,
        resultCount: 0, // Will be updated when query is actually executed
        success: validationResult.isValid,
        errorMessage: validationResult.isValid ? undefined : validationResult.syntaxErrors.join(', '),
        confidence: finalConfidence,
        modelUsed: result.modelUsed,
        timestamp: new Date()
      });

      return {
        sql: result.sql,
        explanation,
        confidence: finalConfidence,
        modelUsed: result.modelUsed,
        generationTime,
        validationResult,
        queryPattern,
        alternatives: result.alternatives || [],
        ensembleInfo,
        optimizationSuggestions: optimizationAnalysis.suggestions,
        queryId
      };

    } catch (error) {
      console.error('Enhanced SQL generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate specialized prompt based on query pattern
   */
  private generateSpecializedPrompt(userQuery: string, schema: SchemaInfo, pattern: QueryPattern): string {
    switch (pattern.type) {
      case 'aggregation':
        const aggPrompt = this.patternHandler.generateAggregationPrompt(userQuery, schema, pattern);
        return this.buildCompletePrompt(aggPrompt);
      
      case 'join':
        const joinPrompt = this.patternHandler.generateJoinPrompt(userQuery, schema, pattern);
        return this.buildCompletePrompt(joinPrompt);
      
      case 'analytical':
        const analyticalPrompt = this.patternHandler.generateAnalyticalPrompt(userQuery, schema, pattern);
        return this.buildCompletePrompt(analyticalPrompt);
      
      case 'filtering':
        const filterPrompt = this.patternHandler.generateFilteringSortingPrompt(userQuery, schema, pattern);
        return this.buildCompletePrompt(filterPrompt);
      
      default:
        // Fallback to basic prompt
        return this.buildBasicPrompt(userQuery, schema);
    }
  }

  /**
   * Build complete prompt from pattern-specific prompt
   */
  private buildCompletePrompt(patternPrompt: any): string {
    return `${patternPrompt.systemPrompt}

${patternPrompt.schemaContext}

${patternPrompt.patternSpecificInstructions}

EXAMPLES:
${patternPrompt.examples.join('\n\n')}

${patternPrompt.userPrompt}`;
  }

  /**
   * Build basic prompt for simple queries
   */
  private buildBasicPrompt(userQuery: string, schema: SchemaInfo): string {
    return `Generate a SQL query for: "${userQuery}"

Database Schema:
${this.buildSchemaContext(schema)}

Generate only the SQL query with proper formatting.`;
  }

  /**
   * Build schema context string
   */
  private buildSchemaContext(schema: SchemaInfo): string {
    let context = '';
    
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      context += `\nTable: ${tableName}\n`;
      context += 'Columns:\n';
      
      tableInfo.columns.forEach(col => {
        let columnInfo = `  - ${col.column_name}: ${col.data_type}`;
        
        const constraints = [];
        if (col.is_primary_key) constraints.push('PK');
        if (col.is_foreign_key) constraints.push('FK');
        if (col.is_nullable === 'NO') constraints.push('NOT NULL');
        
        if (constraints.length > 0) {
          columnInfo += ` [${constraints.join(', ')}]`;
        }
        
        context += columnInfo + '\n';
      });
    });

    return context;
  }

  /**
   * Generate SQL with fallback using existing FreeAIService
   */
  private async generateWithFallback(context: GenerationContext, prompt: string): Promise<SQLGenerationResult> {
    try {
      // Use the existing FreeAIService which already has fallback logic
      const response = await this.freeAIService.generateSql({
        userQuery: context.userQuery,
        schema: context.schema
      });

      return {
        sql: response.sql,
        explanation: response.explanation,
        confidence: response.confidence,
        modelUsed: response.provider || 'unknown',
        generationTime: 0, // Will be calculated by caller
        alternatives: []
      };
    } catch (error) {
      throw new Error(`SQL generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate SQL using ensemble approach
   */
  private async generateWithEnsemble(context: GenerationContext, prompt: string): Promise<EnsembleResult> {
    // For now, use the model manager's ensemble approach
    // In a full implementation, this would integrate with the FreeAIService's multiple providers
    return this.modelManager.generateWithEnsemble(context);
  }

  /**
   * Calculate final confidence score combining multiple factors
   */
  private calculateFinalConfidence(
    modelConfidence: number,
    validationConfidence: number,
    complexity: string,
    consensusScore?: number
  ): number {
    let finalConfidence = (modelConfidence * 0.4) + (validationConfidence * 0.4);
    
    // Add consensus score if available
    if (consensusScore !== undefined) {
      finalConfidence = (finalConfidence * 0.7) + (consensusScore * 0.3);
    } else {
      finalConfidence = finalConfidence * 0.8; // Slight penalty for no consensus
    }
    
    // Adjust based on complexity
    switch (complexity) {
      case 'simple':
        finalConfidence += 5;
        break;
      case 'complex':
        finalConfidence -= 5;
        break;
      // medium stays the same
    }
    
    return Math.max(0, Math.min(100, Math.round(finalConfidence)));
  }

  /**
   * Record performance metrics
   */
  private async recordPerformance(
    modelId: string,
    queryType: string,
    confidence: number,
    latency: number
  ): Promise<void> {
    const performanceMetrics: PerformanceMetrics = {
      modelId,
      queryType,
      accuracy: confidence,
      latency,
      userSatisfaction: 0, // Will be updated based on user feedback
      errorRate: confidence < 70 ? 1 : 0,
      timestamp: new Date(),
      provider: this.extractProvider(modelId)
    };

    await this.performanceMonitor.recordPerformanceMetrics(performanceMetrics);
    await this.modelManager.recordModelPerformance(modelId, performanceMetrics);
  }

  /**
   * Record query execution metrics
   */
  private async recordQueryExecution(metrics: QueryExecutionMetrics): Promise<void> {
    await this.performanceMonitor.recordQueryExecution(metrics);
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
   * Update user satisfaction for a query
   */
  async updateUserSatisfaction(
    modelId: string,
    queryType: string,
    satisfaction: number
  ): Promise<void> {
    // Note: Performance monitor uses queryId, but we don't have it here
    // This will be updated when we have the actual queryId from feedback
    await this.modelManager.updateUserSatisfaction(modelId, queryType, satisfaction);
  }

  /**
   * Update user satisfaction for a specific query by queryId
   */
  async updateQuerySatisfaction(queryId: string, satisfaction: number): Promise<void> {
    await this.performanceMonitor.updateUserSatisfaction(queryId, satisfaction);
  }

  /**
   * Collect user feedback on generated SQL
   */
  async collectUserFeedback(feedback: {
    queryId: string;
    originalQuery: string;
    generatedSql: string;
    correctedSql?: string;
    userRating: number;
    feedbackType: 'correction' | 'rating' | 'improvement';
    comments?: string;
    userId?: string;
    sessionId?: string;
    modelUsed: string;
    confidence: number;
  }): Promise<string> {
    const feedbackId = await this.feedbackCollector.collectFeedback(feedback);
    
    // Update user satisfaction in performance monitoring using the queryId
    await this.updateQuerySatisfaction(feedback.queryId, feedback.userRating);
    
    return feedbackId;
  }

  /**
   * Get performance dashboard data
   */
  async getPerformanceDashboard(timeRange?: { start: Date; end: Date }) {
    return this.performanceMonitor.getPerformanceDashboard(timeRange);
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(timeRange?: { start: Date; end: Date }) {
    return this.feedbackCollector.getFeedbackStats(timeRange);
  }

  /**
   * Get learning insights from feedback
   */
  async getLearningInsights() {
    return this.feedbackCollector.generateLearningInsights();
  }

  /**
   * Get query optimization suggestions
   */
  async getOptimizationSuggestions(sql: string, schema: SchemaInfo) {
    return this.queryOptimizer.analyzeQuery(sql, schema);
  }

  /**
   * Track actual query execution performance
   */
  async trackQueryExecution(queryId: string, executionTime: number, resultCount: number, success: boolean, errorMessage?: string): Promise<void> {
    // Update the existing query metrics with actual execution data
    await this.queryOptimizer.trackQueryPerformance('', executionTime, resultCount);
  }

  /**
   * Get model statistics
   */
  getModelStats() {
    return {
      availableModels: this.modelManager.getAvailableModels(),
      modelStats: this.modelManager.getAvailableModels().map(model => ({
        model: model.name,
        stats: this.modelManager.getModelStats(model.id)
      }))
    };
  }

  /**
   * Validate a SQL query
   */
  async validateQuery(sql: string, schema: SchemaInfo): Promise<ValidationResult> {
    return this.queryValidator.validateSQL(sql, schema);
  }

  /**
   * Explain a SQL query
   */
  explainQuery(sql: string, userQuery: string, schema: SchemaInfo): QueryExplanation {
    return this.queryExplainer.explainQuery(sql, userQuery, schema);
  }
}

// Export singleton instance
export const enhancedModelManager = new EnhancedModelManager();