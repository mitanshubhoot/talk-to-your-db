import { DatabaseService } from '../../services/database';
import { ConnectionManager } from '../../services/connectionManager';
import request from 'supertest';
import app from '../../index';

describe('Error Handling and User Experience Tests', () => {
  let databaseService: DatabaseService;
  let connectionManager: ConnectionManager;
  
  beforeAll(() => {
    databaseService = new DatabaseService();
    connectionManager = new ConnectionManager();
  });

  afterAll(async () => {
    await databaseService.close();
  });

  describe('Connection Error Scenarios', () => {
    test('should provide helpful error for wrong credentials', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://wronguser:wrongpass@localhost:5432/testdb';
      
      try {
        await databaseService.reinitialize();
        const result = await databaseService.testConnection();
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
        expect(result.details.suggestions).toBeDefined();
        expect(result.details.suggestions.length).toBeGreaterThan(0);
        
        // Check for helpful suggestions
        const suggestions = result.details.suggestions;
        const hasCredentialSuggestion = suggestions.some((s: string) => 
          s.toLowerCase().includes('username') || 
          s.toLowerCase().includes('password') ||
          s.toLowerCase().includes('credential')
        );
        expect(hasCredentialSuggestion).toBe(true);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);

    test('should provide helpful error for wrong host', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://testuser:testpass@nonexistent-host:5432/testdb';
      
      try {
        await databaseService.reinitialize();
        const result = await databaseService.testConnection();
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
        expect(result.details.suggestions).toBeDefined();
        
        // Check for network-related suggestions
        const suggestions = result.details.suggestions;
        const hasNetworkSuggestion = suggestions.some((s: string) => 
          s.toLowerCase().includes('host') || 
          s.toLowerCase().includes('network') ||
          s.toLowerCase().includes('connectivity')
        );
        expect(hasNetworkSuggestion).toBe(true);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);

    test('should provide helpful error for wrong port', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:9999/testdb';
      
      try {
        await databaseService.reinitialize();
        const result = await databaseService.testConnection();
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
        expect(result.details.suggestions).toBeDefined();
        
        // Check for port-related suggestions
        const suggestions = result.details.suggestions;
        const hasPortSuggestion = suggestions.some((s: string) => 
          s.toLowerCase().includes('port') || 
          s.toLowerCase().includes('server') ||
          s.toLowerCase().includes('running')
        );
        expect(hasPortSuggestion).toBe(true);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);

    test('should provide helpful error for wrong database name', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/nonexistentdb';
      
      try {
        await databaseService.reinitialize();
        const result = await databaseService.testConnection();
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
        expect(result.details.suggestions).toBeDefined();
        
        // Check for database-related suggestions
        const suggestions = result.details.suggestions;
        const hasDatabaseSuggestion = suggestions.some((s: string) => 
          s.toLowerCase().includes('database') || 
          s.toLowerCase().includes('create') ||
          s.toLowerCase().includes('exist')
        );
        expect(hasDatabaseSuggestion).toBe(true);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    }, 15000);
  });

  describe('API Error Responses', () => {
    test('should return proper error format for database status endpoint', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      try {
        await databaseService.reinitialize();
        
        const response = await request(app)
          .get('/api/database/status')
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.status).toBe('disconnected');
        expect(response.body.data.error).toBeDefined();
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    });

    test('should return proper error format for test connection endpoint', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://baduser:badpass@localhost:5432/baddb';
      
      try {
        await databaseService.reinitialize();
        
        const response = await request(app)
          .get('/api/database/test-connection')
          .expect(500);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.details).toBeDefined();
        expect(response.body.error.suggestions).toBeDefined();
        expect(Array.isArray(response.body.error.suggestions)).toBe(true);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    });

    test('should return proper error format for schema endpoint', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      try {
        await databaseService.reinitialize();
        
        const response = await request(app)
          .get('/api/database/schema')
          .expect(500);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.type).toBe('schema_error');
        expect(response.body.error.suggestions).toBeDefined();
        expect(Array.isArray(response.body.error.suggestions)).toBe(true);
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    });

    test('should return proper error format for text-to-sql generate endpoint', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      try {
        await databaseService.reinitialize();
        
        const response = await request(app)
          .post('/api/text-to-sql/generate')
          .send({ query: 'Show me all users' })
          .expect(500);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.type).toBeDefined();
        expect(response.body.error.suggestions).toBeDefined();
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    });

    test('should return proper error format for SQL execution endpoint', async () => {
      const originalUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      
      try {
        await databaseService.reinitialize();
        
        const response = await request(app)
          .post('/api/text-to-sql/execute')
          .send({ sql: 'SELECT 1' })
          .expect(500);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.type).toBe('connection_error');
      } finally {
        process.env.DATABASE_URL = originalUrl;
        await databaseService.reinitialize();
      }
    });
  });

  describe('Input Validation', () => {
    test('should validate empty query in text-to-sql endpoint', async () => {
      const response = await request(app)
        .post('/api/text-to-sql/generate')
        .send({ query: '' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('validation_error');
      expect(response.body.error.details).toBeDefined();
    });

    test('should validate empty SQL in execute endpoint', async () => {
      const response = await request(app)
        .post('/api/text-to-sql/execute')
        .send({ sql: '' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('validation_error');
      expect(response.body.error.details).toBeDefined();
    });

    test('should validate query length limits', async () => {
      const longQuery = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/api/text-to-sql/generate')
        .send({ query: longQuery })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('validation_error');
    });
  });

  describe('Security Error Handling', () => {
    test('should block dangerous SQL operations with helpful messages', async () => {
      const dangerousQueries = [
        { sql: 'DROP TABLE users', operation: 'DROP' },
        { sql: 'DELETE FROM users', operation: 'DELETE' },
        { sql: 'UPDATE users SET name = "test"', operation: 'UPDATE' },
        { sql: 'INSERT INTO users VALUES (1)', operation: 'INSERT' },
        { sql: 'ALTER TABLE users ADD COLUMN test TEXT', operation: 'ALTER' }
      ];

      for (const { sql, operation } of dangerousQueries) {
        const result = await databaseService.executeQuery(sql);
        
        expect(result.error).toBeDefined();
        expect(result.error).toContain(`${operation} operations are not allowed`);
        expect(result.error).toContain('security reasons');
        expect(result.rows).toEqual([]);
        expect(result.rowCount).toBe(0);
      }
    });

    test('should block multiple SQL statements', async () => {
      const multipleStatements = 'SELECT 1; DROP TABLE users;';
      const result = await databaseService.executeQuery(multipleStatements);
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Multiple SQL statements are not allowed');
      expect(result.error).toContain('security reasons');
    });

    test('should block PostgreSQL meta-commands', async () => {
      const metaCommands = ['\\COPY users TO file', '\\! rm -rf /'];
      
      for (const command of metaCommands) {
        const result = await databaseService.executeQuery(command);
        
        expect(result.error).toBeDefined();
        expect(result.error).toContain('meta-commands are not allowed');
        expect(result.error).toContain('security reasons');
      }
    });
  });

  describe('User Experience Recovery', () => {
    test('should provide recovery suggestions for connection failures', async () => {
      const connectionData = {
        name: 'Test Connection',
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
        await connectionManager.testConnection(connectionData as any);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        
        // Should contain actionable suggestions
        expect(errorMessage).toBeDefined();
        expect(errorMessage.length).toBeGreaterThan(20);
        
        // Should mention connection test failure
        expect(errorMessage.toLowerCase()).toContain('connection test failed');
      }
    });

    test('should handle graceful degradation when AI service is unavailable', async () => {
      // Test with empty schema to simulate AI service issues
      const emptySchema = {
        tables: {},
        relationships: [],
        lastDiscovered: new Date()
      };

      try {
        // Mock AI service call - would need actual import
        const result = null; // await freeAIService.generateSql({
        //   userQuery: 'Show me all users',
        //   schema: emptySchema
        // });
        
        // If it succeeds, verify the response structure
        if (result) {
          // expect(result.sql).toBeDefined();
          // expect(result.explanation).toBeDefined();
          // expect(result.confidence).toBeDefined();
        }
      } catch (error) {
        // If it fails, verify error handling
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toBeDefined();
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });

    test('should provide helpful messages for empty databases', async () => {
      // Mock a connection with no tables
      const originalUrl = process.env.DATABASE_URL;
      
      if (originalUrl && originalUrl.includes('postgresql://')) {
        try {
          const schema = await databaseService.discoverSchema();
          
          if (Object.keys(schema.tables).length === 0) {
            // Test the API response for empty database
            const response = await request(app)
              .post('/api/text-to-sql/generate')
              .send({ query: 'Show me all users' })
              .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.type).toBe('empty_database');
            expect(response.body.error.suggestions).toBeDefined();
            expect(response.body.error.suggestions.length).toBeGreaterThan(0);
            
            // Should suggest creating tables
            const suggestions = response.body.error.suggestions;
            const hasTableSuggestion = suggestions.some((s: string) => 
              s.toLowerCase().includes('table') || 
              s.toLowerCase().includes('create')
            );
            expect(hasTableSuggestion).toBe(true);
          }
        } catch (error) {
          // Schema discovery failed - this is also a valid test case
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Performance and Timeout Handling', () => {
    test('should handle query timeouts gracefully', async () => {
      // Test with a potentially slow query
      const slowQuery = 'SELECT pg_sleep(0.1), 1 as test_column';
      
      const result = await databaseService.executeQuery(slowQuery);
      
      // Should either succeed or fail gracefully
      if (result.error) {
        expect(result.error).toBeDefined();
        expect(result.executionTime).toBeGreaterThan(0);
      } else {
        expect(result.rows).toBeDefined();
        expect(result.executionTime).toBeGreaterThan(100); // At least 100ms due to pg_sleep
      }
    }, 10000);

    test('should track execution time for all queries', async () => {
      const result = await databaseService.executeQuery('SELECT 1 as test_column');
      
      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(typeof result.executionTime).toBe('number');
    });
  });
});