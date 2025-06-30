import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { databaseService } from '../services/database';
import { freeAIService } from '../services/freeAiService';
import { queryHistoryService } from '../services/queryHistory';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

const router = Router();

// Validation schemas
const textToSqlSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(500, 'Query too long'),
});

const executeSqlSchema = z.object({
  sql: z.string().min(1, 'SQL cannot be empty'),
});

// POST /api/text-to-sql/generate
// Generate SQL from natural language
router.post('/generate', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { query } = textToSqlSchema.parse(req.body);

    logger.info(`Received text-to-SQL request: "${query}"`);

    // Get database schema
    const schema = await databaseService.discoverSchema();
    
    if (Object.keys(schema.tables).length === 0) {
      return res.status(400).json({
        error: {
          message: 'No database tables found. Please check your database connection.'
        }
      });
    }

    // Generate SQL using Free AI Service
    const result = await freeAIService.generateSql({
      userQuery: query,
      schema: schema
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
        error: {
          message: 'Invalid input',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate SQL'
      }
    });
  }
});

// POST /api/text-to-sql/execute
// Execute a SQL query
router.post('/execute', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { sql } = executeSqlSchema.parse(req.body);

    logger.info(`Executing SQL query: ${sql.substring(0, 100)}...`);

    // Execute the SQL query
    const result = await databaseService.executeQuery(sql);

    logger.info(`Query executed successfully. Rows returned: ${result.rows.length}`);

    res.json({
      success: true,
      data: {
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map(field => ({
          name: field.name,
          dataTypeID: field.dataTypeID
        })) || [],
        executionTime: Date.now() // Simplified timing
      }
    });

  } catch (error) {
    logger.error('Error in /execute endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Invalid input',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to execute query'
      }
    });
  }
});

// POST /api/text-to-sql/generate-and-execute
// Generate SQL and execute it in one step
router.post('/generate-and-execute', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { query } = textToSqlSchema.parse(req.body);

    logger.info(`Received generate-and-execute request: "${query}"`);

    // Get database schema
    const schema = await databaseService.discoverSchema();
    
    if (Object.keys(schema.tables).length === 0) {
      return res.status(400).json({
        error: {
          message: 'No database tables found. Please check your database connection.'
        }
      });
    }

    // Generate SQL using Free AI Service
    const sqlResult = await freeAIService.generateSql({
      userQuery: query,
      schema: schema
    });

    logger.info(`SQL generated: ${sqlResult.sql}`);

    // Execute the generated SQL
    const queryResult = await databaseService.executeQuery(sqlResult.sql);

    logger.info(`Query executed successfully. Rows returned: ${queryResult.rows.length}`);

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
        fields: queryResult.fields?.map(field => ({
          name: field.name,
          dataTypeID: field.dataTypeID
        })) || [],
        executionTime: Date.now() // Simplified timing
      }
    });

  } catch (error) {
    logger.error('Error in /generate-and-execute endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Invalid input',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate and execute SQL'
      }
    });
  }
});

// GET /api/text-to-sql/providers
// Debug endpoint to see available AI providers
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = freeAIService.getAvailableProviders();
    
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
      error: {
        message: 'Failed to get providers'
      }
    });
  }
});

export { router as textToSqlRouter }; 