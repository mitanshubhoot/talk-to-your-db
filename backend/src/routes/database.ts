import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

const router = Router();

// GET /api/database/status
// Get database connection status
router.get('/status', async (req: Request, res: Response) => {
  try {
    logger.info('Checking database connection status');

    const status = databaseService.getConnectionStatus();

    res.json({
      success: true,
      data: {
        status: status.initialized && status.hasPool ? 'connected' : 'disconnected',
        initialized: status.initialized,
        hasPool: status.hasPool,
        error: status.error,
        poolStats: status.poolStats
      }
    });

  } catch (error) {
    logger.error('Error checking database status:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to check database status',
        type: 'status_error'
      }
    });
  }
});

// GET /api/database/schema
// Get database schema information
router.get('/schema', async (req: Request, res: Response) => {
  try {
    logger.info('Fetching database schema');

    const schema = await databaseService.discoverSchema();

    const tableCount = Object.keys(schema.tables).length;
    const relationshipCount = schema.relationships.length;

    logger.info(`Schema discovered: ${tableCount} tables, ${relationshipCount} relationships`);

    res.json({
      success: true,
      data: {
        schema,
        summary: {
          tableCount,
          relationshipCount,
          tables: Object.keys(schema.tables)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching database schema:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch database schema',
        type: 'schema_error',
        suggestions: [
          'Ensure database connection is working',
          'Check if database contains tables',
          'Verify user has permission to access schema information'
        ]
      }
    });
  }
});

// GET /api/database/test-connection
// Test database connection
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    logger.info('Testing database connection');

    const connectionResult = await databaseService.testConnection();

    if (connectionResult.success) {
      logger.info('Database connection test successful');
      res.json({
        success: true,
        data: {
          connected: true,
          message: 'Database connection successful',
          details: connectionResult.details
        }
      });
    } else {
      logger.warn('Database connection test failed:', connectionResult.error);
      res.status(500).json({
        success: false,
        error: {
          message: connectionResult.error || 'Database connection test failed',
          details: connectionResult.details,
          suggestions: connectionResult.details?.suggestions || []
        }
      });
    }

  } catch (error) {
    logger.error('Error testing database connection:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to test database connection',
        type: 'connection_error'
      }
    });
  }
});

// GET /api/database/tables
// Get list of tables with basic info
router.get('/tables', async (req: Request, res: Response) => {
  try {
    logger.info('Fetching table list');

    const schema = await databaseService.discoverSchema();

    const tables = Object.entries(schema.tables).map(([tableName, tableInfo]) => ({
      name: tableName,
      columnCount: tableInfo.columns.length,
      rowCount: tableInfo.rowCount || 0,
      columns: tableInfo.columns.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES'
      }))
    }));

    logger.info(`Found ${tables.length} tables`);

    res.json({
      success: true,
      data: {
        tables,
        totalTables: tables.length
      }
    });

  } catch (error) {
    logger.error('Error fetching table list:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch table list',
        type: 'tables_error',
        suggestions: [
          'Ensure database connection is working',
          'Check if database contains tables',
          'Verify user has permission to access table information'
        ]
      }
    });
  }
});

// POST /api/database/reinitialize
// Reinitialize database connection
router.post('/reinitialize', async (req: Request, res: Response) => {
  try {
    logger.info('Reinitializing database connection');

    await databaseService.reinitialize();

    // Test the new connection
    const connectionResult = await databaseService.testConnection();

    res.json({
      success: true,
      data: {
        message: 'Database connection reinitialized',
        connectionTest: connectionResult
      }
    });

  } catch (error) {
    logger.error('Error reinitializing database connection:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to reinitialize database connection',
        type: 'reinitialize_error'
      }
    });
  }
});

export { router as databaseRouter }; 