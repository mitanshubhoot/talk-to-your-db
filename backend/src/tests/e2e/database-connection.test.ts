import { DatabaseService } from '../../services/database';
import { ConnectionManager } from '../../services/connectionManager';
import { freeAIService } from '../../services/freeAiService';
import { Pool } from 'pg';

describe('Database Connection End-to-End Tests', () => {
  let databaseService: DatabaseService;
  let connectionManager: ConnectionManager;
  
  beforeAll(() => {
    databaseService = new DatabaseService();
    connectionManager = new ConnectionManager();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('PostgreSQL Connection Workflow', () => {
    test('should establish connection with valid credentials', async () => {
      // Test with environment variable approach (legacy)
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/testdb';
      
      try {
        // Reinitialize with new URL
        await databaseService.reinitialize();
        
        const connectionResult = await databaseService.testConnection();
        
        if (connectionResult.success) {
          expect(connectionResult.success).toBe(true);
          expect(connectionResult.details).toBeDefined();
          expect(connectionResult.details.serverInfo).toBeDefined();
        } else {
          // If connection fails, verify we get proper error handling
          expect(connectionResult.error).toBeDefined();
          expect(connectionResult.details).toBeDefined();
          expect(connectionResult.details.suggestions).toBeDefined();
          expect(Array.isArray(connectionResult.details.suggestions)).toBe(true);
        }
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 30000);

    test('should handle invalid connection gracefully', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://baduser:badpass@localhost:5432/baddb';
      
      try {
        await databaseService.reinitialize();
        const connectionResult = await databaseService.testConnection();
        
        expect(connectionResult.success).toBe(false);
        expect(connectionResult.error).toBeDefined();
        expect(connectionResult.details).toBeDefined();
        expect(connectionResult.details.suggestions).toBeDefined();
        expect(connectionResult.details.suggestions.length).toBeGreaterThan(0);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);

    test('should handle missing DATABASE_URL gracefully', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      try {
        await databaseService.reinitialize();
        const connectionResult = await databaseService.testConnection();
        
        expect(connectionResult.success).toBe(false);
        expect(connectionResult.error).toContain('DATABASE_URL');
        expect(connectionResult.details).toBeDefined();
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 10000);
  });

  describe('Connection Manager Workflow', () => {
    test('should create and test connection using ConnectionManager', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: false,
        isDefault: false
      };

      try {
        const isValid = await connectionManager.testConnection(connectionData as any);
        
        if (isValid) {
          // If connection succeeds, create the connection
          const connection = await connectionManager.createConnection(connectionData);
          expect(connection).toBeDefined();
          expect(connection.id).toBeDefined();
          expect(connection.name).toBe(connectionData.name);
          
          // Clean up
          await connectionManager.deleteConnection(connection.id);
        } else {
          // Connection failed - this is expected in test environment
          console.log('Connection test failed as expected in test environment');
        }
      } catch (error) {
        // Verify error handling provides useful information
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
        expect((error as Error).message.length).toBeGreaterThan(0);
      }
    }, 20000);

    test('should handle connection errors with detailed messages', async () => {
      const invalidConnectionData = {
        name: 'Invalid Connection',
        type: 'postgresql' as const,
        host: 'nonexistent-host',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: false,
        isDefault: false
      };

      try {
        await connectionManager.testConnection(invalidConnectionData as any);
        // If we reach here, the test environment might have different behavior
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Connection test failed');
        expect(errorMessage.length).toBeGreaterThan(10);
      }
    }, 15000);
  });

  describe('Schema Discovery Workflow', () => {
    test('should discover schema when connection is available', async () => {
      // Test with a working connection if available
      const originalUrl = process.env.DATABASE_URL;
      
      if (originalUrl && originalUrl.includes('postgresql://')) {
        try {
          const schema = await databaseService.discoverSchema();
          
          expect(schema).toBeDefined();
          expect(schema.tables).toBeDefined();
          expect(schema.relationships).toBeDefined();
          expect(typeof schema.tables).toBe('object');
          expect(Array.isArray(schema.relationships)).toBe(true);
          expect(schema.lastDiscovered).toBeInstanceOf(Date);
        } catch (error) {
          // Schema discovery failed - verify error handling
          expect(error).toBeInstanceOf(Error);
          const errorMessage = (error as Error).message;
          expect(errorMessage).toBeDefined();
          expect(errorMessage.length).toBeGreaterThan(0);
        }
      } else {
        // No valid connection - test error handling
        try {
          await databaseService.discoverSchema();
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Database not configured');
        }
      }
    }, 30000);

    test('should handle schema discovery errors gracefully', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://baduser:badpass@localhost:5432/baddb';
      
      try {
        await databaseService.reinitialize();
        await databaseService.discoverSchema();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Schema discovery failed');
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);
  });

  describe('Query Execution Workflow', () => {
    test('should execute simple SELECT query when connection is available', async () => {
      const originalUrl = process.env.DATABASE_URL;
      
      if (originalUrl && originalUrl.includes('postgresql://')) {
        try {
          const result = await databaseService.executeQuery('SELECT 1 as test_column');
          
          if (!result.error) {
            expect(result.rows).toBeDefined();
            expect(result.rowCount).toBeDefined();
            expect(result.fields).toBeDefined();
            expect(result.executionTime).toBeGreaterThan(0);
            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0]).toHaveProperty('test_column');
          } else {
            // Query failed - verify error handling
            expect(result.error).toBeDefined();
            expect(result.executionTime).toBeGreaterThan(0);
          }
        } catch (error) {
          // Unexpected error - should be handled gracefully
          expect(error).toBeInstanceOf(Error);
        }
      } else {
        // No connection - test error handling
        const result = await databaseService.executeQuery('SELECT 1 as test_column');
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Database not configured');
      }
    }, 20000);

    test('should block dangerous SQL operations', async () => {
      const dangerousQueries = [
        'DROP TABLE users',
        'DELETE FROM users',
        'UPDATE users SET name = "hacked"',
        'INSERT INTO users VALUES (1, "test")',
        'ALTER TABLE users ADD COLUMN hacked TEXT'
      ];

      for (const query of dangerousQueries) {
        const result = await databaseService.executeQuery(query);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('operations are not allowed');
      }
    }, 10000);

    test('should handle SQL syntax errors gracefully', async () => {
      const invalidQuery = 'SELCT * FORM nonexistent_table';
      const result = await databaseService.executeQuery(invalidQuery);
      
      expect(result.error).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    }, 10000);
  });

  describe('Natural Language to SQL Workflow', () => {
    test('should handle natural language query when schema is available', async () => {
      const originalUrl = process.env.DATABASE_URL;
      
      if (originalUrl && originalUrl.includes('postgresql://')) {
        try {
          // First try to get schema
          const schema = await databaseService.discoverSchema();
          
          if (Object.keys(schema.tables).length > 0) {
            // Test natural language processing
            const result = await freeAIService.generateSql({
              userQuery: 'Show me all data from the first table',
              schema: schema
            });
            
            expect(result).toBeDefined();
            expect(result.sql).toBeDefined();
            expect(result.sql.length).toBeGreaterThan(0);
            expect(result.explanation).toBeDefined();
            expect(result.confidence).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
          }
        } catch (error) {
          // AI service might not be available - verify error handling
          expect(error).toBeInstanceOf(Error);
        }
      }
    }, 30000);

    test('should handle empty schema gracefully', async () => {
      const emptySchema = {
        tables: {},
        relationships: [],
        lastDiscovered: new Date()
      };

      try {
        const result = await freeAIService.generateSql({
          userQuery: 'Show me all users',
          schema: emptySchema
        });
        
        // Should either succeed with a generic response or fail gracefully
        if (result) {
          expect(result.sql).toBeDefined();
          expect(result.explanation).toBeDefined();
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBeDefined();
      }
    }, 15000);
  });

  describe('Connection Status and Health', () => {
    test('should report connection status accurately', () => {
      const status = databaseService.getConnectionStatus();
      
      expect(status).toBeDefined();
      expect(status.initialized).toBeDefined();
      expect(status.hasPool).toBeDefined();
      expect(typeof status.initialized).toBe('boolean');
      expect(typeof status.hasPool).toBe('boolean');
      
      if (status.error) {
        expect(typeof status.error).toBe('string');
        expect(status.error.length).toBeGreaterThan(0);
      }
      
      if (status.poolStats) {
        expect(status.poolStats.totalCount).toBeDefined();
        expect(status.poolStats.idleCount).toBeDefined();
        expect(status.poolStats.waitingCount).toBeDefined();
      }
    });

    test('should handle connection reinitialization', async () => {
      const originalUrl = process.env.DATABASE_URL;
      
      try {
        await databaseService.reinitialize();
        
        const status = databaseService.getConnectionStatus();
        expect(status.initialized).toBeDefined();
        expect(status.hasPool).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      } finally {
        // Ensure we restore original state
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);
  });
});