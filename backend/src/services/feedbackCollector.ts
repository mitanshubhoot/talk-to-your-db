import { createLogger, format, transports } from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/feedback.log' })
  ]
});

export interface UserFeedback {
  id: string;
  queryId: string;
  originalQuery: string;
  generatedSql: string;
  correctedSql?: string;
  userRating: number; // 1-5 scale
  feedbackType: 'correction' | 'rating' | 'improvement';
  comments?: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  modelUsed: string;
  confidence: number;
}

export interface QueryPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  commonFailures: string[];
  improvements: string[];
  lastUpdated: Date;
}

export interface LearningInsight {
  type: 'pattern' | 'correction' | 'failure';
  description: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  suggestedAction: string;
  examples: string[];
}

/**
 * Feedback collection and learning system for SQL generation
 */
export class FeedbackCollector {
  private feedbackFile = path.join(process.cwd(), 'backend/data/user-feedback.json');
  private patternsFile = path.join(process.cwd(), 'backend/data/query-patterns.json');
  private insightsFile = path.join(process.cwd(), 'backend/data/learning-insights.json');

  constructor() {
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  private async ensureDataDirectory(): Promise<void> {
    try {
      const dataDir = path.dirname(this.feedbackFile);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  /**
   * Collect user feedback on generated SQL
   */
  async collectFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): Promise<string> {
    try {
      const feedbackRecord: UserFeedback = {
        ...feedback,
        id: randomUUID(),
        timestamp: new Date()
      };

      const existingFeedback = await this.loadFeedback();
      existingFeedback.push(feedbackRecord);

      // Keep only last 5,000 feedback records
      if (existingFeedback.length > 5000) {
        existingFeedback.splice(0, existingFeedback.length - 5000);
      }

      await fs.writeFile(this.feedbackFile, JSON.stringify(existingFeedback, null, 2));

      logger.info('User feedback collected', {
        feedbackId: feedbackRecord.id,
        queryId: feedback.queryId,
        rating: feedback.userRating,
        type: feedback.feedbackType
      });

      // Process feedback for learning
      await this.processFeedbackForLearning(feedbackRecord);

      return feedbackRecord.id;

    } catch (error) {
      logger.error('Failed to collect feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback statistics
   */
  async getFeedbackStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalFeedback: number;
    averageRating: number;
    feedbackByType: Record<string, number>;
    correctionRate: number;
    modelPerformance: Record<string, { rating: number; corrections: number; total: number }>;
  }> {
    try {
      const feedback = await this.loadFeedback();
      
      // Filter by time range if provided
      const filteredFeedback = timeRange
        ? feedback.filter(f => f.timestamp >= timeRange.start && f.timestamp <= timeRange.end)
        : feedback.filter(f => f.timestamp >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Last 7 days

      const totalFeedback = filteredFeedback.length;
      
      const averageRating = totalFeedback > 0
        ? filteredFeedback.reduce((sum, f) => sum + f.userRating, 0) / totalFeedback
        : 0;

      // Feedback by type
      const feedbackByType: Record<string, number> = {};
      filteredFeedback.forEach(f => {
        feedbackByType[f.feedbackType] = (feedbackByType[f.feedbackType] || 0) + 1;
      });

      // Correction rate
      const corrections = filteredFeedback.filter(f => f.feedbackType === 'correction').length;
      const correctionRate = totalFeedback > 0 ? (corrections / totalFeedback) * 100 : 0;

      // Model performance
      const modelPerformance: Record<string, { rating: number; corrections: number; total: number }> = {};
      filteredFeedback.forEach(f => {
        if (!modelPerformance[f.modelUsed]) {
          modelPerformance[f.modelUsed] = { rating: 0, corrections: 0, total: 0 };
        }
        modelPerformance[f.modelUsed].rating += f.userRating;
        modelPerformance[f.modelUsed].total += 1;
        if (f.feedbackType === 'correction') {
          modelPerformance[f.modelUsed].corrections += 1;
        }
      });

      // Calculate average ratings
      Object.keys(modelPerformance).forEach(model => {
        const perf = modelPerformance[model];
        perf.rating = perf.total > 0 ? perf.rating / perf.total : 0;
      });

      return {
        totalFeedback,
        averageRating,
        feedbackByType,
        correctionRate,
        modelPerformance
      };

    } catch (error) {
      logger.error('Failed to get feedback stats:', error);
      throw error;
    }
  }

  /**
   * Analyze query patterns from feedback
   */
  async analyzeQueryPatterns(): Promise<QueryPattern[]> {
    try {
      const feedback = await this.loadFeedback();
      const patterns: Record<string, QueryPattern> = {};

      feedback.forEach(f => {
        const pattern = this.extractQueryPattern(f.originalQuery);
        
        if (!patterns[pattern]) {
          patterns[pattern] = {
            pattern,
            frequency: 0,
            successRate: 0,
            commonFailures: [],
            improvements: [],
            lastUpdated: new Date()
          };
        }

        patterns[pattern].frequency += 1;
        
        // Track success/failure
        const isSuccess = f.userRating >= 4 && f.feedbackType !== 'correction';
        if (isSuccess) {
          patterns[pattern].successRate += 1;
        } else {
          // Track common failures
          if (f.correctedSql && f.generatedSql !== f.correctedSql) {
            const failure = this.identifyFailureType(f.generatedSql, f.correctedSql);
            if (!patterns[pattern].commonFailures.includes(failure)) {
              patterns[pattern].commonFailures.push(failure);
            }
          }
        }

        // Track improvements from corrections
        if (f.correctedSql && f.comments) {
          patterns[pattern].improvements.push(f.comments);
        }
      });

      // Calculate success rates
      Object.values(patterns).forEach(pattern => {
        pattern.successRate = pattern.frequency > 0 ? (pattern.successRate / pattern.frequency) * 100 : 0;
        pattern.improvements = [...new Set(pattern.improvements)]; // Remove duplicates
      });

      // Save patterns
      await fs.writeFile(this.patternsFile, JSON.stringify(Object.values(patterns), null, 2));

      return Object.values(patterns).sort((a, b) => b.frequency - a.frequency);

    } catch (error) {
      logger.error('Failed to analyze query patterns:', error);
      throw error;
    }
  }

  /**
   * Generate learning insights from feedback
   */
  async generateLearningInsights(): Promise<LearningInsight[]> {
    try {
      const feedback = await this.loadFeedback();
      const patterns = await this.analyzeQueryPatterns();
      const insights: LearningInsight[] = [];

      // Analyze common failure patterns
      const failureTypes: Record<string, number> = {};
      feedback.filter(f => f.feedbackType === 'correction').forEach(f => {
        if (f.correctedSql) {
          const failureType = this.identifyFailureType(f.generatedSql, f.correctedSql);
          failureTypes[failureType] = (failureTypes[failureType] || 0) + 1;
        }
      });

      // Generate insights for common failures
      Object.entries(failureTypes).forEach(([failureType, frequency]) => {
        if (frequency >= 3) { // Only include patterns that occur at least 3 times
          insights.push({
            type: 'failure',
            description: `Common failure: ${failureType}`,
            frequency,
            impact: frequency >= 10 ? 'high' : frequency >= 5 ? 'medium' : 'low',
            suggestedAction: this.getSuggestedAction(failureType),
            examples: this.getFailureExamples(failureType, feedback)
          });
        }
      });

      // Analyze low-performing query patterns
      patterns.filter(p => p.successRate < 70 && p.frequency >= 5).forEach(pattern => {
        insights.push({
          type: 'pattern',
          description: `Low success rate for pattern: ${pattern.pattern}`,
          frequency: pattern.frequency,
          impact: pattern.frequency >= 20 ? 'high' : pattern.frequency >= 10 ? 'medium' : 'low',
          suggestedAction: `Improve prompting or add specific examples for ${pattern.pattern} queries`,
          examples: pattern.commonFailures.slice(0, 3)
        });
      });

      // Analyze successful corrections for learning
      const successfulCorrections = feedback.filter(f => 
        f.feedbackType === 'correction' && f.correctedSql && f.userRating >= 4
      );

      if (successfulCorrections.length >= 5) {
        insights.push({
          type: 'correction',
          description: 'Users frequently provide successful corrections',
          frequency: successfulCorrections.length,
          impact: 'high',
          suggestedAction: 'Incorporate user corrections into training examples',
          examples: successfulCorrections.slice(0, 3).map(f => 
            `"${f.originalQuery}" -> "${f.correctedSql}"`
          )
        });
      }

      // Save insights
      await fs.writeFile(this.insightsFile, JSON.stringify(insights, null, 2));

      return insights.sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.impact] - impactOrder[a.impact] || b.frequency - a.frequency;
      });

    } catch (error) {
      logger.error('Failed to generate learning insights:', error);
      throw error;
    }
  }

  /**
   * Get successful query corrections for learning
   */
  async getSuccessfulCorrections(limit: number = 50): Promise<Array<{
    originalQuery: string;
    generatedSql: string;
    correctedSql: string;
    pattern: string;
    rating: number;
  }>> {
    try {
      const feedback = await this.loadFeedback();
      
      const corrections = feedback
        .filter(f => 
          f.feedbackType === 'correction' && 
          f.correctedSql && 
          f.userRating >= 4 &&
          f.generatedSql !== f.correctedSql
        )
        .map(f => ({
          originalQuery: f.originalQuery,
          generatedSql: f.generatedSql,
          correctedSql: f.correctedSql!,
          pattern: this.extractQueryPattern(f.originalQuery),
          rating: f.userRating
        }))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit);

      return corrections;

    } catch (error) {
      logger.error('Failed to get successful corrections:', error);
      throw error;
    }
  }

  /**
   * Process feedback for learning
   */
  private async processFeedbackForLearning(feedback: UserFeedback): Promise<void> {
    try {
      // If this is a correction with high rating, it's valuable for learning
      if (feedback.feedbackType === 'correction' && 
          feedback.correctedSql && 
          feedback.userRating >= 4) {
        
        logger.info('High-quality correction received for learning', {
          pattern: this.extractQueryPattern(feedback.originalQuery),
          originalQuery: feedback.originalQuery,
          improvement: this.identifyFailureType(feedback.generatedSql, feedback.correctedSql)
        });
      }

      // If rating is very low, log for analysis
      if (feedback.userRating <= 2) {
        logger.warn('Low rating feedback received', {
          queryId: feedback.queryId,
          modelUsed: feedback.modelUsed,
          confidence: feedback.confidence,
          pattern: this.extractQueryPattern(feedback.originalQuery)
        });
      }

    } catch (error) {
      logger.error('Failed to process feedback for learning:', error);
    }
  }

  /**
   * Extract query pattern from natural language query
   */
  private extractQueryPattern(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      return 'count_queries';
    } else if (lowerQuery.includes('sum') || lowerQuery.includes('total') || lowerQuery.includes('revenue')) {
      return 'aggregation_queries';
    } else if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest')) {
      return 'ranking_queries';
    } else if (lowerQuery.includes('join') || (lowerQuery.includes('customer') && lowerQuery.includes('order'))) {
      return 'join_queries';
    } else if (lowerQuery.includes('where') || lowerQuery.includes('filter') || lowerQuery.includes('from')) {
      return 'filtering_queries';
    } else if (lowerQuery.includes('group by') || lowerQuery.includes('by category') || lowerQuery.includes('per')) {
      return 'grouping_queries';
    } else if (lowerQuery.includes('average') || lowerQuery.includes('avg')) {
      return 'average_queries';
    } else {
      return 'simple_queries';
    }
  }

  /**
   * Identify failure type by comparing generated and corrected SQL
   */
  private identifyFailureType(generatedSql: string, correctedSql: string): string {
    const genLower = generatedSql.toLowerCase();
    const corrLower = correctedSql.toLowerCase();

    if (!genLower.includes('join') && corrLower.includes('join')) {
      return 'missing_join';
    } else if (!genLower.includes('where') && corrLower.includes('where')) {
      return 'missing_filter';
    } else if (!genLower.includes('group by') && corrLower.includes('group by')) {
      return 'missing_grouping';
    } else if (!genLower.includes('order by') && corrLower.includes('order by')) {
      return 'missing_sorting';
    } else if (!genLower.includes('limit') && corrLower.includes('limit')) {
      return 'missing_limit';
    } else if (genLower.includes('select *') && !corrLower.includes('select *')) {
      return 'overly_broad_select';
    } else if (genLower !== corrLower && corrLower.includes('distinct')) {
      return 'missing_distinct';
    } else {
      return 'other_correction';
    }
  }

  /**
   * Get suggested action for failure type
   */
  private getSuggestedAction(failureType: string): string {
    const actions: Record<string, string> = {
      'missing_join': 'Improve JOIN detection and relationship understanding',
      'missing_filter': 'Enhance WHERE clause generation from natural language conditions',
      'missing_grouping': 'Better detection of aggregation requirements',
      'missing_sorting': 'Improve ORDER BY clause generation for ranking queries',
      'missing_limit': 'Add LIMIT clauses for queries that might return large datasets',
      'overly_broad_select': 'Use specific column selection instead of SELECT *',
      'missing_distinct': 'Better detection of uniqueness requirements',
      'other_correction': 'Review and analyze specific correction patterns'
    };

    return actions[failureType] || 'Analyze and improve general SQL generation accuracy';
  }

  /**
   * Get examples of specific failure type
   */
  private getFailureExamples(failureType: string, feedback: UserFeedback[]): string[] {
    return feedback
      .filter(f => f.correctedSql && this.identifyFailureType(f.generatedSql, f.correctedSql) === failureType)
      .slice(0, 3)
      .map(f => `"${f.originalQuery}" -> Generated: "${f.generatedSql}" -> Corrected: "${f.correctedSql}"`);
  }

  /**
   * Load feedback from file
   */
  private async loadFeedback(): Promise<UserFeedback[]> {
    try {
      const data = await fs.readFile(this.feedbackFile, 'utf-8');
      const feedback = JSON.parse(data);
      
      // Convert timestamp strings back to Date objects
      return feedback.map((f: any) => ({
        ...f,
        timestamp: new Date(f.timestamp)
      }));
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }
}

// Export singleton instance
export const feedbackCollector = new FeedbackCollector();