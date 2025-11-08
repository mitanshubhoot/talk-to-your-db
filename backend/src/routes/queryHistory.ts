import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryHistoryService } from '../services/queryHistory';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

const router = Router();

// Validation schemas
const saveQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  sql: z.string().min(1, 'SQL cannot be empty'),
  explanation: z.string().default(''),
  confidence: z.number().min(0).max(100).default(0),
  provider: z.string().default('unknown'),
  executionTime: z.number().optional(),
  resultCount: z.number().optional(),
});

const historyOptionsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  favoritesOnly: z.boolean().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
});

const addTagsSchema = z.object({
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
});

// POST /api/history/save
// Save a query to history
router.post('/save', async (req: Request, res: Response) => {
  try {
    const queryData = saveQuerySchema.parse(req.body);
    
    logger.info(`Saving query to history: "${queryData.query.substring(0, 50)}..."`);
    
    const savedItem = await queryHistoryService.saveQuery(queryData as Omit<import('../services/queryHistory').QueryHistoryItem, 'id' | 'timestamp' | 'favorite'>);
    
    res.json({
      success: true,
      data: savedItem
    });

  } catch (error) {
    logger.error('Error saving query to history:', error);
    
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
        message: error instanceof Error ? error.message : 'Failed to save query'
      }
    });
  }
});

// GET /api/history
// Get query history with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const options = historyOptionsSchema.parse(req.query);
    
    logger.info(`Retrieving query history with options: ${JSON.stringify(options)}`);
    
    const history = await queryHistoryService.getHistory(options);
    
    res.json({
      success: true,
      data: {
        items: history,
        count: history.length
      }
    });

  } catch (error) {
    logger.error('Error retrieving query history:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Invalid query parameters',
          details: error.errors
        }
      });
    }

    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to retrieve history'
      }
    });
  }
});

// POST /api/history/:id/favorite
// Toggle favorite status of a query
router.post('/:id/favorite', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    logger.info(`Toggling favorite status for query: ${id}`);
    
    const isFavorite = await queryHistoryService.toggleFavorite(id);
    
    res.json({
      success: true,
      data: {
        id,
        favorite: isFavorite
      }
    });

  } catch (error) {
    logger.error('Error toggling favorite:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to toggle favorite'
      }
    });
  }
});

// DELETE /api/history/:id
// Delete a query from history
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    logger.info(`Deleting query from history: ${id}`);
    
    const deleted = await queryHistoryService.deleteQuery(id);
    
    if (!deleted) {
      return res.status(404).json({
        error: {
          message: 'Query not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        id,
        deleted: true
      }
    });

  } catch (error) {
    logger.error('Error deleting query:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete query'
      }
    });
  }
});

// POST /api/history/:id/tags
// Add tags to a query
router.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tags } = addTagsSchema.parse(req.body);
    
    logger.info(`Adding tags to query ${id}: ${tags.join(', ')}`);
    
    const success = await queryHistoryService.addTags(id, tags);
    
    if (!success) {
      return res.status(404).json({
        error: {
          message: 'Query not found'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        id,
        tags
      }
    });

  } catch (error) {
    logger.error('Error adding tags:', error);
    
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
        message: error instanceof Error ? error.message : 'Failed to add tags'
      }
    });
  }
});

// GET /api/history/templates
// Get query templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    logger.info(`Retrieving query templates${category ? ` for category: ${category}` : ''}`);
    
    const templates = await queryHistoryService.getTemplates(category as string);
    
    res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });

  } catch (error) {
    logger.error('Error retrieving templates:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to retrieve templates'
      }
    });
  }
});

// GET /api/history/analytics
// Get query history analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    logger.info('Retrieving query history analytics');
    
    const analytics = await queryHistoryService.getAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Error retrieving analytics:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to retrieve analytics'
      }
    });
  }
});

// GET /api/history/recent
// Get recent queries (last 10)
router.get('/recent', async (req: Request, res: Response) => {
  try {
    logger.info('Retrieving recent queries');
    
    const recentQueries = await queryHistoryService.getHistory({ limit: 10 });
    
    res.json({
      success: true,
      data: {
        items: recentQueries,
        count: recentQueries.length
      }
    });

  } catch (error) {
    logger.error('Error retrieving recent queries:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to retrieve recent queries'
      }
    });
  }
});

// GET /api/history/favorites
// Get favorite queries
router.get('/favorites', async (req: Request, res: Response) => {
  try {
    logger.info('Retrieving favorite queries');
    
    const favorites = await queryHistoryService.getHistory({ favoritesOnly: true });
    
    res.json({
      success: true,
      data: {
        items: favorites,
        count: favorites.length
      }
    });

  } catch (error) {
    logger.error('Error retrieving favorite queries:', error);
    
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to retrieve favorites'
      }
    });
  }
});

export { router as queryHistoryRouter }; 