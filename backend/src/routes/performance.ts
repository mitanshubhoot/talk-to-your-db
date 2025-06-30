import express from 'express';
import { ConnectionManager } from '../services/connectionManager.js';
import { QueryPerformanceService } from '../services/queryPerformance.js';

const router = express.Router();
const connectionManager = new ConnectionManager();
const performanceService = new QueryPerformanceService(connectionManager);

// Get performance analytics
router.get('/analytics', async (req, res) => {
  try {
    const { connectionId } = req.query;
    const analytics = await performanceService.getPerformanceAnalytics(
      connectionId as string | undefined
    );
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get performance analytics' }
    });
  }
});

// Get optimization report
router.get('/optimization', async (req, res) => {
  try {
    const { connectionId } = req.query;
    const report = await performanceService.getOptimizationReport(
      connectionId as string | undefined
    );
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error getting optimization report:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get optimization report' }
    });
  }
});

// Get explain plan for a query
router.post('/explain', async (req, res) => {
  try {
    const { sql, connectionId } = req.body;
    
    if (!sql || !connectionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'SQL query and connection ID are required' }
      });
    }

    const explainPlan = await performanceService.getExplainPlan(sql, connectionId);
    
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

// Get optimization suggestions for a query
router.post('/suggestions', async (req, res) => {
  try {
    const { sql, executionTime, connectionId } = req.body;
    
    if (!sql || executionTime === undefined || !connectionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'SQL query, execution time, and connection ID are required' }
      });
    }

    const suggestions = await performanceService.generateOptimizationSuggestions(
      sql,
      executionTime,
      connectionId
    );
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error generating optimization suggestions:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to generate optimization suggestions' }
    });
  }
});

// Record query performance manually (useful for testing)
router.post('/record', async (req, res) => {
  try {
    const { queryId, sql, executionTime, rowsReturned, connectionId } = req.body;
    
    if (!queryId || !sql || executionTime === undefined || rowsReturned === undefined || !connectionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Query ID, SQL, execution time, rows returned, and connection ID are required' }
      });
    }

    const performance = await performanceService.recordQueryPerformance(
      queryId,
      sql,
      executionTime,
      rowsReturned,
      connectionId
    );
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Error recording query performance:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to record query performance' }
    });
  }
});

// Get performance summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const { connectionId } = req.query;
    
    // Get both analytics and optimization data
    const [analytics, optimization] = await Promise.all([
      performanceService.getPerformanceAnalytics(connectionId as string | undefined),
      performanceService.getOptimizationReport(connectionId as string | undefined)
    ]);
    
    const summary = {
      totalQueries: analytics.totalQueries,
      averageExecutionTime: Math.round(analytics.averageExecutionTime),
      totalSuggestions: optimization.totalSuggestions,
      criticalSuggestions: optimization.suggestionsBySeverity.high || 0,
      recentTrend: analytics.performanceTrend.slice(-7), // Last 7 days
      topSuggestions: optimization.topSuggestions.slice(0, 5), // Top 5
      slowestQueries: analytics.slowQueries.slice(0, 5) // Top 5 slowest
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting performance summary:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get performance summary' }
    });
  }
});

// Get performance comparison between connections
router.get('/compare', async (req, res) => {
  try {
    const { connectionIds } = req.query;
    
    if (!connectionIds || typeof connectionIds !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Connection IDs are required (comma-separated)' }
      });
    }

    const connectionIdList = connectionIds.split(',').map(id => id.trim());
    
    if (connectionIdList.length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'At least 2 connection IDs are required for comparison' }
      });
    }

    const comparisons = await Promise.all(
      connectionIdList.map(async connectionId => {
        const analytics = await performanceService.getPerformanceAnalytics(connectionId);
        const connections = await connectionManager.listConnections();
        const connection = connections.find(c => c.id === connectionId);
        
        return {
          connectionId,
          connectionName: connection?.name || 'Unknown',
          databaseType: connection?.type || 'Unknown',
          totalQueries: analytics.totalQueries,
          averageExecutionTime: analytics.averageExecutionTime,
          slowQueries: analytics.slowQueries.length,
          mostFrequentQuery: analytics.mostFrequentQueries[0] || null
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        connections: comparisons,
        bestPerforming: comparisons.reduce((best, current) => 
          current.averageExecutionTime < best.averageExecutionTime ? current : best
        ),
        mostActive: comparisons.reduce((most, current) => 
          current.totalQueries > most.totalQueries ? current : most
        )
      }
    });
  } catch (error) {
    console.error('Error comparing performance:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to compare performance' }
    });
  }
});

export default router; 