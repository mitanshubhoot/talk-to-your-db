import { createLogger, format, transports } from 'winston';
import { SchemaInfo } from './database';
import { ExampleRepository, ExampleSelectionCriteria, RankedExample } from './exampleRepository';
import { QueryPatternRecognizer, QueryIntent, QueryComplexity } from './queryPatternRecognizer';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface PromptContext {
  naturalLanguageQuery: string;
  schemaContext: SchemaInfo;
  databaseDialect: string;
  queryIntent: QueryIntent;
  complexity: QueryComplexity;
  userPreferences?: UserPreferences;
  retryAttempt?: number;
  previousError?: string;
}

export interface UserPreferences {
  preferredLimit: number;
  includeExplanations: boolean;
  verboseOutput: boolean;
  optimizeForPerformance: boolean;
}

export interface GenerationPrompt {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  stopSequences: string[];
  examples: RankedExample[];
}

export interface ChainOfThoughtStep {
  step: number;
  title: string;
  reasoning: string;
  sqlFragment?: string;
  confidence: number;
}

export class AdvancedPromptBuilder {
  private exampleRepository: ExampleRepository;
  private patternRecognizer: QueryPatternRecognizer;

  constructor(exampleRepository: ExampleRepository, patternRecognizer: QueryPatternRecognizer) {
    this.exampleRepository = exampleRepository;
    this.patternRecognizer = patternRecognizer;
  }

  /**
   * Build a comprehensive prompt for SQL generation
   */
  async buildPrompt(context: PromptContext): Promise<GenerationPrompt> {
    const systemPrompt = this.buildSystemPrompt(context);
    const examples = await this.selectRelevantExamples(context);
    const userPrompt = await this.buildUserPrompt(context, examples);
    
    const generationParams = this.getGenerationParameters(context);

    logger.debug(`Built prompt for query: "${context.naturalLanguageQuery}" with ${examples.length} examples`);

    return {
      systemPrompt,
      userPrompt,
      examples,
      ...generationParams
    };
  }

  /**
   * Build system prompt with role definition and guidelines
   */
  private buildSystemPrompt(context: PromptContext): string {
    const baseSystemPrompt = `You are an expert SQL developer with deep knowledge of database design, query optimization, and ${context.databaseDialect} syntax.

CORE RESPONSIBILITIES:
- Generate precise, efficient SQL queries from natural language requests
- Use exact table and column names from the provided schema
- Apply proper JOINs based on foreign key relationships
- Optimize queries for performance and readability
- Handle edge cases and potential data issues gracefully

QUALITY STANDARDS:
- Generate ONLY valid SQL queries, no explanations in the SQL output
- Use meaningful table aliases (c for customers, o for orders, p for products, etc.)
- Include appropriate LIMIT clauses for potentially large result sets
- Use proper NULL handling with IS NOT NULL where needed
- Apply case-insensitive matching with ILIKE (PostgreSQL) or equivalent
- Group by all non-aggregated columns in aggregate queries
- Use window functions for ranking and analytics when appropriate`;

    // Add dialect-specific guidelines
    const dialectGuidelines = this.getDialectSpecificGuidelines(context.databaseDialect);
    
    // Add complexity-specific guidelines
    const complexityGuidelines = this.getComplexityGuidelines(context.complexity);
    
    // Add retry-specific guidelines if this is a retry attempt
    const retryGuidelines = context.retryAttempt ? this.getRetryGuidelines(context) : '';

    return [baseSystemPrompt, dialectGuidelines, complexityGuidelines, retryGuidelines]
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Get database dialect-specific guidelines
   */
  private getDialectSpecificGuidelines(dialect: string): string {
    const guidelines: Record<string, string> = {
      postgresql: `POSTGRESQL-SPECIFIC GUIDELINES:
- Use ILIKE for case-insensitive pattern matching
- Use DATE_TRUNC('month', date_column) for date grouping
- Use INTERVAL '1 month' for date arithmetic
- Use COALESCE(column, default_value) for NULL handling
- Use window functions: ROW_NUMBER() OVER(), RANK() OVER(), etc.
- Use LIMIT and OFFSET for pagination
- Use || for string concatenation
- Use EXTRACT(year FROM date_column) for date parts`,

      mysql: `MYSQL-SPECIFIC GUIDELINES:
- Use LIKE with LOWER() for case-insensitive matching
- Use DATE_FORMAT(date_column, '%Y-%m') for date formatting
- Use IFNULL(column, default_value) for NULL handling
- Use LIMIT with OFFSET for pagination
- Use CONCAT() for string concatenation
- Use YEAR(date_column), MONTH(date_column) for date parts`,

      sqlite: `SQLITE-SPECIFIC GUIDELINES:
- Use LIKE with LOWER() for case-insensitive matching
- Use strftime('%Y-%m', date_column) for date formatting
- Use COALESCE(column, default_value) for NULL handling
- Limited window function support (use subqueries if needed)
- Use LIMIT with OFFSET for pagination
- Use || for string concatenation`,

      mssql: `SQL SERVER-SPECIFIC GUIDELINES:
- Use LIKE with LOWER() for case-insensitive matching
- Use FORMAT(date_column, 'yyyy-MM') for date formatting
- Use ISNULL(column, default_value) for NULL handling
- Use TOP N or OFFSET/FETCH for limiting results
- Use + for string concatenation
- Use YEAR(date_column), MONTH(date_column) for date parts`
    };

    return guidelines[dialect.toLowerCase()] || guidelines.postgresql;
  }

  /**
   * Get complexity-specific guidelines
   */
  private getComplexityGuidelines(complexity: QueryComplexity): string {
    switch (complexity) {
      case 'simple':
        return `SIMPLE QUERY GUIDELINES:
- Focus on single table operations or basic JOINs
- Use straightforward WHERE clauses
- Apply basic sorting and limiting
- Prioritize readability and clarity`;

      case 'medium':
        return `MEDIUM COMPLEXITY GUIDELINES:
- Handle multi-table JOINs with proper relationship mapping
- Use aggregate functions (COUNT, SUM, AVG) with GROUP BY
- Apply multiple filtering conditions with AND/OR logic
- Use subqueries when beneficial for clarity
- Consider performance implications of JOINs`;

      case 'complex':
        return `COMPLEX QUERY GUIDELINES:
- Use advanced SQL features: CTEs, window functions, subqueries
- Handle complex business logic with CASE statements
- Apply sophisticated filtering and grouping
- Use analytical functions for rankings and comparisons
- Optimize for performance with proper indexing considerations
- Break down complex logic into readable components`;

      default:
        return '';
    }
  }

  /**
   * Get retry-specific guidelines when previous attempt failed
   */
  private getRetryGuidelines(context: PromptContext): string {
    if (!context.previousError) return '';

    let retryGuidelines = `RETRY ATTEMPT - PREVIOUS ERROR ANALYSIS:
Previous error: ${context.previousError}

CORRECTIVE ACTIONS:`;

    if (context.previousError.includes('syntax error')) {
      retryGuidelines += `
- Double-check SQL syntax, especially parentheses, commas, and keywords
- Ensure proper table and column name quoting if needed
- Verify JOIN syntax and ON conditions`;
    }

    if (context.previousError.includes('column') && context.previousError.includes('does not exist')) {
      retryGuidelines += `
- Use EXACT column names from the provided schema
- Check for typos in column references
- Ensure all columns in SELECT are available in the FROM/JOIN tables`;
    }

    if (context.previousError.includes('table') && context.previousError.includes('does not exist')) {
      retryGuidelines += `
- Use EXACT table names from the provided schema
- Check for typos in table references
- Ensure all referenced tables exist in the schema`;
    }

    if (context.previousError.includes('GROUP BY')) {
      retryGuidelines += `
- Include ALL non-aggregated columns in GROUP BY clause
- Ensure aggregate functions (COUNT, SUM, AVG) are used properly
- Check that SELECT columns match GROUP BY columns`;
    }

    return retryGuidelines;
  }

  /**
   * Select relevant examples for few-shot prompting
   */
  private async selectRelevantExamples(context: PromptContext): Promise<RankedExample[]> {
    const criteria: ExampleSelectionCriteria = {
      userQuery: context.naturalLanguageQuery,
      schemaContext: context.schemaContext,
      maxExamples: this.getOptimalExampleCount(context.complexity),
      minSimilarityScore: 0.1, // Allow some diversity
      preferredPatterns: this.getPreferredPatterns(context.queryIntent)
    };

    return this.exampleRepository.selectExamples(criteria);
  }

  /**
   * Get optimal number of examples based on query complexity
   */
  private getOptimalExampleCount(complexity: QueryComplexity): number {
    switch (complexity) {
      case 'simple': return 2;
      case 'medium': return 3;
      case 'complex': return 4;
      default: return 3;
    }
  }

  /**
   * Get preferred patterns based on query intent
   */
  private getPreferredPatterns(intent: QueryIntent): string[] {
    const patterns: string[] = [];
    
    patterns.push(`${intent.type}_${intent.complexity}`);
    patterns.push(intent.type);
    
    // Add table-specific patterns
    intent.entities.forEach(entity => {
      patterns.push(`table_${entity}`);
    });

    return patterns;
  }

  /**
   * Build comprehensive user prompt
   */
  private async buildUserPrompt(context: PromptContext, examples: RankedExample[]): Promise<string> {
    const sections: string[] = [];

    // Schema context
    sections.push(this.buildSchemaSection(context.schemaContext));

    // Relationship context
    sections.push(this.buildRelationshipSection(context.schemaContext));

    // Few-shot examples
    if (examples.length > 0) {
      sections.push(this.buildExamplesSection(examples));
    }

    // Chain of thought for complex queries
    if (context.complexity === 'complex' || this.shouldUseChainOfThought(context)) {
      const chainOfThought = await this.generateChainOfThought(context);
      sections.push(this.buildChainOfThoughtSection(chainOfThought));
    }

    // Query analysis
    sections.push(this.buildQueryAnalysisSection(context));

    // User request
    sections.push(`USER REQUEST: "${context.naturalLanguageQuery}"`);

    // Generation instructions
    sections.push(this.buildGenerationInstructions(context));

    return sections.join('\n\n');
  }

  /**
   * Build schema context section
   */
  private buildSchemaSection(schema: SchemaInfo): string {
    let schemaText = "DATABASE SCHEMA:\n";
    
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      schemaText += `\nTable: ${tableName}`;
      if (tableInfo.rowCount !== undefined) {
        schemaText += ` (${tableInfo.rowCount.toLocaleString()} rows)`;
      }
      
      // Add primary keys
      if (tableInfo.primaryKeys && tableInfo.primaryKeys.length > 0) {
        schemaText += ` [PK: ${tableInfo.primaryKeys.join(', ')}]`;
      }
      
      schemaText += "\nColumns:\n";
      
      tableInfo.columns.forEach(col => {
        let columnInfo = `  - ${col.column_name}: ${col.data_type}`;
        
        // Add constraints
        const constraints = [];
        if (col.is_primary_key) constraints.push('PK');
        if (col.is_foreign_key) constraints.push('FK');
        if (col.is_nullable === 'NO') constraints.push('NOT NULL');
        if (constraints.length > 0) {
          columnInfo += ` [${constraints.join(', ')}]`;
        }
        
        schemaText += columnInfo + "\n";
      });
      
      // Add foreign key details
      if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
        schemaText += "Foreign Keys:\n";
        tableInfo.foreignKeys.forEach(fk => {
          schemaText += `  - ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
        });
      }
    });

    return schemaText;
  }

  /**
   * Build relationship context section
   */
  private buildRelationshipSection(schema: SchemaInfo): string {
    if (!schema.relationships || schema.relationships.length === 0) {
      return "RELATIONSHIPS: No foreign key relationships found.";
    }
    
    let relationshipText = "RELATIONSHIPS:\n";
    
    // Group relationships by table pairs for better readability
    const relationshipGroups = new Map<string, string[]>();
    
    schema.relationships.forEach(rel => {
      const key = `${rel.table}-${rel.referencedTable}`;
      if (!relationshipGroups.has(key)) {
        relationshipGroups.set(key, []);
      }
      relationshipGroups.get(key)!.push(`${rel.column} → ${rel.referencedColumn}`);
    });

    relationshipGroups.forEach((columns, tableKey) => {
      const [table, referencedTable] = tableKey.split('-');
      relationshipText += `  ${table} → ${referencedTable}: ${columns.join(', ')}\n`;
    });

    // Add suggested JOIN patterns
    relationshipText += "\nSUGGESTED JOIN PATTERNS:\n";
    schema.relationships.forEach(rel => {
      const alias1 = this.generateTableAlias(rel.table);
      const alias2 = this.generateTableAlias(rel.referencedTable);
      relationshipText += `  ${rel.table} ${alias1} JOIN ${rel.referencedTable} ${alias2} ON ${alias1}.${rel.column} = ${alias2}.${rel.referencedColumn}\n`;
    });

    return relationshipText;
  }

  /**
   * Generate smart table aliases
   */
  private generateTableAlias(tableName: string): string {
    // Common table patterns
    const aliasMap: Record<string, string> = {
      'customers': 'c',
      'orders': 'o',
      'order_items': 'oi',
      'products': 'p',
      'users': 'u',
      'categories': 'cat',
      'payments': 'pay',
      'addresses': 'addr',
      'invoices': 'inv',
      'items': 'i'
    };

    if (aliasMap[tableName]) {
      return aliasMap[tableName];
    }

    // Generate alias from first letters of words
    const words = tableName.split('_');
    return words.map(word => word.charAt(0)).join('').toLowerCase();
  }

  /**
   * Build examples section for few-shot prompting
   */
  private buildExamplesSection(examples: RankedExample[]): string {
    let examplesText = "RELEVANT EXAMPLES:\n";
    
    examples.forEach((example, index) => {
      examplesText += `\nExample ${index + 1} (${example.queryPattern.complexity} ${example.queryPattern.type}, similarity: ${(example.similarityScore * 100).toFixed(0)}%):\n`;
      examplesText += `Query: "${example.naturalLanguage}"\n`;
      examplesText += `SQL: ${example.sql}\n`;
      examplesText += `Explanation: ${example.explanation}\n`;
    });

    return examplesText;
  }

  /**
   * Determine if chain-of-thought reasoning should be used
   */
  private shouldUseChainOfThought(context: PromptContext): boolean {
    const query = context.naturalLanguageQuery.toLowerCase();
    
    // Use chain-of-thought for complex analytical queries
    return query.includes('compare') ||
           query.includes('analyze') ||
           query.includes('breakdown') ||
           query.includes('trend') ||
           query.includes('vs') ||
           query.includes('versus') ||
           (context.queryIntent.entities.length > 2) ||
           ((context.retryAttempt || 0) > 1);
  }

  /**
   * Generate chain-of-thought reasoning steps
   */
  private async generateChainOfThought(context: PromptContext): Promise<ChainOfThoughtStep[]> {
    const steps: ChainOfThoughtStep[] = [];
    const query = context.naturalLanguageQuery.toLowerCase();
    const intent = context.queryIntent;

    // Step 1: Understanding the request
    steps.push({
      step: 1,
      title: "Understanding the Request",
      reasoning: `The user wants: ${context.naturalLanguageQuery}. This is a ${intent.complexity} ${intent.type} query involving ${intent.entities.join(', ')}.`,
      confidence: 95
    });

    // Step 2: Identify required tables
    steps.push({
      step: 2,
      title: "Identifying Required Tables",
      reasoning: `Based on the entities mentioned (${intent.entities.join(', ')}), we need to query: ${intent.entities.join(', ')} tables.`,
      confidence: 90
    });

    // Step 3: Determine relationships (if multi-table)
    if (intent.entities.length > 1) {
      const relationships = this.findRelevantRelationships(intent.entities, context.schemaContext);
      steps.push({
        step: 3,
        title: "Determining Table Relationships",
        reasoning: `For multi-table query, we need JOINs: ${relationships.join(', ')}`,
        confidence: 85
      });
    }

    // Step 4: Apply filters
    if (intent.conditions.length > 0) {
      steps.push({
        step: 4,
        title: "Applying Filters",
        reasoning: `WHERE conditions needed for: ${intent.conditions.join(', ')}`,
        confidence: 80
      });
    }

    // Step 5: Handle aggregation
    if (intent.operations.some(op => ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'].includes(op))) {
      steps.push({
        step: 5,
        title: "Handling Aggregation",
        reasoning: `Aggregate functions needed: ${intent.operations.filter(op => ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'].includes(op)).join(', ')}. GROUP BY required for non-aggregated columns.`,
        confidence: 75
      });
    }

    // Step 6: Sorting and limiting
    steps.push({
      step: 6,
      title: "Sorting and Limiting Results",
      reasoning: this.getSortingReasoning(query),
      confidence: 85
    });

    return steps;
  }

  /**
   * Find relevant relationships between tables
   */
  private findRelevantRelationships(entities: string[], schema: SchemaInfo): string[] {
    const relationships: string[] = [];
    
    if (schema.relationships) {
      schema.relationships.forEach(rel => {
        if (entities.includes(rel.table) && entities.includes(rel.referencedTable)) {
          relationships.push(`${rel.table}.${rel.column} = ${rel.referencedTable}.${rel.referencedColumn}`);
        }
      });
    }

    return relationships;
  }

  /**
   * Get sorting reasoning based on query
   */
  private getSortingReasoning(query: string): string {
    if (query.includes('top') || query.includes('highest') || query.includes('best')) {
      return 'ORDER BY DESC with LIMIT for top results';
    }
    if (query.includes('bottom') || query.includes('lowest') || query.includes('worst')) {
      return 'ORDER BY ASC with LIMIT for bottom results';
    }
    if (query.includes('recent') || query.includes('latest')) {
      return 'ORDER BY date DESC for most recent';
    }
    if (query.includes('oldest') || query.includes('first')) {
      return 'ORDER BY date ASC for oldest';
    }
    
    return 'ORDER BY appropriate column for consistent results, add LIMIT to prevent large result sets';
  }

  /**
   * Build chain-of-thought section
   */
  private buildChainOfThoughtSection(steps: ChainOfThoughtStep[]): string {
    let cotText = "STEP-BY-STEP REASONING:\n";
    
    steps.forEach(step => {
      cotText += `\nStep ${step.step} - ${step.title.toUpperCase()}:\n`;
      cotText += `${step.reasoning}\n`;
      if (step.sqlFragment) {
        cotText += `SQL Fragment: ${step.sqlFragment}\n`;
      }
      cotText += `Confidence: ${step.confidence}%\n`;
    });

    return cotText;
  }

  /**
   * Build query analysis section
   */
  private buildQueryAnalysisSection(context: PromptContext): string {
    const intent = context.queryIntent;
    
    let analysisText = "QUERY ANALYSIS:\n";
    analysisText += `- Intent: ${intent.type} (${intent.complexity})\n`;
    analysisText += `- Entities: ${intent.entities.join(', ')}\n`;
    analysisText += `- Operations: ${intent.operations.join(', ')}\n`;
    analysisText += `- Conditions: ${intent.conditions.join(', ')}\n`;
    analysisText += `- Database: ${context.databaseDialect}\n`;

    return analysisText;
  }

  /**
   * Build generation instructions
   */
  private buildGenerationInstructions(context: PromptContext): string {
    let instructions = "GENERATION INSTRUCTIONS:\n";
    instructions += "1. Generate ONLY the SQL query, no explanations or markdown\n";
    instructions += "2. Use exact table and column names from the schema\n";
    instructions += "3. Include appropriate JOINs based on relationships\n";
    instructions += "4. Add LIMIT clause for potentially large result sets\n";
    instructions += "5. Use meaningful table aliases\n";
    instructions += "6. End the query with a semicolon\n";

    if (context.retryAttempt) {
      instructions += `7. CRITICAL: Fix the previous error: ${context.previousError}\n`;
    }

    if (context.userPreferences?.optimizeForPerformance) {
      instructions += "8. Optimize for performance (use indexes, avoid SELECT *)\n";
    }

    return instructions + "\nSQL Query:";
  }

  /**
   * Get generation parameters based on context
   */
  private getGenerationParameters(context: PromptContext): {
    temperature: number;
    maxTokens: number;
    stopSequences: string[];
  } {
    // Lower temperature for more deterministic SQL generation
    let temperature = 0.1;
    
    // Increase temperature slightly for complex queries to allow creativity
    if (context.complexity === 'complex') {
      temperature = 0.2;
    }

    // Reduce temperature for retry attempts to be more conservative
    if (context.retryAttempt && context.retryAttempt > 1) {
      temperature = 0.05;
    }

    return {
      temperature,
      maxTokens: 500, // Sufficient for most SQL queries
      stopSequences: ['\n\n', '```', 'Explanation:', 'Note:']
    };
  }
}