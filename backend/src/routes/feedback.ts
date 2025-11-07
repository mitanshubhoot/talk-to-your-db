import express from 'express';
import { enhancedModelManager } from '../services/enhancedModelManager';

const router = express.Router();

// Collect user feedback on generated SQL
router.post('/collect', async (req, res) => {
  try {
    const {
      queryId,
      originalQuery,
      generatedSql,
      correctedSql,
      userRating,
      feedbackType,
      comments,
      userId,
      sessionId,
      modelUsed,
      confidence
    } = req.body;

    // Validate required fields
    if (!queryId || !originalQuery || !generatedSql || !userRating || !feedbackType || !modelUsed) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: queryId, originalQuery, generatedSql, userRating, feedbackType, modelUsed' }
      });
    }

    // Validate rating range
    if (userRating < 1 || userRating > 5) {
      return res.status(400).json({
        success: false,
        error: { message: 'User rating must be between 1 and 5' }
      });
    }

    // Validate feedback type
    if (!['correction', 'rating', 'improvement'].includes(feedbackType)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Feedback type must be one of: correction, rating, improvement' }
      });
    }

    const feedbackId = await enhancedModelManager.collectUserFeedback({
      queryId,
      originalQuery,
      generatedSql,
      correctedSql,
      userRating,
      feedbackType,
      comments,
      userId,
      sessionId,
      modelUsed,
      confidence: confidence || 0
    });

    res.json({
      success: true,
      data: { feedbackId }
    });

  } catch (error) {
    console.error('Error collecting feedback:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to collect feedback' }
    });
  }
});

// Get feedback statistics
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let timeRange: { start: Date; end: Date } | undefined;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };
    }

    const stats = await enhancedModelManager.getFeedbackStats(timeRange);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting feedback stats:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to get feedback statistics' }
    });
  }
});

// Get learning insights from feedback
router.get('/insights', async (req, res) => {
  try {
    const insights = await enhancedModelManager.getLearningInsights();

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Error getting learning insights:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to get learning insights' }
    });
  }
});

// Update user satisfaction for a specific query
router.post('/satisfaction', async (req, res) => {
  try {
    const { modelId, queryType, satisfaction } = req.body;

    if (!modelId || !queryType || satisfaction === undefined) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: modelId, queryType, satisfaction' }
      });
    }

    if (satisfaction < 1 || satisfaction > 5) {
      return res.status(400).json({
        success: false,
        error: { message: 'Satisfaction must be between 1 and 5' }
      });
    }

    await enhancedModelManager.updateUserSatisfaction(modelId, queryType, satisfaction);

    res.json({
      success: true,
      data: { message: 'User satisfaction updated successfully' }
    });

  } catch (error) {
    console.error('Error updating user satisfaction:', error);
    res.status(500).json({
      success: false,
      error: { message: error instanceof Error ? error.message : 'Failed to update user satisfaction' }
    });
  }
});

export default router;