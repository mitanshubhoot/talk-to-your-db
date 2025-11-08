import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { databaseService } from '../services/database';
import { ConnectionManager } from '../services/connectionManager';
import { freeAIService } from '../services/freeAiService';
import { enhancedIntegrationService } from '../services/enhancedIntegrationService';
import { queryHistoryService } from '../services/queryHistory';
import { productionMonitoringService } from '../services/productionMonitoringService';
import { featureFlagService } from '../services/featureFlagService';
import { visualizationService } from '../services/visualizationService';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

const router = Router();
const connectionManager = new ConnectionManager();

// Helper function to get database service based on connectionId
async function getDatabaseService(connectionId?: string) {
  // If no connectionId provided, try to use the default connection
  if (!connectionId) {
    try {
      const defaultConnection = await connectionManager.getDefaultConnection();
      if (defaultConnection) {
        connectionId = defaultConnection.connection.id;
        logger.info(`Using default connection: ${connectionId}`);
      }
    } catch (error) {
      logger.warn('No default connection found, falling back to DATABASE_URL');
    }
  }

  if (connectionId) {
    // Use ConnectionManager for specific connection
    const connectionPool = await connectionManager.getConnection(connectionId);
    return {
      type: 'connection_manager',
      connectionPool,
      discoverSchema: () => connectionManager.discoverSchema(connectionId),
      executeQuery: async (sql: string) => {
        // Use the ConnectionManager's validation and execution method
        return await connectionManager.executeQueryWithValidation(connectionId!, sql);
      }
    };
  } else {
    // Use legacy DatabaseService (environment variable approach)
    return {
      type: 'database_service',
      discoverSchema: () => databaseService.discoverSchema(),
      executeQuery: (sql: string) => databaseService.executeQuery(sql)
    };
  }
}

// Validation schemas
const textToSqlSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long'),
  connectionId: z.string().optional(), // Make connectionId optional for backward compatibility
  userId: z.string().optional(), // For feature flag evaluation
  sessionId: z.string().optional(), // For feature flag evaluation
  useEnsemble: z.boolean().optional(), // Enable ensemble generation for complex queries
});

const executeSqlSchema = z.object({
  sql: z.string().min(1, 'SQL cannot be empty'),
  connectionId: z.string().optional(), // Make connectionId optional for backward compatibility
});

// POST /api/text-to-sql/generate
// Generate SQL from natural language
router.post('/generate', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { query, connectionId, userId, sessionId, useEnsemble } = textToSqlSchema.parse(req.body);

    logger.info(`Received text-to-SQL request: "${query}"${connectionId ? ` for connection: ${connectionId}` : ''}`);

    // Get database service
    let dbService;
    try {
      dbService = await getDatabaseService(connectionId);
    } catch (serviceError) {
      logger.error('Failed to get database service:', serviceError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to access database connection. Please check your connection configuration.',
          type: 'connection_error',
          details: serviceError instanceof Error ? serviceError.message : 'Unknown connection error',
          suggestions: [
            'Verify the connection exists and is properly configured',
            'Check if the connection is still active',
            'Try reconnecting to the database'
          ]
        }
      });
    }

    // Get database schema
    let schema;
    try {
      schema = await dbService.discoverSchema();
    } catch (schemaError) {
      logger.error('Failed to discover database schema:', schemaError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to access database schema. Please check your database connection.',
          type: 'schema_error',
          details: schemaError instanceof Error ? schemaError.message : 'Unknown schema error',
          suggestions: [
            'Verify database connection is working',
            'Check if user has permission to access schema information',
            'Ensure database contains tables'
          ]
        }
      });
    }
    
    if (Object.keys(schema.tables).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No database tables found. The database appears to be empty.',
          type: 'empty_database',
          suggestions: [
            'Create some tables in your database',
            'Check if you\'re connected to the correct database',
            'Verify user has permission to see tables'
          ]
        }
      });
    }

    // Get dialect information from connection
    let databaseDialect = 'postgresql';
    let connectionType = 'postgresql';
    
    if (dbService.type === 'connection_manager' && dbService.connectionPool) {
      connectionType = dbService.connectionPool.connection.type;
      databaseDialect = connectionManager.getDatabaseDialect(connectionType as any).name;
    }

    // Generate SQL using Enhanced Integration Service (with fallback to Free AI Service)
    const result = await enhancedIntegrationService.generateSql({
      userQuery: query,
      schema: schema,
      databaseDialect,
      connectionType,
      userId,
      sessionId,
      useEnsemble
    });

    logger.info(`SQL generated successfully for query: "${query}"`);

    // Save to history (non-blocking)
    queryHistoryService.saveQuery({
      query,
      sql: result.sql,
      explanation: result.explanation,
      confidence: result.confidence,
      provider: result.provider || 'free-ai'
    }).catch(error => {
      logger.warn('Failed to save query to history:', error);
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error in /generate endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input',
          type: 'validation_error',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate SQL',
        type: 'generation_error'
      }
    });
  }
});

// POST /api/text-to-sql/execute
// Execute a SQL query
router.post('/execute', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { sql, connectionId } = executeSqlSchema.parse(req.body);

    logger.info(`Executing SQL query: ${sql.substring(0, 100)}...${connectionId ? ` for connection: ${connectionId}` : ''}`);

    // Get database service
    let dbService;
    try {
      dbService = await getDatabaseService(connectionId);
    } catch (serviceError) {
      logger.error('Failed to get database service:', serviceError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to access database connection. Please check your connection configuration.',
          type: 'connection_error',
          details: serviceError instanceof Error ? serviceError.message : 'Unknown connection error'
        }
      });
    }

    // Execute the SQL query
    const startTime = Date.now();
    const result = await dbService.executeQuery(sql);
    const executionTime = Date.now() - startTime;

    // Check if the result contains an error (for DatabaseService)
    if ('error' in result && result.error) {
      logger.error(`Query execution failed: ${result.error}`);
      return res.status(400).json({
        success: false,
        error: {
          message: result.error,
          type: 'execution_error',
          suggestions: [
            'Check SQL syntax',
            'Verify table and column names exist',
            'Ensure database connection is working'
          ]
        }
      });
    }

    const queryExecutionTime = 'executionTime' in result ? result.executionTime : Date.now() - startTime;
    logger.info(`Query executed successfully in ${queryExecutionTime}ms. Rows returned: ${result.rows.length}`);

    res.json({
      success: true,
      data: {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map((field: any) => ({
          name: field.name,
          dataTypeID: field.dataTypeID || field.oid
        })) || [],
        executionTime: queryExecutionTime
      }
    });

  } catch (error) {
    logger.error('Error in /execute endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input',
          type: 'validation_error',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to execute query',
        type: 'execution_error',
        suggestions: [
          'Check SQL syntax',
          'Verify table and column names exist',
          'Ensure database connection is working'
        ]
      }
    });
  }
});

// POST /api/text-to-sql/generate-and-execute
// Generate SQL and execute it in one step
router.post('/generate-and-execute', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { query, connectionId, userId, sessionId, useEnsemble } = textToSqlSchema.parse(req.body);

    logger.info(`Received generate-and-execute request: "${query}"${connectionId ? ` for connection: ${connectionId}` : ''}`);

    // Get database service
    let dbService;
    try {
      dbService = await getDatabaseService(connectionId);
    } catch (serviceError) {
      logger.error('Failed to get database service:', serviceError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to access database connection. Please check your connection configuration.',
          type: 'connection_error',
          details: serviceError instanceof Error ? serviceError.message : 'Unknown connection error'
        }
      });
    }

    // Get database schema
    let schema;
    try {
      schema = await dbService.discoverSchema();
    } catch (schemaError) {
      logger.error('Failed to discover database schema:', schemaError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to access database schema. Please check your database connection.',
          type: 'schema_error',
          details: schemaError instanceof Error ? schemaError.message : 'Unknown schema error',
          suggestions: [
            'Verify database connection is working',
            'Check if user has permission to access schema information',
            'Ensure database contains tables'
          ]
        }
      });
    }
    
    if (Object.keys(schema.tables).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No database tables found. The database appears to be empty.',
          type: 'empty_database',
          suggestions: [
            'Create some tables in your database',
            'Check if you\'re connected to the correct database',
            'Verify user has permission to see tables'
          ]
        }
      });
    }

    // Get dialect information from connection
    let databaseDialect = 'postgresql';
    let connectionType = 'postgresql';
    
    if (dbService.type === 'connection_manager' && dbService.connectionPool) {
      connectionType = dbService.connectionPool.connection.type;
      databaseDialect = connectionManager.getDatabaseDialect(connectionType as any).name;
    }

    // Generate SQL using Enhanced Integration Service (with fallback to Free AI Service)
    const sqlResult = await enhancedIntegrationService.generateSql({
      userQuery: query,
      schema: schema,
      databaseDialect,
      connectionType,
      userId,
      sessionId,
      useEnsemble
    });

    logger.info(`SQL generated: ${sqlResult.sql}`);

    // Execute the generated SQL
    const startTime = Date.now();
    const queryResult = await dbService.executeQuery(sqlResult.sql);
    const executionTime = Date.now() - startTime;

    // Check if the query execution failed (for DatabaseService)
    if ('error' in queryResult && queryResult.error) {
      logger.error(`Query execution failed: ${queryResult.error}`);
      return res.status(400).json({
        success: false,
        error: {
          message: queryResult.error,
          type: 'execution_error',
          sql: sqlResult.sql,
          suggestions: [
            'The generated SQL may have issues',
            'Try rephrasing your natural language query',
            'Check if the referenced tables and columns exist'
          ]
        }
      });
    }

    const finalExecutionTime = 'executionTime' in queryResult ? queryResult.executionTime : Date.now() - startTime;
    logger.info(`Query executed successfully in ${finalExecutionTime}ms. Rows returned: ${queryResult.rows.length}`);

    // Generate visualization recommendations (non-blocking)
    let visualizationRecommendation = null;
    try {
      if (queryResult.rows && queryResult.rows.length > 0) {
        visualizationRecommendation = await visualizationService.suggestChartType({
          rows: queryResult.rows,
          rowCount: queryResult.rowCount || queryResult.rows.length,
          fields: queryResult.fields?.map((field: any) => ({
            name: field.name,
            dataTypeID: field.dataTypeID || field.oid
          })) || [],
          executionTime: Number(finalExecutionTime)
        }, query, sqlResult.sql);
      }
    } catch (vizError) {
      logger.warn('Failed to generate visualization recommendations:', vizError);
    }

    // Save to history with execution results (non-blocking)
    queryHistoryService.saveQuery({
      query,
      sql: sqlResult.sql,
      explanation: sqlResult.explanation,
      confidence: sqlResult.confidence,
      provider: sqlResult.provider || 'free-ai',
      resultCount: queryResult.rowCount || 0
    }).catch(error => {
      logger.warn('Failed to save query to history:', error);
    });

    res.json({
      success: true,
      data: {
        // SQL generation info
        sql: sqlResult.sql,
        explanation: sqlResult.explanation,
        confidence: sqlResult.confidence,
        warnings: sqlResult.warnings,
        
        // Query execution results
        rows: queryResult.rows,
        rowCount: queryResult.rowCount,
        fields: queryResult.fields?.map((field: any) => ({
          name: field.name,
          dataTypeID: field.dataTypeID || field.oid
        })) || [],
        executionTime: finalExecutionTime,
        
        // Visualization recommendations
        visualization: visualizationRecommendation
      }
    });

  } catch (error) {
    logger.error('Error in /generate-and-execute endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input',
          type: 'validation_error',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate and execute SQL',
        type: 'generation_execution_error',
        suggestions: [
          'Check your natural language query',
          'Verify database connection is working',
          'Ensure database contains relevant tables'
        ]
      }
    });
  }
});

// GET /api/text-to-sql/providers
// Debug endpoint to see available AI providers
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = enhancedIntegrationService.getAvailableProviders();
    
    res.json({
      success: true,
      data: {
        providers: providers,
        count: providers.length,
        huggingFaceKeyExists: !!process.env.HUGGING_FACE_API_KEY,
        cohereKeyExists: !!process.env.COHERE_API_KEY,
        openaiKeyExists: !!process.env.OPENAI_API_KEY
      }
    });
  } catch (error) {
    logger.error('Error in /providers endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get providers',
        type: 'providers_error'
      }
    });
  }
});

// GET /api/text-to-sql/feature-flags
// Get feature flag status for debugging
router.get('/feature-flags', async (req: Request, res: Response) => {
  try {
    const { userId, connectionType, queryPattern, sessionId } = req.query;
    
    const context = {
      userId: userId as string,
      connectionType: connectionType as string,
      queryPattern: queryPattern as string,
      sessionId: sessionId as string
    };

    const featureFlagStatus = enhancedIntegrationService.getFeatureFlagStatus(context);
    const allFlags = featureFlagService.getAllFlags();
    const stats = featureFlagService.getStats();
    
    res.json({
      success: true,
      data: {
        context,
        flagStatus: featureFlagStatus,
        allFlags,
        stats
      }
    });
  } catch (error) {
    logger.error('Error in /feature-flags endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get feature flags',
        type: 'feature_flags_error'
      }
    });
  }
});

// POST /api/text-to-sql/feature-flags/:flagName
// Update a feature flag (admin endpoint)
router.post('/feature-flags/:flagName', async (req: Request, res: Response) => {
  try {
    const { flagName } = req.params;
    const updates = req.body;
    
    const success = await featureFlagService.updateFlag(flagName, updates);
    
    if (success) {
      res.json({
        success: true,
        message: `Feature flag '${flagName}' updated successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: `Feature flag '${flagName}' not found`,
          type: 'not_found'
        }
      });
    }
  } catch (error) {
    logger.error('Error in /feature-flags/:flagName endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update feature flag',
        type: 'feature_flag_update_error'
      }
    });
  }
});

// GET /api/text-to-sql/monitoring
// Production monitoring dashboard endpoint
router.get('/monitoring', async (req: Request, res: Response) => {
  try {
    const dashboardData = await productionMonitoringService.getMonitoringDashboard();
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Error in /monitoring endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get monitoring data',
        type: 'monitoring_error'
      }
    });
  }
});

// GET /api/text-to-sql/health
// Health check endpoint for system monitoring
router.get('/health', async (req: Request, res: Response) => {
  try {
    const [systemHealth, integrationHealth] = await Promise.all([
      productionMonitoringService.getSystemHealth(),
      enhancedIntegrationService.healthCheck()
    ]);
    
    // Combine health statuses
    const overallStatus = systemHealth.overall === 'healthy' && integrationHealth.status === 'healthy' 
      ? 'healthy' 
      : (systemHealth.overall === 'unhealthy' || integrationHealth.status === 'unhealthy')
        ? 'unhealthy'
        : 'degraded';
    
    // Set appropriate HTTP status based on health
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: {
        status: overallStatus,
        externalServices: systemHealth.services,
        internalServices: integrationHealth.services,
        featureFlags: integrationHealth.featureFlags,
        summary: systemHealth.summary,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Error in /health endpoint:', error);
    res.status(503).json({
      success: false,
      error: {
        message: 'Health check failed',
        type: 'health_check_error'
      }
    });
  }
});

export { router as textToSqlRouter }; 