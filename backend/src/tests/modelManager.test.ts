import { QueryValidator } from '../services/queryValidator';
import { ModelManager } from '../services/modelManager';
import { ComplexQueryPatternHandler } from '../services/complexQueryPatterns';
import { QueryExplainer } from '../services/queryExplainer';
import { SchemaInfo } from '../services/database';

describe('Enhanced Model Manager Components', () => {
  const mockSchema: SchemaInfo = {
    tables: {
      customers: {
        columns: [
          { table_name: 'customers', column_name: 'customer_id', data_type: 'integer', is_primary_key: true, is_nullable: 'NO', is_foreign_key: false, column_default: null, ordinal_position: 1 },
          { table_name: 'customers', column_name: 'name', data_type: 'varchar', is_primary_key: false, is_nullable: 'NO', is_foreign_key: false, column_default: null, ordinal_position: 2 },
          { table_name: 'customers', column_name: 'email', data_type: 'varchar', is_primary_key: false, is_nullable: 'YES', is_foreign_key: false, column_default: null, ordinal_position: 3 },
          { table_name: 'customers', column_name: 'city', data_type: 'varchar', is_primary_key: false, is_nullable: 'YES', is_foreign_key: false, column_default: null, ordinal_position: 4 }
        ],
        rowCount: 1500,
        primaryKeys: ['customer_id'],
        foreignKeys: [],
        indexes: []
      },
      orders: {
        columns: [
          { table_name: 'orders', column_name: 'order_id', data_type: 'integer', is_primary_key: true, is_nullable: 'NO', is_foreign_key: false, column_default: null, ordinal_position: 1 },
          { table_name: 'orders', column_name: 'customer_id', data_type: 'integer', is_primary_key: false, is_nullable: 'NO', is_foreign_key: true, column_default: null, ordinal_position: 2 },
          { table_name: 'orders', column_name: 'order_date', data_type: 'date', is_primary_key: false, is_nullable: 'NO', is_foreign_key: false, column_default: null, ordinal_position: 3 },
          { table_name: 'orders', column_name: 'total_amount', data_type: 'decimal', is_primary_key: false, is_nullable: 'NO', is_foreign_key: false, column_default: null, ordinal_position: 4 }
        ],
        rowCount: 5000,
        primaryKeys: ['order_id'],
        foreignKeys: [{ column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }],
        indexes: []
      }
    },
    relationships: [
      { table: 'orders', column: 'customer_id', referencedTable: 'customers', referencedColumn: 'customer_id' }
    ]
  };

  describe('QueryValidator', () => {
    const validator = new QueryValidator();

    test('should validate simple SELECT query', async () => {
      const sql = 'SELECT * FROM customers;';
      const result = await validator.validateSQL(sql, mockSchema);
      
      expect(result.isValid).toBe(true);
      expect(result.syntaxErrors).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(70);
    });

    test('should detect syntax errors', async () => {
      const sql = 'SELECT * FROM customers'; // Missing semicolon
      const result = await validator.validateSQL(sql, mockSchema);
      
      expect(result.syntaxErrors).toContain('Query should end with a semicolon');
    });

    test('should detect non-existent table', async () => {
      const sql = 'SELECT * FROM nonexistent_table;';
      const result = await validator.validateSQL(sql, mockSchema);
      
      expect(result.semanticErrors).toContain("Table 'nonexistent_table' does not exist in the schema");
    });

    test('should generate warnings for SELECT * without LIMIT', async () => {
      const sql = 'SELECT * FROM customers;';
      const result = await validator.validateSQL(sql, mockSchema);
      
      expect(result.warnings).toContain('SELECT * without LIMIT may return large datasets. Consider adding LIMIT clause.');
    });
  });

  describe('ComplexQueryPatternHandler', () => {
    const handler = new ComplexQueryPatternHandler();

    test('should detect aggregation pattern', () => {
      const userQuery = 'How many customers are in each city?';
      const pattern = handler.detectQueryPattern(userQuery, mockSchema);
      
      expect(pattern.type).toBe('aggregation');
      expect(pattern.requiredTables).toContain('customers');
    });

    test('should detect join pattern', () => {
      const userQuery = 'Show customers with their orders';
      const pattern = handler.detectQueryPattern(userQuery, mockSchema);
      
      expect(pattern.type).toBe('join');
      expect(pattern.requiredTables).toContain('customers');
      expect(pattern.requiredTables).toContain('orders');
    });

    test('should generate aggregation prompt', () => {
      const userQuery = 'Count customers by city';
      const pattern = { type: 'aggregation' as const, complexity: 'simple' as const, requiredTables: ['customers'], suggestedColumns: [] };
      const prompt = handler.generateAggregationPrompt(userQuery, mockSchema, pattern);
      
      expect(prompt.systemPrompt).toContain('aggregation queries');
      expect(prompt.examples).toHaveLength(5);
      expect(prompt.patternSpecificInstructions).toContain('GROUP BY');
    });
  });

  describe('QueryExplainer', () => {
    const explainer = new QueryExplainer();

    test('should explain simple SELECT query', () => {
      const sql = 'SELECT name, email FROM customers WHERE city = \'New York\' ORDER BY name LIMIT 10;';
      const userQuery = 'Show customers from New York';
      const explanation = explainer.explainQuery(sql, userQuery, mockSchema);
      
      expect(explanation.summary).toContain('selects data');
      expect(explanation.breakdown.operation).toBe('SELECT');
      expect(explanation.breakdown.tables).toHaveLength(1);
      expect(explanation.breakdown.filters).toHaveLength(1);
      expect(explanation.complexity).toBe('simple');
    });

    test('should explain JOIN query', () => {
      const sql = 'SELECT c.name, o.order_date FROM customers c JOIN orders o ON c.customer_id = o.customer_id;';
      const userQuery = 'Show customers with their orders';
      const explanation = explainer.explainQuery(sql, userQuery, mockSchema);
      
      expect(explanation.breakdown.joins).toHaveLength(1);
      expect(explanation.breakdown.tables).toHaveLength(2);
      expect(explanation.complexity).toBe('medium');
    });

    test('should provide performance estimates', () => {
      const sql = 'SELECT * FROM customers;';
      const userQuery = 'Show all customers';
      const explanation = explainer.explainQuery(sql, userQuery, mockSchema);
      
      expect(explanation.estimatedPerformance.level).toBeDefined();
      expect(explanation.estimatedPerformance.factors).toBeDefined();
      expect(explanation.estimatedPerformance.recommendations).toBeDefined();
    });
  });

  describe('ModelManager', () => {
    const modelManager = new ModelManager();

    test('should have available models', () => {
      const models = modelManager.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('type');
    });

    test('should select best model for context', async () => {
      const context = {
        userQuery: 'SELECT * FROM customers',
        schema: mockSchema,
        queryType: 'simple' as const,
        databaseDialect: 'postgresql'
      };
      
      const model = await modelManager.selectBestModel(context);
      expect(model).toHaveProperty('id');
      expect(model.supportedDialects).toContain('postgresql');
    });

    test('should record and retrieve model performance', async () => {
      const modelId = 'test-model';
      const performance = {
        modelId,
        queryType: 'simple',
        accuracy: 85,
        latency: 1500,
        userSatisfaction: 4,
        errorRate: 0.1,
        timestamp: new Date()
      };
      
      await modelManager.recordModelPerformance(modelId, performance);
      const stats = modelManager.getModelStats(modelId);
      
      expect(stats.totalQueries).toBe(1);
      expect(stats.averageAccuracy).toBe(85);
    });
  });
});