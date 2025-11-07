import { SchemaInfo } from './database';
import { QueryValidator, ValidationResult } from './queryValidator';

export interface ModelInfo {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'huggingface' | 'cohere' | 'rule-based';
  specialization: 'general' | 'sql' | 'analytics';
  supportedDialects: string[];
  maxContextLength: number;
  averageLatency: number;
  accuracyScore: number;
  costPerQuery: number;
  isConfigured: boolean;
  priority: number; // Lower number = higher priority
}

export interface ModelPerformance {
  modelId: string;
  queryType: string;
  accuracy: number;
  latency: number;
  userSatisfaction: number;
  errorRate: number;
  timestamp: Date;
}

export interface GenerationContext {
  userQuery: string;
  schema: SchemaInfo;
  queryType: 'simple' | 'complex' | 'analytics';
  databaseDialect: string;
  retryAttempt?: number;
  previousError?: string;
}

export interface SQLGenerationResult {
  sql: string;
  explanation: string;
  confidence: number;
  modelUsed: string;
  generationTime: number;
  alternatives?: string[];
  validationResult?: ValidationResult;
}

export interface EnsembleResult {
  primaryResult: SQLGenerationResult;
  alternativeResults: SQLGenerationResult[];
  consensusScore: number;
  recommendedResult: SQLGenerationResult;
}

export class ModelManager {
  private models: Map<string, ModelInfo> = new Map();
  private performanceHistory: ModelPerformance[] = [];
  private queryValidator: QueryValidator;

  constructor() {
    this.queryValidator = new QueryValidator();
    this.initializeModels();
  }

  /**
   * Initialize available models with their configurations
   */
  private initializeModels(): void {
    const modelConfigs: ModelInfo[] = [
      {
        id: 'gpt-4',
        name: 'OpenAI GPT-4',
        type: 'openai',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite', 'mssql'],
        maxContextLength: 8192,
        averageLatency: 2000,
        accuracyScore: 95,
        costPerQuery: 0.03,
        isConfigured: !!process.env.OPENAI_API_KEY,
        priority: 1
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'OpenAI GPT-3.5-Turbo',
        type: 'openai',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite', 'mssql'],
        maxContextLength: 4096,
        averageLatency: 1500,
        accuracyScore: 90,
        costPerQuery: 0.002,
        isConfigured: !!process.env.OPENAI_API_KEY,
        priority: 2
      },
      {
        id: 'claude-3-sonnet',
        name: 'Anthropic Claude',
        type: 'anthropic',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite'],
        maxContextLength: 200000,
        averageLatency: 2500,
        accuracyScore: 92,
        costPerQuery: 0.015,
        isConfigured: !!process.env.ANTHROPIC_API_KEY,
        priority: 3
      },
      {
        id: 'gemini-pro',
        name: 'Google Gemini',
        type: 'google',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite'],
        maxContextLength: 30720,
        averageLatency: 2000,
        accuracyScore: 88,
        costPerQuery: 0.001,
        isConfigured: !!process.env.GOOGLE_API_KEY,
        priority: 4
      },
      {
        id: 'sqlcoder-7b',
        name: 'Hugging Face SQLCoder',
        type: 'huggingface',
        specialization: 'sql',
        supportedDialects: ['postgresql', 'mysql', 'sqlite'],
        maxContextLength: 2048,
        averageLatency: 3000,
        accuracyScore: 85,
        costPerQuery: 0,
        isConfigured: !!process.env.HUGGING_FACE_API_KEY,
        priority: 5
      },
      {
        id: 'duckdb-nsql',
        name: 'Hugging Face DuckDB-NSQL',
        type: 'huggingface',
        specialization: 'sql',
        supportedDialects: ['postgresql', 'mysql', 'sqlite', 'duckdb'],
        maxContextLength: 2048,
        averageLatency: 3500,
        accuracyScore: 83,
        costPerQuery: 0,
        isConfigured: !!process.env.HUGGING_FACE_API_KEY,
        priority: 6
      },
      {
        id: 'codet5-plus',
        name: 'Hugging Face CodeT5+',
        type: 'huggingface',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite'],
        maxContextLength: 1024,
        averageLatency: 2500,
        accuracyScore: 80,
        costPerQuery: 0,
        isConfigured: !!process.env.HUGGING_FACE_API_KEY,
        priority: 7
      },
      {
        id: 'cohere-command',
        name: 'Cohere Command',
        type: 'cohere',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite'],
        maxContextLength: 4096,
        averageLatency: 2000,
        accuracyScore: 85,
        costPerQuery: 0.001,
        isConfigured: !!process.env.COHERE_API_KEY,
        priority: 8
      },
      {
        id: 'rule-based',
        name: 'Rule-based Fallback',
        type: 'rule-based',
        specialization: 'general',
        supportedDialects: ['postgresql', 'mysql', 'sqlite'],
        maxContextLength: Infinity,
        averageLatency: 100,
        accuracyScore: 70,
        costPerQuery: 0,
        isConfigured: true,
        priority: 99 // Lowest priority - fallback only
      }
    ];

    modelConfigs.forEach(model => {
      this.models.set(model.id, model);
    });
  }

  /**
   * Select the best model for a given query context
   */
  async selectBestModel(context: GenerationContext): Promise<ModelInfo> {
    const availableModels = Array.from(this.models.values())
      .filter(model => model.isConfigured)
      .filter(model => model.supportedDialects.includes(context.databaseDialect));

    if (availableModels.length === 0) {
      throw new Error('No configured models available for the specified database dialect');
    }

    // Calculate scores for each model based on context
    const modelScores = availableModels.map(model => ({
      model,
      score: this.calculateModelScore(model, context)
    }));

    // Sort by score (higher is better)
    modelScores.sort((a, b) => b.score - a.score);

    return modelScores[0].model;
  }

  /**
   * Calculate model score based on context and performance history
   */
  private calculateModelScore(model: ModelInfo, context: GenerationContext): number {
    let score = model.accuracyScore;

    // Boost specialized models for their domain
    if (model.specialization === 'sql' && context.queryType !== 'analytics') {
      score += 10;
    } else if (model.specialization === 'analytics' && context.queryType === 'analytics') {
      score += 15;
    }

    // Consider recent performance
    const recentPerformance = this.getRecentPerformance(model.id, context.queryType);
    if (recentPerformance.length > 0) {
      const avgAccuracy = recentPerformance.reduce((sum, p) => sum + p.accuracy, 0) / recentPerformance.length;
      const avgLatency = recentPerformance.reduce((sum, p) => sum + p.latency, 0) / recentPerformance.length;
      const avgSatisfaction = recentPerformance.reduce((sum, p) => sum + p.userSatisfaction, 0) / recentPerformance.length;
      
      // Weight recent performance heavily
      score = (score * 0.3) + (avgAccuracy * 0.4) + (avgSatisfaction * 0.3);
      
      // Penalize high latency
      if (avgLatency > 5000) score -= 10;
      else if (avgLatency > 3000) score -= 5;
    }

    // Penalize high cost for simple queries
    if (context.queryType === 'simple' && model.costPerQuery > 0.01) {
      score -= 5;
    }

    // Boost free models slightly for cost-conscious scenarios
    if (model.costPerQuery === 0) {
      score += 2;
    }

    // Consider retry attempts - prefer different model types on retries
    if (context.retryAttempt && context.retryAttempt > 0) {
      // Prefer specialized SQL models on retries
      if (model.specialization === 'sql') {
        score += 5;
      }
    }

    return score;
  }

  /**
   * Generate SQL with automatic fallback
   */
  async generateSQLWithFallback(context: GenerationContext): Promise<SQLGenerationResult> {
    const maxAttempts = 3;
    let lastError: Error | null = null;
    const attemptedModels: string[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Update context with retry information
        const retryContext = {
          ...context,
          retryAttempt: attempt,
          previousError: lastError?.message
        };

        // Select best available model (excluding already attempted ones)
        const availableModels = Array.from(this.models.values())
          .filter(model => model.isConfigured)
          .filter(model => !attemptedModels.includes(model.id))
          .filter(model => model.supportedDialects.includes(context.databaseDialect));

        if (availableModels.length === 0) {
          throw new Error('No more models available for fallback');
        }

        const selectedModel = await this.selectBestModel(retryContext);
        attemptedModels.push(selectedModel.id);

        // Generate SQL with selected model
        const startTime = Date.now();
        const result = await this.generateWithModel(selectedModel, retryContext);
        const generationTime = Date.now() - startTime;

        // Validate the result
        const validationResult = await this.queryValidator.validateSQL(result.sql, context.schema);
        
        // If validation fails with critical errors, try next model
        if (!validationResult.isValid && validationResult.syntaxErrors.length > 0) {
          lastError = new Error(`Validation failed: ${validationResult.syntaxErrors.join(', ')}`);
          continue;
        }

        // Record performance
        await this.recordModelPerformance(selectedModel.id, {
          modelId: selectedModel.id,
          queryType: context.queryType,
          accuracy: validationResult.confidence,
          latency: generationTime,
          userSatisfaction: 0, // Will be updated based on user feedback
          errorRate: validationResult.isValid ? 0 : 1,
          timestamp: new Date()
        });

        return {
          ...result,
          generationTime,
          validationResult
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Model attempt ${attempt + 1} failed:`, lastError.message);
        continue;
      }
    }

    throw new Error(`All fallback attempts failed. Last error: ${lastError?.message}`);
  }

  /**
   * Generate SQL using ensemble approach for critical queries
   */
  async generateWithEnsemble(context: GenerationContext): Promise<EnsembleResult> {
    const topModels = Array.from(this.models.values())
      .filter(model => model.isConfigured)
      .filter(model => model.supportedDialects.includes(context.databaseDialect))
      .sort((a, b) => this.calculateModelScore(b, context) - this.calculateModelScore(a, context))
      .slice(0, 3); // Use top 3 models

    const results: SQLGenerationResult[] = [];
    
    // Generate with multiple models in parallel
    const promises = topModels.map(async (model) => {
      try {
        const startTime = Date.now();
        const result = await this.generateWithModel(model, context);
        const generationTime = Date.now() - startTime;
        
        const validationResult = await this.queryValidator.validateSQL(result.sql, context.schema);
        
        return {
          ...result,
          generationTime,
          validationResult
        };
      } catch (error) {
        console.warn(`Ensemble model ${model.id} failed:`, error);
        return null;
      }
    });

    const settledResults = await Promise.allSettled(promises);
    
    settledResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });

    if (results.length === 0) {
      throw new Error('All ensemble models failed');
    }

    // Calculate consensus and select best result
    const consensusScore = this.calculateConsensus(results);
    const recommendedResult = this.selectBestEnsembleResult(results);

    return {
      primaryResult: results[0],
      alternativeResults: results.slice(1),
      consensusScore,
      recommendedResult
    };
  }

  /**
   * Generate SQL with a specific model (placeholder - would integrate with actual AI services)
   */
  private async generateWithModel(model: ModelInfo, context: GenerationContext): Promise<SQLGenerationResult> {
    // This would integrate with the actual AI service implementations
    // For now, return a placeholder structure
    return {
      sql: 'SELECT * FROM placeholder;',
      explanation: 'Placeholder explanation',
      confidence: model.accuracyScore,
      modelUsed: model.id,
      generationTime: model.averageLatency
    };
  }

  /**
   * Calculate consensus score between multiple results
   */
  private calculateConsensus(results: SQLGenerationResult[]): number {
    if (results.length < 2) return 100;

    // Simple consensus based on SQL similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const similarity = this.calculateSQLSimilarity(results[i].sql, results[j].sql);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? (totalSimilarity / comparisons) * 100 : 0;
  }

  /**
   * Calculate similarity between two SQL queries
   */
  private calculateSQLSimilarity(sql1: string, sql2: string): number {
    const normalize = (sql: string) => sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm1 = normalize(sql1);
    const norm2 = normalize(sql2);

    if (norm1 === norm2) return 1.0;

    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(norm1.length, norm2.length);
    const distance = this.levenshteinDistance(norm1, norm2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Select the best result from ensemble results
   */
  private selectBestEnsembleResult(results: SQLGenerationResult[]): SQLGenerationResult {
    return results.reduce((best, current) => {
      const bestScore = (best.confidence * 0.7) + ((best.validationResult?.confidence || 0) * 0.3);
      const currentScore = (current.confidence * 0.7) + ((current.validationResult?.confidence || 0) * 0.3);
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Record model performance for future selection
   */
  async recordModelPerformance(modelId: string, performance: ModelPerformance): Promise<void> {
    this.performanceHistory.push(performance);
    
    // Keep only recent performance data (last 1000 entries)
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }

    // Update model accuracy score based on recent performance
    const model = this.models.get(modelId);
    if (model) {
      const recentPerformance = this.getRecentPerformance(modelId);
      if (recentPerformance.length >= 10) {
        const avgAccuracy = recentPerformance.reduce((sum, p) => sum + p.accuracy, 0) / recentPerformance.length;
        model.accuracyScore = Math.round((model.accuracyScore * 0.7) + (avgAccuracy * 0.3));
      }
    }
  }

  /**
   * Get recent performance data for a model
   */
  private getRecentPerformance(modelId: string, queryType?: string): ModelPerformance[] {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return this.performanceHistory
      .filter(p => p.modelId === modelId)
      .filter(p => p.timestamp >= thirtyDaysAgo)
      .filter(p => !queryType || p.queryType === queryType)
      .slice(-50); // Last 50 entries
  }

  /**
   * Get available models
   */
  getAvailableModels(): ModelInfo[] {
    return Array.from(this.models.values()).filter(model => model.isConfigured);
  }

  /**
   * Get model statistics
   */
  getModelStats(modelId: string): {
    totalQueries: number;
    averageAccuracy: number;
    averageLatency: number;
    errorRate: number;
  } {
    const performance = this.performanceHistory.filter(p => p.modelId === modelId);
    
    if (performance.length === 0) {
      return {
        totalQueries: 0,
        averageAccuracy: 0,
        averageLatency: 0,
        errorRate: 0
      };
    }

    return {
      totalQueries: performance.length,
      averageAccuracy: performance.reduce((sum, p) => sum + p.accuracy, 0) / performance.length,
      averageLatency: performance.reduce((sum, p) => sum + p.latency, 0) / performance.length,
      errorRate: performance.reduce((sum, p) => sum + p.errorRate, 0) / performance.length
    };
  }

  /**
   * Update user satisfaction for a query
   */
  async updateUserSatisfaction(modelId: string, queryType: string, satisfaction: number): Promise<void> {
    // Find the most recent performance entry for this model and query type
    const recentEntry = this.performanceHistory
      .filter(p => p.modelId === modelId && p.queryType === queryType)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (recentEntry) {
      recentEntry.userSatisfaction = satisfaction;
    }
  }
}

// Export singleton instance
export const modelManager = new ModelManager();