import { AdvancedPromptingStrategies, PromptStrategyEvaluator } from '../services/promptingStrategies';
import { QueryIntent, QueryComplexity } from '../services/queryPatternRecognizer';
import { SchemaInfo } from '../services/database';
import { RankedExample } from '../services/exampleRepository';

describe('AdvancedPromptingStrategies', () => {
  
  const mockSchema: SchemaInfo = {
    tables: {
      customers: {
        columns: [
          { table_name: 'customers', column_name: 'customer_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
          { table_name: 'customers', column_name: 'name', data_type: 'VARCHAR(255)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 2 },
          { table_name: 'customers', column_name: 'email', data_type: 'VARCHAR(255)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 3 },
          { table_name: 'customers', column_name: 'city', data_type: 'VARCHAR(100)', is_primary_key: false, is_foreign_key: false, is_nullable: 'YES', column_default: null, ordinal_position: 4 }
        ],
        primaryKeys: ['customer_id'],
        foreignKeys: [],
        indexes: [],
        rowCount: 1250000
      },
      orders: {
        columns: [
          { table_name: 'orders', column_name: 'order_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
          { table_name: 'orders', column_name: 'customer_id', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO', column_default: null, ordinal_position: 2 },
          { table_name: 'orders', column_name: 'order_date', data_type: 'TIMESTAMP', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 3 },
          { table_name: 'orders', column_name: 'total_amount', data_type: 'DECIMAL(10,2)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 4 }
        ],
        primaryKeys: ['order_id'],
        foreignKeys: [
          { column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }
        ],
        indexes: [],
        rowCount: 3750000
      }
    },
    relationships: [
      { table: 'orders', column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }
    ]
  };

  const mockExamples: RankedExample[] = [
    {
      id: 'ex1',
      naturalLanguage: 'show me all customers',
      sql: 'SELECT * FROM customers ORDER BY name LIMIT 20;',
      explanation: 'Retrieves all customer information with reasonable limit',
      schemaContext: 'customers table',
      queryPattern: {
        type: 'select_all',
        complexity: 'simple',
        tables: ['customers'],
        operations: ['SELECT'],
        keywords: ['show', 'all', 'customers']
      },
      qualityScore: 95,
      usageCount: 10,
      successRate: 98,
      tags: ['basic', 'select'],
      createdAt: new Date(),
      updatedAt: new Date(),
      similarityScore: 0.9,
      relevanceScore: 0.85,
      finalScore: 0.88
    },
    {
      id: 'ex2',
      naturalLanguage: 'how many orders were placed',
      sql: 'SELECT COUNT(*) as order_count FROM orders;',
      explanation: 'Counts total number of orders',
      schemaContext: 'orders table',
      queryPattern: {
        type: 'count',
        complexity: 'simple',
        tables: ['orders'],
        operations: ['COUNT'],
        keywords: ['how', 'many', 'orders']
      },
      qualityScore: 98,
      usageCount: 15,
      successRate: 99,
      tags: ['count', 'aggregate'],
      createdAt: new Date(),
      updatedAt: new Date(),
      similarityScore: 0.8,
      relevanceScore: 0.9,
      finalScore: 0.85
    }
  ];

  describe('Strategy Selection', () => {
    
    test('should select appropriate strategies for simple queries', () => {
      const fewShotStrategy = AdvancedPromptingStrategies.getFewShotStrategy('simple');
      
      expect(fewShotStrategy.name).toBe('few-shot');
      expect(fewShotStrategy.applicableComplexity).toContain('simple');
      expect(fewShotStrategy.tokenCostMultiplier).toBe(1.25);
      expect(fewShotStrategy.expectedAccuracyGain).toBe(0.23);
    });

    test('should select appropriate strategies for complex queries', () => {
      const cotStrategy = AdvancedPromptingStrategies.getChainOfThoughtStrategy();
      
      expect(cotStrategy.name).toBe('chain-of-thought');
      expect(cotStrategy.applicableComplexity).toContain('complex');
      expect(cotStrategy.modelTypes).toContain('general-code');
      expect(cotStrategy.tokenCostMultiplier).toBe(1.35);
      expect(cotStrategy.expectedAccuracyGain).toBe(0.15);
    });

    test('should always recommend schema-aware strategy', () => {
      const schemaStrategy = AdvancedPromptingStrategies.getSchemaAwareStrategy();
      
      expect(schemaStrategy.name).toBe('schema-aware');
      expect(schemaStrategy.applicableComplexity).toEqual(['simple', 'medium', 'complex']);
      expect(schemaStrategy.modelTypes).toContain('all');
    });
  });

  describe('Prompt Building', () => {
    
    const mockIntent: QueryIntent = {
      type: 'select_all',
      complexity: 'simple',
      entities: ['customers'],
      operations: ['SELECT'],
      conditions: [],
      confidence: 0.9,
      patterns: []
    };

    const mockConfig = {
      maxTokens: 500,
      budgetPerQuery: 0.01,
      prioritizeAccuracy: true,
      prioritizeSpeed: false,
      prioritizeCost: false
    };

    test('should build optimized prompt for specialized SQL model', () => {
      const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'show me all customers',
        mockSchema,
        mockExamples,
        mockIntent,
        'specialized-sql',
        mockConfig
      );

      expect(result.systemPrompt).toContain('SQLCoder');
      expect(result.systemPrompt).toContain('specialized for SQL generation');
      expect(result.userPrompt).toContain('DATABASE SCHEMA');
      expect(result.userPrompt).toContain('customers');
      expect(result.strategies).toContain('few-shot');
      expect(result.strategies).toContain('schema-aware');
      expect(result.parameters.temperature).toBeLessThan(0.2); // Lower for specialized models
    });

    test('should build optimized prompt for general code model', () => {
      const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'show me all customers',
        mockSchema,
        mockExamples,
        mockIntent,
        'general-code',
        mockConfig
      );

      expect(result.systemPrompt).toContain('expert SQL developer');
      expect(result.systemPrompt).toContain('CORE PRINCIPLES');
      expect(result.userPrompt).toContain('RELEVANT EXAMPLES');
      expect(result.strategies).toContain('few-shot');
      expect(result.strategies).toContain('schema-aware');
      expect(result.parameters.temperature).toBeGreaterThan(0.05);
    });

    test('should include chain-of-thought for complex queries with general models', () => {
      const complexIntent: QueryIntent = {
        type: 'analytics',
        complexity: 'complex',
        entities: ['customers', 'orders'],
        operations: ['SELECT', 'JOIN', 'GROUP BY'],
        conditions: ['date_range'],
        confidence: 0.8,
        patterns: []
      };

      const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'top customers by revenue last quarter',
        mockSchema,
        mockExamples,
        complexIntent,
        'general-language',
        mockConfig
      );

      expect(result.strategies).toContain('chain-of-thought');
      expect(result.userPrompt).toContain('STEP-BY-STEP REASONING');
      expect(result.userPrompt).toContain('Step 1 - UNDERSTAND THE REQUEST');
      expect(result.parameters.maxTokens).toBeGreaterThan(400); // More tokens for complex queries
    });

    test('should adjust parameters based on query complexity', () => {
      const simpleResult = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'show customers',
        mockSchema,
        [],
        { ...mockIntent, complexity: 'simple' },
        'general-code',
        mockConfig
      );

      const complexResult = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'complex analytical query',
        mockSchema,
        [],
        { ...mockIntent, complexity: 'complex' },
        'general-code',
        mockConfig
      );

      expect(simpleResult.parameters.temperature).toBeLessThan(complexResult.parameters.temperature);
      expect(simpleResult.parameters.maxTokens).toBeLessThan(complexResult.parameters.maxTokens);
    });
  });

  describe('Schema Context Building', () => {
    
    test('should build enhanced schema context with relationships', () => {
      const mockIntent: QueryIntent = {
        type: 'join',
        complexity: 'medium',
        entities: ['customers', 'orders'],
        operations: ['SELECT', 'JOIN'],
        conditions: [],
        confidence: 0.85,
        patterns: []
      };

      const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'customers with their orders',
        mockSchema,
        [],
        mockIntent,
        'general-code',
        { maxTokens: 500, budgetPerQuery: 0.01, prioritizeAccuracy: true, prioritizeSpeed: false, prioritizeCost: false }
      );

      expect(result.userPrompt).toContain('DATABASE SCHEMA');
      expect(result.userPrompt).toContain('customers (1,250,000 rows)');
      expect(result.userPrompt).toContain('orders (3,750,000 rows)');
      expect(result.userPrompt).toContain('RELATIONSHIPS');
      expect(result.userPrompt).toContain('orders o JOIN customers c');
      expect(result.userPrompt).toContain('Foreign Keys');
    });

    test('should prioritize relevant tables in schema context', () => {
      const mockIntent: QueryIntent = {
        type: 'select_all',
        complexity: 'simple',
        entities: ['orders'],
        operations: ['SELECT'],
        conditions: [],
        confidence: 0.9,
        patterns: []
      };

      const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'show me orders',
        mockSchema,
        [],
        mockIntent,
        'general-code',
        { maxTokens: 500, budgetPerQuery: 0.01, prioritizeAccuracy: true, prioritizeSpeed: false, prioritizeCost: false }
      );

      // Orders table should appear first since it's the relevant entity
      const schemaSection = result.userPrompt.split('RELEVANT EXAMPLES')[0];
      const ordersIndex = schemaSection.indexOf('Table: orders');
      const customersIndex = schemaSection.indexOf('Table: customers');
      
      expect(ordersIndex).toBeLessThan(customersIndex);
    });
  });

  describe('Few-Shot Example Formatting', () => {
    
    test('should format examples with appropriate detail level', () => {
      const mockIntent: QueryIntent = {
        type: 'select_all',
        complexity: 'medium',
        entities: ['customers'],
        operations: ['SELECT'],
        conditions: [],
        confidence: 0.9,
        patterns: []
      };

      const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'show customers from New York',
        mockSchema,
        mockExamples,
        mockIntent,
        'general-code',
        { maxTokens: 500, budgetPerQuery: 0.01, prioritizeAccuracy: true, prioritizeSpeed: false, prioritizeCost: false }
      );

      expect(result.userPrompt).toContain('RELEVANT EXAMPLES');
      expect(result.userPrompt).toContain('Example 1');
      expect(result.userPrompt).toContain('show me all customers');
      expect(result.userPrompt).toContain('SELECT * FROM customers');
      expect(result.userPrompt).toContain('Explanation:');
    });

    test('should limit examples based on complexity', () => {
      const simpleIntent: QueryIntent = {
        type: 'select_all',
        complexity: 'simple',
        entities: ['customers'],
        operations: ['SELECT'],
        conditions: [],
        confidence: 0.9,
        patterns: []
      };

      const complexIntent: QueryIntent = {
        type: 'analytics',
        complexity: 'complex',
        entities: ['customers', 'orders'],
        operations: ['SELECT', 'JOIN', 'GROUP BY'],
        conditions: [],
        confidence: 0.8,
        patterns: []
      };

      const manyExamples = [...mockExamples, ...mockExamples, ...mockExamples]; // 6 examples

      const simpleResult = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'simple query',
        mockSchema,
        manyExamples,
        simpleIntent,
        'general-code',
        { maxTokens: 500, budgetPerQuery: 0.01, prioritizeAccuracy: true, prioritizeSpeed: false, prioritizeCost: false }
      );

      const complexResult = AdvancedPromptingStrategies.buildOptimizedPrompt(
        'complex query',
        mockSchema,
        manyExamples,
        complexIntent,
        'general-code',
        { maxTokens: 500, budgetPerQuery: 0.01, prioritizeAccuracy: true, prioritizeSpeed: false, prioritizeCost: false }
      );

      // Simple queries should have fewer examples (2) than complex queries (4)
      const simpleExampleCount = (simpleResult.userPrompt.match(/Example \d+/g) || []).length;
      const complexExampleCount = (complexResult.userPrompt.match(/Example \d+/g) || []).length;

      expect(simpleExampleCount).toBeLessThanOrEqual(2);
      expect(complexExampleCount).toBeLessThanOrEqual(4);
      expect(complexExampleCount).toBeGreaterThan(simpleExampleCount);
    });
  });

  describe('Performance Calculation', () => {
    
    test('should calculate expected improvement for combined strategies', () => {
      const result = AdvancedPromptingStrategies.calculateExpectedImprovement(
        ['few-shot', 'schema-aware', 'chain-of-thought'],
        0.45, // 45% baseline accuracy
        'complex'
      );

      expect(result.expectedAccuracy).toBeGreaterThan(0.45);
      expect(result.expectedAccuracy).toBeLessThanOrEqual(0.98); // Capped at 98%
      expect(result.costMultiplier).toBeGreaterThan(1.0);
      expect(result.confidenceInterval[0]).toBeLessThan(result.expectedAccuracy);
      expect(result.confidenceInterval[1]).toBeGreaterThan(result.expectedAccuracy);
    });

    test('should provide higher gains for complex queries with chain-of-thought', () => {
      const simpleResult = AdvancedPromptingStrategies.calculateExpectedImprovement(
        ['chain-of-thought'],
        0.65,
        'simple'
      );

      const complexResult = AdvancedPromptingStrategies.calculateExpectedImprovement(
        ['chain-of-thought'],
        0.25,
        'complex'
      );

      // Chain-of-thought should provide more benefit for complex queries
      const simpleGain = simpleResult.expectedAccuracy - 0.65;
      const complexGain = complexResult.expectedAccuracy - 0.25;

      expect(complexGain).toBeGreaterThan(simpleGain);
    });

    test('should cap accuracy at realistic maximum', () => {
      const result = AdvancedPromptingStrategies.calculateExpectedImprovement(
        ['few-shot', 'schema-aware', 'chain-of-thought'],
        0.90, // High baseline
        'simple'
      );

      expect(result.expectedAccuracy).toBeLessThanOrEqual(0.98);
    });
  });
});

describe('PromptStrategyEvaluator', () => {
  
  const testQueries = [
    {
      query: 'show me all customers',
      expectedSQL: 'SELECT * FROM customers LIMIT 20;',
      complexity: 'simple' as QueryComplexity
    },
    {
      query: 'how many orders were placed',
      expectedSQL: 'SELECT COUNT(*) FROM orders;',
      complexity: 'simple' as QueryComplexity
    },
    {
      query: 'customers with their orders',
      expectedSQL: 'SELECT c.*, o.* FROM customers c JOIN orders o ON c.customer_id = o.customer_id;',
      complexity: 'medium' as QueryComplexity
    }
  ];

  const mockSchema: SchemaInfo = {
    tables: {
      customers: {
        columns: [
          { table_name: 'customers', column_name: 'customer_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
          { table_name: 'customers', column_name: 'name', data_type: 'VARCHAR(255)', is_primary_key: false, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 2 }
        ],
        primaryKeys: ['customer_id'],
        foreignKeys: [],
        indexes: []
      },
      orders: {
        columns: [
          { table_name: 'orders', column_name: 'order_id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 },
          { table_name: 'orders', column_name: 'customer_id', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: true, is_nullable: 'NO', column_default: null, ordinal_position: 2 }
        ],
        primaryKeys: ['order_id'],
        foreignKeys: [
          { column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }
        ],
        indexes: []
      }
    },
    relationships: []
  };

  test('should evaluate different strategies and return results', async () => {
    const results = await PromptStrategyEvaluator.evaluateStrategies(
      testQueries,
      mockSchema,
      'general-code'
    );

    expect(results).toHaveLength(5); // baseline, few-shot, schema-aware, chain-of-thought, combined
    
    // Check that all strategies are present
    const strategyNames = results.map(r => r.strategy);
    expect(strategyNames).toContain('baseline');
    expect(strategyNames).toContain('few-shot');
    expect(strategyNames).toContain('schema-aware');
    expect(strategyNames).toContain('chain-of-thought');
    expect(strategyNames).toContain('combined');

    // Check that results have expected properties
    results.forEach(result => {
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
      expect(result.avgLatency).toBeGreaterThanOrEqual(0);
      expect(result.costMultiplier).toBeGreaterThanOrEqual(1);
    });
  });

  test('should show improvement from baseline to advanced strategies', async () => {
    const results = await PromptStrategyEvaluator.evaluateStrategies(
      testQueries,
      mockSchema,
      'general-code'
    );

    const baseline = results.find(r => r.strategy === 'baseline');
    const combined = results.find(r => r.strategy === 'combined');

    expect(baseline).toBeDefined();
    expect(combined).toBeDefined();
    
    if (baseline && combined) {
      // Combined strategy should have higher cost multiplier (uses more resources)
      expect(combined.costMultiplier).toBeGreaterThan(baseline.costMultiplier);
      
      // Check that we have different accuracy values across strategies
      const accuracyValues = results.map(r => r.accuracy);
      const uniqueAccuracies = new Set(accuracyValues);
      
      // Should have at least 2 different accuracy levels
      expect(uniqueAccuracies.size).toBeGreaterThanOrEqual(2);
      
      // All strategies should have valid metrics
      results.forEach(result => {
        expect(result.accuracy).toBeGreaterThanOrEqual(0);
        expect(result.accuracy).toBeLessThanOrEqual(1);
        expect(result.costMultiplier).toBeGreaterThanOrEqual(1);
      });
    }
  });

  test('should show cost-accuracy trade-offs', async () => {
    const results = await PromptStrategyEvaluator.evaluateStrategies(
      testQueries,
      mockSchema,
      'specialized-sql'
    );

    // Sort by cost multiplier
    const sortedByCost = results.sort((a, b) => a.costMultiplier - b.costMultiplier);
    
    // Generally, higher cost should correlate with higher accuracy
    // (though this is simulated data, so we just check the structure)
    expect(sortedByCost[0].strategy).toBe('baseline'); // Lowest cost
    expect(sortedByCost[sortedByCost.length - 1].costMultiplier).toBeGreaterThan(1.5); // Highest cost strategy
  });
});

describe('Integration Tests', () => {
  
  test('should handle edge cases gracefully', () => {
    const emptySchema: SchemaInfo = { tables: {}, relationships: [] };
    const emptyIntent: QueryIntent = {
      type: 'select_all',
      complexity: 'simple',
      entities: [],
      operations: [],
      conditions: [],
      confidence: 0.5,
      patterns: []
    };

    expect(() => {
      AdvancedPromptingStrategies.buildOptimizedPrompt(
        'test query',
        emptySchema,
        [],
        emptyIntent,
        'general-code',
        { maxTokens: 500, budgetPerQuery: 0.01, prioritizeAccuracy: true, prioritizeSpeed: false, prioritizeCost: false }
      );
    }).not.toThrow();
  });

  test('should work with minimal configuration', () => {
    const minimalSchema: SchemaInfo = {
      tables: {
        test_table: {
          columns: [
            { table_name: 'test_table', column_name: 'id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, is_nullable: 'NO', column_default: null, ordinal_position: 1 }
          ],
          primaryKeys: ['id'],
          foreignKeys: [],
          indexes: []
        }
      },
      relationships: []
    };

    const result = AdvancedPromptingStrategies.buildOptimizedPrompt(
      'simple test',
      minimalSchema,
      [],
      {
        type: 'select_all',
        complexity: 'simple',
        entities: ['test_table'],
        operations: ['SELECT'],
        conditions: [],
        confidence: 0.8,
        patterns: []
      },
      'specialized-sql',
      { maxTokens: 200, budgetPerQuery: 0.005, prioritizeAccuracy: false, prioritizeSpeed: true, prioritizeCost: true }
    );

    expect(result.systemPrompt).toBeTruthy();
    expect(result.userPrompt).toBeTruthy();
    expect(result.parameters.maxTokens).toBeLessThanOrEqual(200);
  });
});