import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

const router = Router();

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
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch database schema'
      }
    });
  }
});

// GET /api/database/test-connection
// Test database connection
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    logger.info('Testing database connection');

    const isConnected = await databaseService.testConnection();

    if (isConnected) {
      logger.info('Database connection test successful');
      res.json({
        success: true,
        data: {
          connected: true,
          message: 'Database connection successful'
        }
      });
    } else {
      logger.warn('Database connection test failed');
      res.status(500).json({
        error: {
          message: 'Database connection test failed'
        }
      });
    }

  } catch (error) {
    logger.error('Error testing database connection:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to test database connection'
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
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch table list'
      }
    });
  }
});

export { router as databaseRouter }; 