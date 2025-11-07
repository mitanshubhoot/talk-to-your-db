import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { visualizationService, QueryResult } from '../services/visualizationService';
import { ConnectionManager } from '../services/connectionManager';
import { databaseService } from '../services/database';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

const router = Router();
const connectionManager = new ConnectionManager();

// Validation schemas
const chartSuggestionSchema = z.object({
  queryResult: z.object({
    rows: z.array(z.any()),
    rowCount: z.number(),
    fields: z.array(z.object({
      name: z.string(),
      dataTypeID: z.number().optional(),
      oid: z.number().optional()
    })),
    executionTime: z.number().optional()
  }),
  originalQuery: z.string().optional(),
  sql: z.string().optional()
});

const dashboardGenerationSchema = z.object({
  description: z.string().min(1, 'Dashboard description cannot be empty'),
  connectionId: z.string().optional()
});

// Helper function to get database schema
async function getDatabaseSchema(connectionId?: string) {
  if (connectionId) {
    return await connectionManager.discoverSchema(connectionId);
  } else {
    return await databaseService.discoverSchema();
  }
}

// POST /api/visualization/suggest-chart
// Analyze query results and suggest appropriate chart types
router.post('/suggest-chart', async (req: Request, res: Response) => {
  try {
    const { queryResult, originalQuery, sql } = chartSuggestionSchema.parse(req.body);

    logger.info(`Analyzing query results for chart suggestions. Rows: ${queryResult.rows.length}, Columns: ${queryResult.fields.length}`);

    const recommendation = await visualizationService.suggestChartType(
      queryResult as QueryResult,
      originalQuery,
      sql
    );

    logger.info(`Chart suggestion generated: ${recommendation.primary.type} (confidence: ${recommendation.primary.confidence})`);

    res.json({
      success: true,
      data: recommendation
    });

  } catch (error) {
    logger.error('Error in /suggest-chart endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input data',
          type: 'validation_error',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to suggest chart type',
        type: 'chart_suggestion_error'
      }
    });
  }
});

// POST /api/visualization/generate-dashboard
// Generate dashboard layout from natural language description
router.post('/generate-dashboard', async (req: Request, res: Response) => {
  try {
    const { description, connectionId } = dashboardGenerationSchema.parse(req.body);

    logger.info(`Generating dashboard from description: "${description}"${connectionId ? ` for connection: ${connectionId}` : ''}`);

    // Get database schema
    let schema;
    try {
      schema = await getDatabaseSchema(connectionId);
    } catch (schemaError) {
      logger.error('Failed to get database schema:', schemaError);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to access database schema for dashboard generation',
          type: 'schema_error',
          details: schemaError instanceof Error ? schemaError.message : 'Unknown schema error'
        }
      });
    }

    if (Object.keys(schema.tables).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No database tables found. Cannot generate dashboard for empty database.',
          type: 'empty_database'
        }
      });
    }

    const dashboard = await visualizationService.generateDashboard(
      description,
      schema,
      connectionId
    );

    logger.info(`Dashboard generated successfully with ${dashboard.widgets.length} widgets`);

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    logger.error('Error in /generate-dashboard endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input data',
          type: 'validation_error',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate dashboard',
        type: 'dashboard_generation_error'
      }
    });
  }
});

// GET /api/visualization/chart-types
// Get available chart types and their descriptions
router.get('/chart-types', async (req: Request, res: Response) => {
  try {
    const chartTypes = [
      {
        type: 'bar',
        name: 'Bar Chart',
        description: 'Best for comparing categories or showing rankings',
        useCases: ['Categorical data comparison', 'Rankings', 'Counts by category'],
        dataRequirements: {
          minColumns: 2,
          requiredTypes: ['categorical', 'numeric']
        }
      },
      {
        type: 'line',
        name: 'Line Chart',
        description: 'Ideal for showing trends over time',
        useCases: ['Time series data', 'Trends', 'Continuous data'],
        dataRequirements: {
          minColumns: 2,
          requiredTypes: ['date', 'numeric']
        }
      },
      {
        type: 'pie',
        name: 'Pie Chart',
        description: 'Shows parts of a whole, best for small number of categories',
        useCases: ['Proportions', 'Percentages', 'Small categorical breakdowns'],
        dataRequirements: {
          minColumns: 2,
          maxCategories: 8,
          requiredTypes: ['categorical', 'numeric']
        }
      },
      {
        type: 'scatter',
        name: 'Scatter Plot',
        description: 'Shows correlation between two numeric variables',
        useCases: ['Correlation analysis', 'Outlier detection', 'Relationship exploration'],
        dataRequirements: {
          minColumns: 2,
          requiredTypes: ['numeric', 'numeric']
        }
      },
      {
        type: 'histogram',
        name: 'Histogram',
        description: 'Shows distribution of a single numeric variable',
        useCases: ['Distribution analysis', 'Frequency analysis', 'Data exploration'],
        dataRequirements: {
          minColumns: 1,
          minRows: 10,
          requiredTypes: ['numeric']
        }
      },
      {
        type: 'metric',
        name: 'Metric Card',
        description: 'Displays a single key performance indicator',
        useCases: ['KPIs', 'Summary statistics', 'Single value display'],
        dataRequirements: {
          maxRows: 1,
          requiredTypes: ['numeric']
        }
      },
      {
        type: 'table',
        name: 'Data Table',
        description: 'Comprehensive view of all data with sorting and filtering',
        useCases: ['Detailed data exploration', 'Complex data', 'Multiple data types'],
        dataRequirements: {
          minColumns: 1
        }
      },
      {
        type: 'heatmap',
        name: 'Heatmap',
        description: 'Shows patterns in data using color intensity',
        useCases: ['Pattern recognition', 'Correlation matrices', 'Geographic data'],
        dataRequirements: {
          minColumns: 3,
          requiredTypes: ['categorical', 'categorical', 'numeric']
        }
      }
    ];

    res.json({
      success: true,
      data: {
        chartTypes,
        count: chartTypes.length
      }
    });

  } catch (error) {
    logger.error('Error in /chart-types endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get chart types',
        type: 'chart_types_error'
      }
    });
  }
});

// POST /api/visualization/analyze-data
// Analyze data structure without generating specific chart recommendations
router.post('/analyze-data', async (req: Request, res: Response) => {
  try {
    const { queryResult } = chartSuggestionSchema.parse(req.body);

    logger.info(`Analyzing data structure. Rows: ${queryResult.rows.length}, Columns: ${queryResult.fields.length}`);

    // Use the private method through a public wrapper (we'll need to expose this)
    const analysis = {
      rowCount: queryResult.rows.length,
      columnCount: queryResult.fields.length,
      columns: queryResult.fields.map(field => {
        const values = queryResult.rows.map(row => row[field.name]).filter(v => v !== null && v !== undefined);
        const uniqueValues = new Set(values);
        
        return {
          name: field.name,
          dataType: field.dataTypeID ? 'known' : 'inferred',
          uniqueCount: uniqueValues.size,
          nullCount: queryResult.rows.length - values.length,
          sampleValues: Array.from(uniqueValues).slice(0, 5),
          isNumeric: values.length > 0 && values.every(v => typeof v === 'number' && !isNaN(v)),
          hasNulls: queryResult.rows.length > values.length
        };
      }),
      insights: [
        `Dataset contains ${queryResult.rows.length} rows and ${queryResult.fields.length} columns`,
        `Data complexity: ${queryResult.fields.length <= 3 && queryResult.rows.length <= 100 ? 'Simple' : 
                          queryResult.fields.length <= 10 && queryResult.rows.length <= 1000 ? 'Medium' : 'Complex'}`
      ]
    };

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Error in /analyze-data endpoint:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid input data',
          type: 'validation_error',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to analyze data',
        type: 'data_analysis_error'
      }
    });
  }
});

export { router as visualizationRouter };