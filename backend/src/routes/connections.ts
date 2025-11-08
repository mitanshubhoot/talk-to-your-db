import express from 'express';
import { ConnectionManager } from '../services/connectionManager.js';
import { QueryPerformanceService } from '../services/queryPerformance.js';

const router = express.Router();
const connectionManager = new ConnectionManager();
const performanceService = new QueryPerformanceService(connectionManager);

// Get all connections
router.get('/', async (req, res) => {
  try {
    const connections = await connectionManager.listConnections();
    res.json({
      success: true,
      data: connections.map(conn => ({
        ...conn,
        password: undefined // Don't expose passwords
      }))
    });
  } catch (error) {
    console.error('Error listing connections:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to list connections' }
    });
  }
});

// Get current (default) connection
router.get('/current', async (req, res) => {
  try {
    const defaultConnection = await connectionManager.getDefaultConnection();
    
    if (!defaultConnection) {
      return res.status(404).json({
        success: false,
        error: { message: 'No default connection found' }
      });
    }

    res.json({
      success: true,
      data: {
        ...defaultConnection.connection,
        password: undefined // Don't expose password
      }
    });
  } catch (error) {
    console.error('Error getting current connection:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get current connection' }
    });
  }
});

// Create new connection
router.post('/', async (req, res) => {
  try {
    const connectionData = req.body;
    
    // Validate required fields
    if (!connectionData.name || !connectionData.type || !connectionData.database) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name, type, and database are required' }
      });
    }

    // Additional validation based on database type
    if (connectionData.type === 'sqlite') {
      if (!connectionData.filepath) {
        return res.status(400).json({
          success: false,
          error: { message: 'Filepath is required for SQLite databases' }
        });
      }
    } else if (connectionData.type === 'snowflake') {
      if (!connectionData.account || !connectionData.warehouse) {
        return res.status(400).json({
          success: false,
          error: { message: 'Account and warehouse are required for Snowflake databases' }
        });
      }
    } else if (connectionData.type === 'bigquery') {
      if (!connectionData.project) {
        return res.status(400).json({
          success: false,
          error: { message: 'Project ID is required for BigQuery databases' }
        });
      }
    } else if (connectionData.type === 'mongodb') {
      // MongoDB can work with just host and database
    } else {
      // For all other database types (PostgreSQL, MySQL, MSSQL, Oracle, etc.)
      if (!connectionData.host || !connectionData.username) {
        return res.status(400).json({
          success: false,
          error: { message: 'Host and username are required for this database type' }
        });
      }
    }

    const connection = await connectionManager.createConnection(connectionData);
    
    res.status(201).json({
      success: true,
      data: {
        ...connection,
        password: undefined // Don't expose password
      }
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to create connection' }
    });
  }
});

// Test connection
router.post('/test', async (req, res) => {
  try {
    console.log('Received connection test request:', JSON.stringify(req.body, null, 2));
    const connectionData = req.body;
    const isValid = await connectionManager.testConnection(connectionData);
    
    console.log('Connection test successful');
    res.json({
      success: true,
      data: { valid: isValid, message: 'Connection test successful' }
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Connection test failed' }
    });
  }
});

// Get connection by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connections = await connectionManager.listConnections();
    const connection = connections.find(c => c.id === id);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: { message: 'Connection not found' }
      });
    }

    res.json({
      success: true,
      data: {
        ...connection,
        password: undefined // Don't expose password
      }
    });
  } catch (error) {
    console.error('Error getting connection:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get connection' }
    });
  }
});

// Delete connection
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await connectionManager.deleteConnection(id);
    
    res.json({
      success: true,
      data: { message: 'Connection deleted successfully' }
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to delete connection' }
    });
  }
});

// Get schema for connection
router.get('/:id/schema', async (req, res) => {
  try {
    const { id } = req.params;
    const schema = await connectionManager.discoverSchema(id);
    
    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    console.error('Error discovering schema:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to discover schema' }
    });
  }
});

// Get database dialect info
router.get('/:id/dialect', async (req, res) => {
  try {
    const { id } = req.params;
    const connections = await connectionManager.listConnections();
    const connection = connections.find(c => c.id === id);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: { message: 'Connection not found' }
      });
    }

    const dialect = connectionManager.getDatabaseDialect(connection.type);
    
    res.json({
      success: true,
      data: dialect
    });
  } catch (error) {
    console.error('Error getting dialect:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get database dialect' }
    });
  }
});

// Execute query on specific connection
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: { message: 'SQL query is required' }
      });
    }

    const connectionPool = await connectionManager.getConnection(id);
    const { pool, type } = connectionPool;
    
    const startTime = Date.now();
    let result: any;
    
    switch (type) {
      case 'postgresql':
        const pgResult = await pool.query(sql);
        result = {
          rows: pgResult.rows,
          rowCount: pgResult.rowCount,
          fields: pgResult.fields
        };
        break;
      
      case 'mysql':
        const [mysqlRows, mysqlFields] = await pool.execute(sql);
        result = {
          rows: mysqlRows,
          rowCount: Array.isArray(mysqlRows) ? mysqlRows.length : 0,
          fields: mysqlFields
        };
        break;
      
      case 'sqlite':
        const sqliteRows = await pool.all(sql);
        result = {
          rows: sqliteRows,
          rowCount: sqliteRows.length,
          fields: sqliteRows.length > 0 ? Object.keys(sqliteRows[0]).map(name => ({ name })) : []
        };
        break;
      
      default:
        throw new Error(`Query execution not implemented for ${type}`);
    }
    
    const executionTime = Date.now() - startTime;
    
    // Record performance
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await performanceService.recordQueryPerformance(
      queryId,
      sql,
      executionTime,
      result.rowCount || 0,
      id
    );

    res.json({
      success: true,
      data: {
        ...result,
        executionTime
      }
    });
  } catch (error) {
    console.error('Error executing query:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to execute query' }
    });
  }
});

// Get explain plan for query
router.post('/:id/explain', async (req, res) => {
  try {
    const { id } = req.params;
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: { message: 'SQL query is required' }
      });
    }

    const explainPlan = await performanceService.getExplainPlan(sql, id);
    
    res.json({
      success: true,
      data: explainPlan
    });
  } catch (error) {
    console.error('Error getting explain plan:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to get explain plan' }
    });
  }
});

export default router; 