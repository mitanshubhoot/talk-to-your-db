import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';
import { ExampleRepository, exampleRepository } from './exampleRepository';
import { AdvancedPromptBuilder, PromptContext } from './advancedPromptBuilder';
import { QueryPatternRecognizer, queryPatternRecognizer } from './queryPatternRecognizer';
import { EnhancedSchemaBuilder, enhancedSchemaBuilder } from './enhancedSchemaBuilder';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface EnhancedNLToSQLRequest {
  userQuery: string;
  schema: SchemaInfo;
  connectionId: string;
  databaseDialect?: string;
  retryAttempt?: number;
  previousError?: string;
}

export interface EnhancedNLToSQLResponse {
  sql: string;
  explanation: string;
  confidence: number;
  queryIntent: any;
  usedExamples: any[];
  schemaContext: any;
  warnings?: string[];
  suggestions?: string[];
}

export class EnhancedNLToSQLService {
  private exampleRepository: ExampleRepository;
  private promptBuilder: AdvancedPromptBuilder;
  private patternRecognizer: QueryPatternRecognizer;
  private schemaBuilder: EnhancedSchemaBuilder;

  constructor() {
    this.exampleRepository = exampleRepository;
    this.patternRecognizer = queryPatternRecognizer;
    this.schemaBuilder = enhancedSchemaBuilder;
    this.promptBuilder = new AdvancedPromptBuilder(this.exampleRepository, this.patternRecognizer);
  }

  /**
   * Enhanced natural language to SQL conversion
   */
  async convertToSQL(request: EnhancedNLToSQLRequest): Promise<EnhancedNLToSQLResponse> {
    logger.info(`Processing enhanced NL to SQL request: "${request.userQuery}"`);

    try {
      // Step 1: Recognize query patterns and intent
      const queryIntent = this.patternRecognizer.recognizeQuery(request.userQuery, request.schema);
      logger.debug(`Recognized query intent: ${queryIntent.type} (${queryIntent.complexity})`);

      // Step 2: Build enhanced schema context
      const schemaContext = await this.schemaBuilder.buildContext(
        request.connectionId,
        request.userQuery,
        request.schema
      );
      logger.debug(`Built enhanced schema context with ${schemaContext.relevantTables.length} relevant tables`);

      // Step 3: Build advanced prompt
      const promptContext: PromptContext = {
        naturalLanguageQuery: request.userQuery,
        schemaContext: request.schema,
        databaseDialect: request.databaseDialect || 'postgresql',
        queryIntent,
        complexity: queryIntent.complexity,
        retryAttempt: request.retryAttempt,
        previousError: request.previousError
      };

      const generationPrompt = await this.promptBuilder.buildPrompt(promptContext);
      logger.debug(`Built advanced prompt with ${generationPrompt.examples.length} examples`);

      // Step 4: Generate SQL (this would integrate with your existing AI service)
      // For now, we'll return a structured response that can be used by the AI service
      const response: EnhancedNLToSQLResponse = {
        sql: '', // This would be filled by the AI service
        explanation: '', // This would be filled by the AI service
        confidence: queryIntent.confidence,
        queryIntent,
        usedExamples: generationPrompt.examples,
        schemaContext: {
          relevantTables: schemaContext.relevantTables.map(t => t.columns?.[0]?.table_name || 'unknown'),
          suggestedJoins: schemaContext.smartTableSelection.suggestedJoins,
          columnMappings: schemaContext.columnMappings.slice(0, 10) // Top 10 most relevant
        },
        warnings: this.generateWarnings(queryIntent, schemaContext),
        suggestions: this.generateSuggestions(queryIntent, schemaContext)
      };

      logger.info(`Enhanced NL to SQL processing completed with ${response.confidence}% confidence`);
      return response;

    } catch (error) {
      logger.error('Enhanced NL to SQL processing failed:', error);
      throw error;
    }
  }

  /**
   * Generate warnings based on query analysis
   */
  private generateWarnings(queryIntent: any, schemaContext: any): string[] {
    const warnings: string[] = [];

    // Low confidence warning
    if (queryIntent.confidence < 70) {
      warnings.push('Query intent recognition has low confidence. Results may not be accurate.');
    }

    // Complex query warning
    if (queryIntent.complexity === 'complex') {
      warnings.push('This is a complex query that may require manual review.');
    }

    // No relevant tables warning
    if (schemaContext.smartTableSelection.primaryTables.length === 0) {
      warnings.push('No relevant tables found for this query. Please check your request.');
    }

    // Multiple table warning without clear relationships
    if (schemaContext.smartTableSelection.primaryTables.length > 1 && 
        schemaContext.smartTableSelection.suggestedJoins.length === 0) {
      warnings.push('Multiple tables detected but no clear relationships found. Manual JOIN specification may be needed.');
    }

    return warnings;
  }

  /**
   * Generate suggestions for query improvement
   */
  private generateSuggestions(queryIntent: any, schemaContext: any): string[] {
    const suggestions: string[] = [];

    // Suggest more specific queries
    if (queryIntent.type === 'select_all' && schemaContext.relevantTables.length > 0) {
      const table = schemaContext.smartTableSelection.primaryTables[0];
      suggestions.push(`Try being more specific, like "show me customers from New York" or "list products with price > 100"`);
    }

    // Suggest using relationships
    if (schemaContext.smartTableSelection.suggestedJoins.length > 0) {
      suggestions.push('Consider combining related data, like "customers with their orders" or "products with categories"');
    }

    // Suggest aggregation queries
    if (queryIntent.type === 'select_all' && schemaContext.relevantTables.length > 0) {
      suggestions.push('Try analytical queries like "total revenue by month" or "top 10 customers by orders"');
    }

    return suggestions;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    exampleStats: any;
    patternStats: any;
  } {
    return {
      exampleStats: this.exampleRepository.getStats(),
      patternStats: this.patternRecognizer.getPatternStats()
    };
  }

  /**
   * Update example quality based on user feedback
   */
  updateExampleQuality(exampleId: string, wasSuccessful: boolean): void {
    this.exampleRepository.updateExampleQuality(exampleId, wasSuccessful);
  }
}

// Export singleton instance
export const enhancedNLToSQLService = new EnhancedNLToSQLService();