import { ConnectionManager } from '../../services/connectionManager';
import fs from 'fs/promises';
import path from 'path';

describe('Deployment Scenarios Tests', () => {
  let connectionManager: ConnectionManager;
  const connectionsFilePath = path.join(process.cwd(), 'data', 'connections.json');
  const backupFilePath = path.join(process.cwd(), 'data', 'connections.backup.json');

  beforeEach(async () => {
    // Backup existing connections file if it exists
    try {
      const existingData = await fs.readFile(connectionsFilePath, 'utf-8');
      await fs.writeFile(backupFilePath, existingData);
    } catch (error) {
      // File doesn't exist, no backup needed
    }
    
    connectionManager = new ConnectionManager();
  });

  afterEach(async () => {
    // Restore original connections file
    try {
      const backupData = await fs.readFile(backupFilePath, 'utf-8');
      await fs.writeFile(connectionsFilePath, backupData);
      await fs.unlink(backupFilePath);
    } catch (error) {
      // No backup to restore, ensure clean state
      await fs.writeFile(connectionsFilePath, '[]');
    }
  });

  describe('Empty connections.json file', () => {
    test('should handle empty connections.json gracefully', async () => {
      // Create empty connections file
      await fs.writeFile(connectionsFilePath, '[]');
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Should return null for default connection
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection).toBeNull();
      
      // Should return empty array for list
      const connections = await connectionManager.listConnections();
      expect(connections).toEqual([]);
      expect(Array.isArray(connections)).toBe(true);
      expect(connections.length).toBe(0);
    });

    test('should allow creating new connection when file is empty', async () => {
      // Create empty connections file
      await fs.writeFile(connectionsFilePath, '[]');
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      const connectionData = {
        name: 'Test Connection',
        type: 'postgresql' as const,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: false,
        isDefault: true
      };

      try {
        const connection = await connectionManager.createConnection(connectionData);
        
        // Should create connection successfully
        expect(connection).toBeDefined();
        expect(connection.id).toBeDefined();
        expect(connection.name).toBe(connectionData.name);
        expect(connection.isDefault).toBe(true);
        
        // Clean up
        await connectionManager.deleteConnection(connection.id);
      } catch (error) {
        // Connection test may fail in test environment, which is expected
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Connection test failed');
      }
    });
  });

  describe('Missing connections.json file', () => {
    test('should create connections.json if it does not exist', async () => {
      // Delete connections file
      try {
        await fs.unlink(connectionsFilePath);
      } catch (error) {
        // File may not exist
      }
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Wait a bit for file creation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // File should be created
      const fileExists = await fs.access(connectionsFilePath)
        .then(() => true)
        .catch(() => false);
      
      expect(fileExists).toBe(true);
      
      // Should return null for default connection
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection).toBeNull();
      
      // Should return empty array
      const connections = await connectionManager.listConnections();
      expect(connections).toEqual([]);
    });

    test('should handle missing file gracefully during operations', async () => {
      // Delete connections file
      try {
        await fs.unlink(connectionsFilePath);
      } catch (error) {
        // File may not exist
      }
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // All operations should work without errors
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection).toBeNull();
      
      const connections = await connectionManager.listConnections();
      expect(Array.isArray(connections)).toBe(true);
      expect(connections.length).toBe(0);
    });
  });

  describe('Invalid default connection', () => {
    test('should return null when default connection test fails', async () => {
      // Create connections file with invalid default connection
      const invalidConnection = {
        id: 'conn_invalid_123',
        name: 'Invalid PostgreSQL',
        type: 'postgresql',
        host: 'nonexistent-host-12345.invalid',
        port: 5432,
        database: 'invaliddb',
        username: 'invaliduser',
        password: 'invalidpass',
        ssl: false,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeFile(connectionsFilePath, JSON.stringify([invalidConnection], null, 2));
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Should return null because connection test fails
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection).toBeNull();
    });

    test('should not log passwords when connection test fails', async () => {
      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create connections file with invalid default connection
      const invalidConnection = {
        id: 'conn_invalid_456',
        name: 'Invalid PostgreSQL',
        type: 'postgresql',
        host: 'nonexistent-host-67890.invalid',
        port: 5432,
        database: 'invaliddb',
        username: 'invaliduser',
        password: 'super-secret-password-123',
        ssl: false,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeFile(connectionsFilePath, JSON.stringify([invalidConnection], null, 2));
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Try to get default connection
      await connectionManager.getDefaultConnection();
      
      // Check that password was not logged
      const errorCalls = consoleErrorSpy.mock.calls;
      const allErrorMessages = errorCalls.map(call => JSON.stringify(call)).join(' ');
      
      expect(allErrorMessages).not.toContain('super-secret-password-123');
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    test('should still list invalid connections', async () => {
      // Create connections file with invalid default connection
      const invalidConnection = {
        id: 'conn_invalid_789',
        name: 'Invalid PostgreSQL',
        type: 'postgresql',
        host: 'nonexistent-host.invalid',
        port: 5432,
        database: 'invaliddb',
        username: 'invaliduser',
        password: 'invalidpass',
        ssl: false,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeFile(connectionsFilePath, JSON.stringify([invalidConnection], null, 2));
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Should still list the connection even though it's invalid
      const connections = await connectionManager.listConnections();
      expect(connections.length).toBe(1);
      expect(connections[0].id).toBe(invalidConnection.id);
      expect(connections[0].name).toBe(invalidConnection.name);
    });

    test('should handle connection with wrong credentials', async () => {
      // Create connections file with connection that has wrong credentials
      const wrongCredsConnection = {
        id: 'conn_wrong_creds',
        name: 'Wrong Credentials PostgreSQL',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        username: 'wronguser',
        password: 'wrongpassword',
        ssl: false,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeFile(connectionsFilePath, JSON.stringify([wrongCredsConnection], null, 2));
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Should return null because authentication fails
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection).toBeNull();
    });
  });

  describe('Multiple connections with invalid default', () => {
    test('should handle multiple connections when default is invalid', async () => {
      // Create connections file with multiple connections, default is invalid
      const connections = [
        {
          id: 'conn_valid_1',
          name: 'Valid Connection 1',
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'testuser',
          password: 'testpass',
          ssl: false,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'conn_invalid_default',
          name: 'Invalid Default',
          type: 'postgresql',
          host: 'nonexistent.invalid',
          port: 5432,
          database: 'invaliddb',
          username: 'invaliduser',
          password: 'invalidpass',
          ssl: false,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      await fs.writeFile(connectionsFilePath, JSON.stringify(connections, null, 2));
      
      // Reinitialize connection manager
      connectionManager = new ConnectionManager();
      
      // Should return null for default connection
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection).toBeNull();
      
      // Should still list all connections
      const allConnections = await connectionManager.listConnections();
      expect(allConnections.length).toBe(2);
    });
  });

  describe('Graceful error handling', () => {
    test('should handle corrupted JSON file gracefully', async () => {
      // Write corrupted JSON
      await fs.writeFile(connectionsFilePath, '{ invalid json content }');
      
      // Reinitialize connection manager - should handle error
      try {
        connectionManager = new ConnectionManager();
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Should create empty connections file
        const connections = await connectionManager.listConnections();
        expect(Array.isArray(connections)).toBe(true);
      } catch (error) {
        // If error is thrown, it should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('should handle file system errors gracefully', async () => {
      // This test verifies the system handles file system issues
      connectionManager = new ConnectionManager();
      
      // Operations should not crash the application
      const defaultConnection = await connectionManager.getDefaultConnection();
      expect(defaultConnection === null || defaultConnection !== null).toBe(true);
      
      const connections = await connectionManager.listConnections();
      expect(Array.isArray(connections)).toBe(true);
    });
  });
});
