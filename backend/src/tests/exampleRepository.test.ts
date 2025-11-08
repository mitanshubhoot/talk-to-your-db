import { ExampleRepository, NLSQLExample, ExampleSelectionCriteria, QueryPattern } from '../services/exampleRepository';
import { SchemaInfo } from '../services/database';

describe('ExampleRepository', () => {
  let repository: ExampleRepository;
  let mockSchema: SchemaInfo;

  beforeEach(() => {
    repository = new ExampleRepository();
    
    // Mock schema for testing
    mockSchema = {
      tables: {
        customers: {
          columns: [
            { table_name: 'customers', column_name: 'customer_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 1, is_primary_key: true, is_foreign_key: false },
            { table_name: 'customers', column_name: 'name', data_type: 'varchar', is_nullable: 'NO', column_default: null, ordinal_position: 2, is_primary_key: false, is_foreign_key: false },
            { table_name: 'customers', column_name: 'email', data_type: 'varchar', is_nullable: 'YES', column_default: null, ordinal_position: 3, is_primary_key: false, is_foreign_key: false },
            { table_name: 'customers', column_name: 'city', data_type: 'varchar', is_nullable: 'YES', column_default: null, ordinal_position: 4, is_primary_key: false, is_foreign_key: false }
          ],
          primaryKeys: ['customer_id'],
          foreignKeys: [],
          indexes: []
        },
        orders: {
          columns: [
            { table_name: 'orders', column_name: 'order_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 1, is_primary_key: true, is_foreign_key: false },
            { table_name: 'orders', column_name: 'customer_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 2, is_primary_key: false, is_foreign_key: true },
            { table_name: 'orders', column_name: 'order_date', data_type: 'date', is_nullable: 'NO', column_default: null, ordinal_position: 3, is_primary_key: false, is_foreign_key: false },
            { table_name: 'orders', column_name: 'total_amount', data_type: 'decimal', is_nullable: 'NO', column_default: null, ordinal_position: 4, is_primary_key: false, is_foreign_key: false }
          ],
          primaryKeys: ['order_id'],
          foreignKeys: [{ column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }],
          indexes: []
        },
        products: {
          columns: [
            { table_name: 'products', column_name: 'product_id', data_type: 'integer', is_nullable: 'NO', column_default: null, ordinal_position: 1, is_primary_key: true, is_foreign_key: false },
            { table_name: 'products', column_name: 'name', data_type: 'varchar', is_nullable: 'NO', column_default: null, ordinal_position: 2, is_primary_key: false, is_foreign_key: false },
            { table_name: 'products', column_name: 'price', data_type: 'decimal', is_nullable: 'NO', column_default: null, ordinal_position: 3, is_primary_key: false, is_foreign_key: false },
            { table_name: 'products', column_name: 'category', data_type: 'varchar', is_nullable: 'YES', column_default: null, ordinal_position: 4, is_primary_key: false, is_foreign_key: false }
          ],
          primaryKeys: ['product_id'],
          foreignKeys: [],
          indexes: []
        }
      },
      relationships: [
        { table: 'orders', column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }
      ]
    };
  });

  describe('Example Selection', () => {
    test('should select relevant examples for basic customer query', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'show me all customers',
        schemaContext: mockSchema,
        maxExamples: 3
      };

      const examples = repository.selectExamples(criteria);
      
      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.length).toBeLessThanOrEqual(3);
      
      // Should prioritize customer-related examples
      const customerExamples = examples.filter(ex => 
        ex.queryPattern.tables.includes('customers') ||
        ex.naturalLanguage.toLowerCase().includes('customer')
      );
      expect(customerExamples.length).toBeGreaterThan(0);
    });

    test('should select examples for aggregation queries', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'how many orders do we have',
        schemaContext: mockSchema,
        maxExamples: 3
      };

      const examples = repository.selectExamples(criteria);
      
      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      
      // Should include count/aggregate examples
      const aggregateExamples = examples.filter(ex => 
        ex.queryPattern.type === 'count' || 
        ex.queryPattern.operations.includes('COUNT')
      );
      expect(aggregateExamples.length).toBeGreaterThan(0);
    });

    test('should select examples for join queries', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'orders with customer information',
        schemaContext: mockSchema,
        maxExamples: 3
      };

      const examples = repository.selectExamples(criteria);
      
      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      
      // Should include join examples
      const joinExamples = examples.filter(ex => 
        ex.queryPattern.tables.length > 1 ||
        ex.queryPattern.operations.includes('JOIN')
      );
      expect(joinExamples.length).toBeGreaterThan(0);
    });

    test('should respect maxExamples limit', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'show customers',
        schemaContext: mockSchema,
        maxExamples: 2
      };

      const examples = repository.selectExamples(criteria);
      expect(examples.length).toBeLessThanOrEqual(2);
    });

    test('should filter by minimum similarity score', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'very specific unique query that matches nothing',
        schemaContext: mockSchema,
        maxExamples: 5,
        minSimilarityScore: 0.8
      };

      const examples = repository.selectExamples(criteria);
      
      // Should return fewer or no examples due to high similarity threshold
      examples.forEach(example => {
        expect(example.similarityScore).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('Example Quality and Ranking', () => {
    test('should rank examples by relevance', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'show all customers',
        schemaContext: mockSchema,
        maxExamples: 5
      };

      const examples = repository.selectExamples(criteria);
      
      // Examples should be sorted by final score (descending)
      for (let i = 1; i < examples.length; i++) {
        expect(examples[i-1].finalScore).toBeGreaterThanOrEqual(examples[i].finalScore);
      }
    });

    test('should provide similarity scores', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'list customers',
        schemaContext: mockSchema,
        maxExamples: 3
      };

      const examples = repository.selectExamples(criteria);
      
      examples.forEach(example => {
        expect(example.similarityScore).toBeDefined();
        expect(example.similarityScore).toBeGreaterThanOrEqual(0);
        expect(example.similarityScore).toBeLessThanOrEqual(1);
      });
    });

    test('should provide relevance scores', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'customer orders',
        schemaContext: mockSchema,
        maxExamples: 3
      };

      const examples = repository.selectExamples(criteria);
      
      examples.forEach(example => {
        expect(example.relevanceScore).toBeDefined();
        expect(example.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(example.relevanceScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Example Management', () => {
    test('should add new examples', () => {
      const newExample: NLSQLExample = {
        id: 'test_001',
        naturalLanguage: 'test query',
        sql: 'SELECT * FROM test;',
        explanation: 'Test explanation',
        schemaContext: 'test table',
        queryPattern: {
          type: 'select_all',
          complexity: 'simple',
          tables: ['test'],
          operations: ['SELECT'],
          keywords: ['test']
        },
        qualityScore: 85,
        usageCount: 0,
        successRate: 100,
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      repository.addExample(newExample);
      
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'test query',
        schemaContext: mockSchema,
        maxExamples: 5
      };

      const examples = repository.selectExamples(criteria);
      const addedExample = examples.find(ex => ex.id === 'test_001');
      expect(addedExample).toBeDefined();
    });

    test('should update example quality based on feedback', () => {
      // Add a test example first
      const testExample: NLSQLExample = {
        id: 'feedback_test',
        naturalLanguage: 'feedback test query',
        sql: 'SELECT * FROM feedback_test;',
        explanation: 'Test for feedback',
        schemaContext: 'test table',
        queryPattern: {
          type: 'select_all',
          complexity: 'simple',
          tables: ['test'],
          operations: ['SELECT'],
          keywords: ['feedback', 'test']
        },
        qualityScore: 80,
        usageCount: 0,
        successRate: 100,
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      repository.addExample(testExample);
      
      // Simulate negative feedback
      repository.updateExampleQuality('feedback_test', false);
      
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'feedback test query',
        schemaContext: mockSchema,
        maxExamples: 5
      };

      const examples = repository.selectExamples(criteria);
      const updatedExample = examples.find(ex => ex.id === 'feedback_test');
      
      expect(updatedExample).toBeDefined();
      expect(updatedExample!.usageCount).toBe(1);
      expect(updatedExample!.successRate).toBeLessThan(100);
    });
  });

  describe('Repository Statistics', () => {
    test('should provide repository statistics', () => {
      const stats = repository.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalExamples).toBeGreaterThan(0);
      expect(stats.averageQuality).toBeGreaterThan(0);
      expect(stats.averageQuality).toBeLessThanOrEqual(100);
      expect(stats.patternDistribution).toBeDefined();
      expect(stats.complexityDistribution).toBeDefined();
    });

    test('should have diverse query patterns', () => {
      const stats = repository.getStats();
      
      // Should have multiple query types
      expect(Object.keys(stats.patternDistribution).length).toBeGreaterThan(1);
      
      // Should have examples of different complexities
      expect(Object.keys(stats.complexityDistribution).length).toBeGreaterThan(1);
    });
  });

  describe('Query Pattern Coverage', () => {
    test('should cover basic SELECT patterns', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'show all',
        schemaContext: mockSchema,
        maxExamples: 10
      };

      const examples = repository.selectExamples(criteria);
      const selectExamples = examples.filter(ex => ex.queryPattern.type === 'select_all');
      expect(selectExamples.length).toBeGreaterThan(0);
    });

    test('should cover filtering patterns', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'customers from',
        schemaContext: mockSchema,
        maxExamples: 10
      };

      const examples = repository.selectExamples(criteria);
      const filterExamples = examples.filter(ex => ex.queryPattern.type === 'filter');
      expect(filterExamples.length).toBeGreaterThan(0);
    });

    test('should cover aggregation patterns', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'total revenue',
        schemaContext: mockSchema,
        maxExamples: 10
      };

      const examples = repository.selectExamples(criteria);
      const aggregateExamples = examples.filter(ex => 
        ex.queryPattern.type === 'aggregate' || ex.queryPattern.type === 'count'
      );
      expect(aggregateExamples.length).toBeGreaterThan(0);
    });

    test('should cover join patterns', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'orders with customers',
        schemaContext: mockSchema,
        maxExamples: 10
      };

      const examples = repository.selectExamples(criteria);
      const joinExamples = examples.filter(ex => 
        ex.queryPattern.type === 'join' || ex.queryPattern.tables.length > 1
      );
      expect(joinExamples.length).toBeGreaterThan(0);
    });

    test('should cover analytics patterns', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'customer analysis',
        schemaContext: mockSchema,
        maxExamples: 10
      };

      const examples = repository.selectExamples(criteria);
      const analyticsExamples = examples.filter(ex => ex.queryPattern.type === 'analytics');
      expect(analyticsExamples.length).toBeGreaterThan(0);
    });
  });

  describe('Business Context Coverage', () => {
    test('should have examples for customer management', () => {
      const stats = repository.getStats();
      expect(stats.totalExamples).toBeGreaterThan(15); // Should have substantial number of examples
      
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'customer',
        schemaContext: mockSchema,
        maxExamples: 20
      };

      const examples = repository.selectExamples(criteria);
      const customerExamples = examples.filter(ex => 
        ex.naturalLanguage.toLowerCase().includes('customer') ||
        ex.queryPattern.tables.includes('customers')
      );
      expect(customerExamples.length).toBeGreaterThan(3);
    });

    test('should have examples for sales analysis', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'sales revenue',
        schemaContext: mockSchema,
        maxExamples: 20
      };

      const examples = repository.selectExamples(criteria);
      const salesExamples = examples.filter(ex => 
        ex.naturalLanguage.toLowerCase().includes('sales') ||
        ex.naturalLanguage.toLowerCase().includes('revenue') ||
        ex.naturalLanguage.toLowerCase().includes('orders')
      );
      expect(salesExamples.length).toBeGreaterThan(2);
    });

    test('should have examples for product analysis', () => {
      const criteria: ExampleSelectionCriteria = {
        userQuery: 'product performance',
        schemaContext: mockSchema,
        maxExamples: 20
      };

      const examples = repository.selectExamples(criteria);
      const productExamples = examples.filter(ex => 
        ex.naturalLanguage.toLowerCase().includes('product') ||
        ex.queryPattern.tables.includes('products')
      );
      expect(productExamples.length).toBeGreaterThan(2);
    });
  });
});