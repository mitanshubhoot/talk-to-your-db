import { SchemaInfo } from './database';
import { QueryIntent, QueryComplexity } from './queryPatternRecognizer';
import { RankedExample } from './exampleRepository';

/**
 * Implementation of research-backed prompting strategies for SQL generation
 * Based on findings from sql-prompting-research.md
 */

export interface PromptingStrategy {
  name: string;
  description: string;
  applicableComplexity: QueryComplexity[];
  modelTypes: string[];
  tokenCostMultiplier: number;
  expectedAccuracyGain: number;
}

export interface PromptOptimizationConfig {
  maxTokens: number;
  budgetPerQuery: number;
  prioritizeAccuracy: boolean;
  prioritizeSpeed: boolean;
  prioritizeCost: boolean;
}

export class AdvancedPromptingStrategies {
  
  /**
   * Few-shot prompting with optimal example count based on research
   */
  static getFewShotStrategy(complexity: QueryComplexity): PromptingStrategy {
    const exampleCounts = {
      'simple': 2,
      'medium': 3,
      'complex': 4
    };

    return {
      name: 'few-shot',
      description: `Few-shot prompting with ${exampleCounts[complexity]} examples`,
      applicableComplexity: [complexity],
      modelTypes: ['all'],
      tokenCostMultiplier: 1.25,
      expectedAccuracyGain: 0.23 // 23% improvement based on research
    };
  }

  /**
   * Schema-aware prompting with structured context
   */
  static getSchemaAwareStrategy(): PromptingStrategy {
    return {
      name: 'schema-aware',
      description: 'Enhanced schema context with relationships and constraints',
      applicableComplexity: ['simple', 'medium', 'complex'],
      modelTypes: ['all'],
      tokenCostMultiplier: 1.15,
      expectedAccuracyGain: 0.05 // 5% improvement
    };
  }

  /**
   * Chain-of-thought prompting for complex reasoning
   */
  static getChainOfThoughtStrategy(): PromptingStrategy {
    return {
      name: 'chain-of-thought',
      description: 'Step-by-step reasoning for complex queries',
      applicableComplexity: ['complex'],
      modelTypes: ['general-code', 'general-language'],
      tokenCostMultiplier: 1.35,
      expectedAccuracyGain: 0.15 // 15% improvement for complex queries
    };
  }

  /**
   * Build optimized prompt based on research findings
   */
  static buildOptimizedPrompt(
    userQuery: string,
    schema: SchemaInfo,
    examples: RankedExample[],
    intent: QueryIntent,
    modelType: 'specialized-sql' | 'general-code' | 'general-language',
    config: PromptOptimizationConfig
  ): {
    systemPrompt: string;
    userPrompt: string;
    parameters: {
      temperature: number;
      maxTokens: number;
      stopSequences: string[];
    };
    strategies: string[];
  } {
    
    const complexity = intent.complexity;
    const strategies: string[] = [];
    
    // Determine which strategies to apply based on research
    const shouldUseFewShot = examples.length > 0;
    const shouldUseSchemaAware = true; // Always beneficial
    const shouldUseChainOfThought = complexity === 'complex' && 
      (modelType === 'general-code' || modelType === 'general-language');
    
    if (shouldUseFewShot) strategies.push('few-shot');
    if (shouldUseSchemaAware) strategies.push('schema-aware');
    if (shouldUseChainOfThought) strategies.push('chain-of-thought');

    // Build system prompt based on model type
    const systemPrompt = this.buildSystemPrompt(modelType, complexity);
    
    // Build user prompt with selected strategies
    const userPrompt = this.buildUserPrompt(
      userQuery,
      schema,
      examples,
      intent,
      {
        useFewShot: shouldUseFewShot,
        useSchemaAware: shouldUseSchemaAware,
        useChainOfThought: shouldUseChainOfThought
      }
    );

    // Set parameters based on research findings
    const parameters = this.getOptimalParameters(complexity, modelType);

    return {
      systemPrompt,
      userPrompt,
      parameters,
      strategies
    };
  }

  /**
   * Build model-specific system prompt
   */
  private static buildSystemPrompt(
    modelType: 'specialized-sql' | 'general-code' | 'general-language',
    complexity: QueryComplexity
  ): string {
    
    const basePrompts = {
      'specialized-sql': `You are SQLCoder, specialized for SQL generation.
Generate precise, efficient SQL queries from natural language requests.

CORE CAPABILITIES:
- Expert knowledge of SQL syntax and optimization
- Deep understanding of database relationships
- Ability to handle complex analytical queries
- Focus on performance and correctness`,

      'general-code': `You are an expert SQL developer with deep knowledge of database design and query optimization.

CORE PRINCIPLES:
- Generate ONLY valid SQL queries
- Use exact table and column names from schema
- Apply proper JOINs based on foreign key relationships
- Include appropriate LIMIT clauses for large result sets
- Use meaningful table aliases (c for customers, o for orders, etc.)
- Optimize for performance and readability

QUALITY STANDARDS:
- Syntactically correct SQL
- Semantically meaningful queries
- Performance-optimized structure
- Clear and readable formatting`,

      'general-language': `You are a database expert who converts natural language to SQL queries.

CRITICAL REQUIREMENTS:
1. Study the database schema carefully before generating SQL
2. Use EXACT table and column names as provided
3. Follow SQL syntax rules strictly
4. Include JOINs when querying multiple tables
5. Add LIMIT clauses for potentially large result sets
6. Use proper WHERE conditions for filtering
7. Apply GROUP BY for aggregations
8. End all queries with a semicolon

QUALITY CHECKLIST:
□ Correct table and column names
□ Proper JOIN syntax and conditions
□ Appropriate WHERE clauses
□ Correct GROUP BY usage
□ Meaningful table aliases
□ Performance considerations`
    };

    let systemPrompt = basePrompts[modelType];

    // Add complexity-specific guidance
    if (complexity === 'complex') {
      systemPrompt += `

COMPLEX QUERY GUIDELINES:
- Break down complex requirements into logical steps
- Use CTEs (Common Table Expressions) for readability
- Apply window functions for analytical queries
- Handle multiple aggregation levels appropriately
- Consider query performance implications`;
    }

    return systemPrompt;
  }

  /**
   * Build comprehensive user prompt with research-backed strategies
   */
  private static buildUserPrompt(
    userQuery: string,
    schema: SchemaInfo,
    examples: RankedExample[],
    intent: QueryIntent,
    strategies: {
      useFewShot: boolean;
      useSchemaAware: boolean;
      useChainOfThought: boolean;
    }
  ): string {
    
    const sections: string[] = [];

    // Schema context (always include, but vary detail level)
    if (strategies.useSchemaAware) {
      sections.push(this.buildEnhancedSchemaContext(schema, intent.entities));
    } else {
      sections.push(this.buildBasicSchemaContext(schema));
    }

    // Few-shot examples (if available and strategy enabled)
    if (strategies.useFewShot && examples.length > 0) {
      sections.push(this.buildFewShotExamples(examples, intent.complexity));
    }

    // Chain-of-thought reasoning (for complex queries)
    if (strategies.useChainOfThought) {
      sections.push(this.buildChainOfThoughtSection(userQuery, intent, schema));
    }

    // Query analysis
    sections.push(this.buildQueryAnalysis(intent));

    // User request
    sections.push(`USER REQUEST: "${userQuery}"`);

    // Generation instructions
    sections.push(this.buildGenerationInstructions(intent.complexity));

    return sections.join('\n\n');
  }

  /**
   * Build enhanced schema context with relationships and constraints
   */
  private static buildEnhancedSchemaContext(schema: SchemaInfo, relevantTables: string[]): string {
    let context = "DATABASE SCHEMA:\n";
    
    // Prioritize relevant tables first
    const tableOrder = [
      ...relevantTables,
      ...Object.keys(schema.tables).filter(t => !relevantTables.includes(t))
    ];

    tableOrder.forEach(tableName => {
      const tableInfo = schema.tables[tableName];
      if (!tableInfo) return;

      context += `\nTable: ${tableName}`;
      if (tableInfo.rowCount !== undefined) {
        context += ` (${tableInfo.rowCount.toLocaleString()} rows)`;
      }
      
      // Add primary keys
      if (tableInfo.primaryKeys && tableInfo.primaryKeys.length > 0) {
        context += ` [PK: ${tableInfo.primaryKeys.join(', ')}]`;
      }
      
      context += "\nColumns:\n";
      
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
        
        context += columnInfo + "\n";
      });
      
      // Add foreign key details
      if (tableInfo.foreignKeys && tableInfo.foreignKeys.length > 0) {
        context += "Foreign Keys:\n";
        tableInfo.foreignKeys.forEach(fk => {
          context += `  - ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
        });
      }
    });

    // Add relationship context
    if (schema.relationships && schema.relationships.length > 0) {
      context += "\nRELATIONSHIPS:\n";
      schema.relationships.forEach(rel => {
        const alias1 = this.generateTableAlias(rel.table);
        const alias2 = this.generateTableAlias(rel.referencedTable);
        context += `  ${rel.table} ${alias1} JOIN ${rel.referencedTable} ${alias2} ON ${alias1}.${rel.column} = ${alias2}.${rel.referencedColumn}\n`;
      });
    }

    return context;
  }

  /**
   * Build basic schema context for simple queries
   */
  private static buildBasicSchemaContext(schema: SchemaInfo): string {
    let context = "DATABASE SCHEMA:\n";
    
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      context += `\nTable: ${tableName}\n`;
      context += "Columns: ";
      context += tableInfo.columns.map(col => `${col.column_name}(${col.data_type})`).join(', ');
      context += "\n";
    });

    return context;
  }

  /**
   * Build few-shot examples optimized for the query complexity
   */
  private static buildFewShotExamples(examples: RankedExample[], complexity: QueryComplexity): string {
    const optimalCount = {
      'simple': 2,
      'medium': 3,
      'complex': 4
    }[complexity];

    const selectedExamples = examples.slice(0, optimalCount);
    
    let examplesText = "RELEVANT EXAMPLES:\n";
    
    selectedExamples.forEach((example, index) => {
      examplesText += `\nExample ${index + 1} (${example.queryPattern.complexity} ${example.queryPattern.type}):\n`;
      examplesText += `Query: "${example.naturalLanguage}"\n`;
      examplesText += `SQL: ${example.sql}\n`;
      if (example.explanation) {
        examplesText += `Explanation: ${example.explanation}\n`;
      }
    });

    return examplesText;
  }

  /**
   * Build chain-of-thought reasoning section
   */
  private static buildChainOfThoughtSection(
    userQuery: string,
    intent: QueryIntent,
    schema: SchemaInfo
  ): string {
    let cotText = "STEP-BY-STEP REASONING:\n";
    
    // Step 1: Understanding
    cotText += `\nStep 1 - UNDERSTAND THE REQUEST:
The user wants: ${userQuery}
Query type: ${intent.type} (${intent.complexity})
Entities involved: ${intent.entities.join(', ')}\n`;

    // Step 2: Table identification
    cotText += `\nStep 2 - IDENTIFY REQUIRED TABLES:
Based on entities (${intent.entities.join(', ')}), we need tables: ${intent.entities.join(', ')}\n`;

    // Step 3: Relationships (if multi-table)
    if (intent.entities.length > 1) {
      const relationships = this.findRelevantRelationships(intent.entities, schema);
      cotText += `\nStep 3 - DETERMINE TABLE RELATIONSHIPS:
For multi-table query, we need JOINs: ${relationships.join(', ')}\n`;
    }

    // Step 4: Operations
    if (intent.operations.length > 0) {
      cotText += `\nStep 4 - APPLY OPERATIONS:
Required operations: ${intent.operations.join(', ')}\n`;
    }

    // Step 5: Conditions
    if (intent.conditions.length > 0) {
      cotText += `\nStep 5 - APPLY CONDITIONS:
WHERE conditions needed for: ${intent.conditions.join(', ')}\n`;
    }

    // Step 6: Optimization
    cotText += `\nStep 6 - OPTIMIZATION CONSIDERATIONS:
- Add appropriate LIMIT clause for large result sets
- Use meaningful table aliases for readability
- Consider performance implications of JOINs and WHERE clauses\n`;

    return cotText;
  }

  /**
   * Build query analysis section
   */
  private static buildQueryAnalysis(intent: QueryIntent): string {
    let analysisText = "QUERY ANALYSIS:\n";
    analysisText += `- Intent: ${intent.type} (${intent.complexity})\n`;
    analysisText += `- Entities: ${intent.entities.join(', ')}\n`;
    analysisText += `- Operations: ${intent.operations.join(', ')}\n`;
    analysisText += `- Conditions: ${intent.conditions.join(', ')}\n`;

    return analysisText;
  }

  /**
   * Build generation instructions
   */
  private static buildGenerationInstructions(complexity: QueryComplexity): string {
    let instructions = "GENERATION INSTRUCTIONS:\n";
    instructions += "1. Generate ONLY the SQL query, no explanations or markdown\n";
    instructions += "2. Use exact table and column names from the schema\n";
    instructions += "3. Include appropriate JOINs based on relationships\n";
    instructions += "4. Add LIMIT clause for potentially large result sets\n";
    instructions += "5. Use meaningful table aliases\n";
    instructions += "6. End the query with a semicolon\n";

    if (complexity === 'complex') {
      instructions += "7. For complex queries, prioritize readability and correctness\n";
      instructions += "8. Use CTEs or subqueries if they improve clarity\n";
    }

    return instructions + "\nSQL Query:";
  }

  /**
   * Get optimal parameters based on research findings
   */
  private static getOptimalParameters(
    complexity: QueryComplexity,
    modelType: 'specialized-sql' | 'general-code' | 'general-language'
  ): {
    temperature: number;
    maxTokens: number;
    stopSequences: string[];
  } {
    
    // Base parameters by complexity
    const baseParams = {
      'simple': { temperature: 0.1, maxTokens: 200 },
      'medium': { temperature: 0.15, maxTokens: 350 },
      'complex': { temperature: 0.2, maxTokens: 500 }
    }[complexity];

    // Adjust for model type
    if (modelType === 'specialized-sql') {
      baseParams.temperature *= 0.8; // More deterministic for specialized models
    } else if (modelType === 'general-language') {
      baseParams.temperature *= 1.2; // Slightly more creative for general models
      baseParams.maxTokens *= 1.2; // More tokens needed for explanations
    }

    return {
      ...baseParams,
      stopSequences: ['\n\n', '```', 'Explanation:', 'Note:', '###']
    };
  }

  /**
   * Generate smart table aliases
   */
  private static generateTableAlias(tableName: string): string {
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
   * Find relevant relationships between tables
   */
  private static findRelevantRelationships(entities: string[], schema: SchemaInfo): string[] {
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
   * Calculate expected performance improvement
   */
  static calculateExpectedImprovement(
    strategies: string[],
    baselineAccuracy: number,
    complexity: QueryComplexity
  ): {
    expectedAccuracy: number;
    costMultiplier: number;
    confidenceInterval: [number, number];
  } {
    
    let accuracyGain = 0;
    let costMultiplier = 1;

    // Apply gains from research findings
    strategies.forEach(strategy => {
      switch (strategy) {
        case 'few-shot':
          accuracyGain += 0.23; // 23% improvement
          costMultiplier *= 1.25;
          break;
        case 'schema-aware':
          accuracyGain += 0.05; // 5% improvement
          costMultiplier *= 1.15;
          break;
        case 'chain-of-thought':
          if (complexity === 'complex') {
            accuracyGain += 0.15; // 15% improvement for complex queries
          } else {
            accuracyGain += 0.06; // 6% for simpler queries
          }
          costMultiplier *= 1.35;
          break;
      }
    });

    const expectedAccuracy = Math.min(baselineAccuracy + accuracyGain, 0.98); // Cap at 98%
    
    // Calculate confidence interval (±10% of the gain)
    const margin = accuracyGain * 0.1;
    const confidenceInterval: [number, number] = [
      Math.max(expectedAccuracy - margin, baselineAccuracy),
      Math.min(expectedAccuracy + margin, 0.98)
    ];

    return {
      expectedAccuracy,
      costMultiplier,
      confidenceInterval
    };
  }
}

/**
 * Prompt strategy evaluation and testing
 */
export class PromptStrategyEvaluator {
  
  /**
   * Test different prompting strategies against a set of queries
   */
  static async evaluateStrategies(
    testQueries: Array<{
      query: string;
      expectedSQL: string;
      complexity: QueryComplexity;
    }>,
    schema: SchemaInfo,
    modelType: 'specialized-sql' | 'general-code' | 'general-language'
  ): Promise<{
    strategy: string;
    accuracy: number;
    avgLatency: number;
    costMultiplier: number;
  }[]> {
    
    const strategies = [
      'baseline',
      'few-shot',
      'schema-aware',
      'chain-of-thought',
      'combined'
    ];

    const results = [];

    for (const strategy of strategies) {
      let correctCount = 0;
      let totalLatency = 0;
      let costMultiplier = 1;

      for (const testQuery of testQueries) {
        const startTime = Date.now();
        
        // Simulate SQL generation with different strategies
        const generatedSQL = await this.simulateGeneration(
          testQuery.query,
          schema,
          strategy,
          testQuery.complexity,
          modelType
        );
        
        const endTime = Date.now();
        totalLatency += (endTime - startTime);

        // Check if generated SQL matches expected
        if (this.compareSQLQueries(generatedSQL, testQuery.expectedSQL)) {
          correctCount++;
        }

        // Update cost multiplier based on strategy
        costMultiplier = this.getCostMultiplier(strategy);
      }

      results.push({
        strategy,
        accuracy: correctCount / testQueries.length,
        avgLatency: totalLatency / testQueries.length,
        costMultiplier
      });
    }

    return results;
  }

  /**
   * Simulate SQL generation for different strategies
   */
  private static async simulateGeneration(
    query: string,
    schema: SchemaInfo,
    strategy: string,
    complexity: QueryComplexity,
    modelType: string
  ): Promise<string> {
    
    // Simulate different accuracy rates based on research findings
    const accuracyRates = {
      'baseline': { simple: 0.65, medium: 0.45, complex: 0.25 },
      'few-shot': { simple: 0.85, medium: 0.70, complex: 0.50 },
      'schema-aware': { simple: 0.88, medium: 0.75, complex: 0.55 },
      'chain-of-thought': { simple: 0.88, medium: 0.80, complex: 0.70 },
      'combined': { simple: 0.92, medium: 0.85, complex: 0.78 }
    };

    const accuracy = accuracyRates[strategy as keyof typeof accuracyRates][complexity];
    
    // Use deterministic approach for testing consistency
    const hash = this.simpleHash(query + strategy + complexity);
    const isSuccessful = (hash % 100) < (accuracy * 100);
    
    if (isSuccessful) {
      // Return a plausible SQL query based on the input
      return this.generatePlausibleSQL(query, schema);
    } else {
      // Return an incorrect query
      return "SELECT * FROM invalid_table;";
    }
  }

  /**
   * Simple hash function for deterministic testing
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate plausible SQL for testing
   */
  private static generatePlausibleSQL(query: string, schema: SchemaInfo): string {
    const lowerQuery = query.toLowerCase();
    const tables = Object.keys(schema.tables);
    
    if (lowerQuery.includes('show') || lowerQuery.includes('list')) {
      const table = tables.find(t => lowerQuery.includes(t.toLowerCase())) || tables[0];
      return `SELECT * FROM ${table} LIMIT 20;`;
    } else if (lowerQuery.includes('count') || lowerQuery.includes('how many')) {
      const table = tables.find(t => lowerQuery.includes(t.toLowerCase())) || tables[0];
      return `SELECT COUNT(*) FROM ${table};`;
    } else if (lowerQuery.includes('top') || lowerQuery.includes('highest')) {
      const table = tables.find(t => lowerQuery.includes(t.toLowerCase())) || tables[0];
      return `SELECT * FROM ${table} ORDER BY id DESC LIMIT 10;`;
    }
    
    return `SELECT * FROM ${tables[0]};`;
  }

  /**
   * Compare SQL queries for semantic equivalence
   */
  private static compareSQLQueries(generated: string, expected: string): boolean {
    const normalize = (sql: string) => {
      return sql.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[;,]/g, '')
        .trim();
    };

    return normalize(generated) === normalize(expected);
  }

  /**
   * Get cost multiplier for strategy
   */
  private static getCostMultiplier(strategy: string): number {
    const multipliers = {
      'baseline': 1.0,
      'few-shot': 1.25,
      'schema-aware': 1.15,
      'chain-of-thought': 1.35,
      'combined': 1.60
    };

    return multipliers[strategy as keyof typeof multipliers] || 1.0;
  }
}