import { PerformanceMonitor } from '../services/performanceMonitor';
import { FeedbackCollector } from '../services/feedbackCollector';
import { QueryOptimizer } from '../services/queryOptimizer';

describe('Feedback and Performance Monitoring System', () => {
  let performanceMonitor: PerformanceMonitor;
  let feedbackCollector: FeedbackCollector;
  let queryOptimizer: QueryOptimizer;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    feedbackCollector = new FeedbackCollector();
    queryOptimizer = new QueryOptimizer();
  });

  describe('PerformanceMonitor', () => {
    it('should record performance metrics', async () => {
      const metrics = {
        modelId: 'test-model',
        queryType: 'simple',
        accuracy: 85,
        latency: 150,
        userSatisfaction: 4,
        errorRate: 0.1,
        timestamp: new Date(),
        provider: 'OpenAI'
      };

      await expect(performanceMonitor.recordPerformanceMetrics(metrics)).resolves.not.toThrow();
    });

    it('should generate performance dashboard', async () => {
      const dashboard = await performanceMonitor.getPerformanceDashboard();
      
      expect(dashboard).toHaveProperty('totalQueries');
      expect(dashboard).toHaveProperty('successRate');
      expect(dashboard).toHaveProperty('averageConfidence');
      expect(dashboard).toHaveProperty('averageLatency');
      expect(dashboard).toHaveProperty('modelDistribution');
      expect(dashboard).toHaveProperty('queryTypeDistribution');
    });
  });

  describe('FeedbackCollector', () => {
    it('should collect user feedback', async () => {
      const feedback = {
        queryId: 'test-query-123',
        originalQuery: 'show me all users',
        generatedSql: 'SELECT * FROM users;',
        userRating: 4,
        feedbackType: 'rating' as const,
        modelUsed: 'OpenAI GPT-4',
        confidence: 85
      };

      const feedbackId = await feedbackCollector.collectFeedback(feedback);
      expect(feedbackId).toBeDefined();
      expect(typeof feedbackId).toBe('string');
    });

    it('should generate feedback statistics', async () => {
      const stats = await feedbackCollector.getFeedbackStats();
      
      expect(stats).toHaveProperty('totalFeedback');
      expect(stats).toHaveProperty('averageRating');
      expect(stats).toHaveProperty('feedbackByType');
      expect(stats).toHaveProperty('correctionRate');
      expect(stats).toHaveProperty('modelPerformance');
    });

    it('should analyze query patterns', async () => {
      const patterns = await feedbackCollector.analyzeQueryPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('QueryOptimizer', () => {
    const mockSchema = {
      tables: {
        users: {
          columns: [
            { 
              table_name: 'users',
              column_name: 'id', 
              data_type: 'integer', 
              is_primary_key: true, 
              is_nullable: 'NO',
              column_default: null,
              ordinal_position: 1
            },
            { 
              table_name: 'users',
              column_name: 'name', 
              data_type: 'varchar', 
              is_primary_key: false, 
              is_nullable: 'NO',
              column_default: null,
              ordinal_position: 2
            },
            { 
              table_name: 'users',
              column_name: 'email', 
              data_type: 'varchar', 
              is_primary_key: false, 
              is_nullable: 'NO',
              column_default: null,
              ordinal_position: 3
            }
          ],
          primaryKeys: ['id'],
          foreignKeys: [],
          indexes: [],
          rowCount: 1000
        }
      },
      relationships: []
    };

    it('should analyze query performance', async () => {
      const sql = 'SELECT * FROM users WHERE name = \'John\';';
      const analysis = await queryOptimizer.analyzeQuery(sql, mockSchema);
      
      expect(analysis).toHaveProperty('analysis');
      expect(analysis).toHaveProperty('suggestions');
      expect(analysis).toHaveProperty('warnings');
      expect(analysis).toHaveProperty('executionTimeEstimate');
      
      expect(analysis.analysis).toHaveProperty('complexity');
      expect(analysis.analysis).toHaveProperty('tablesInvolved');
      expect(analysis.analysis.tablesInvolved).toContain('users');
    });

    it('should provide optimization tips', () => {
      const sql = 'SELECT * FROM users;';
      const tips = queryOptimizer.getQuickOptimizationTips(sql, mockSchema);
      
      expect(Array.isArray(tips)).toBe(true);
      expect(tips.length).toBeGreaterThan(0);
      expect(tips.some(tip => tip.includes('LIMIT'))).toBe(true);
    });

    it('should suggest query improvements', () => {
      const sql = 'SELECT * FROM users;';
      const improvements = queryOptimizer.suggestQueryImprovements(sql, mockSchema);
      
      expect(improvements).toHaveProperty('improvedSql');
      expect(improvements).toHaveProperty('improvements');
      expect(Array.isArray(improvements.improvements)).toBe(true);
      expect(improvements.improvedSql).toContain('LIMIT');
    });
  });
});