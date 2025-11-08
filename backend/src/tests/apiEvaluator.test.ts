import { SQLAPIEvaluator, APIEvaluationResult, TestResult } from '../services/apiEvaluator';

describe('SQLAPIEvaluator', () => {
  let evaluator: SQLAPIEvaluator;

  beforeEach(() => {
    evaluator = new SQLAPIEvaluator();
  });

  describe('SQL Evaluation Logic', () => {
    test('should correctly evaluate exact SQL matches', () => {
      const generated = 'SELECT * FROM users';
      const expected = 'SELECT * FROM users';
      
      // Access private method for testing
      const result = (evaluator as any).evaluateSQL(generated, expected);
      expect(result).toBe(true);
    });

    test('should handle case insensitive SQL comparison', () => {
      const generated = 'select * from users';
      const expected = 'SELECT * FROM users';
      
      const result = (evaluator as any).evaluateSQL(generated, expected);
      expect(result).toBe(true);
    });

    test('should handle whitespace differences', () => {
      const generated = 'SELECT   *   FROM   users';
      const expected = 'SELECT * FROM users';
      
      const result = (evaluator as any).evaluateSQL(generated, expected);
      expect(result).toBe(true);
    });

    test('should detect different SQL queries', () => {
      const generated = 'SELECT name FROM users';
      const expected = 'SELECT * FROM users';
      
      const result = (evaluator as any).evaluateSQL(generated, expected);
      expect(result).toBe(false);
    });
  });

  describe('SQL Extraction', () => {
    test('should extract SQL from code blocks', () => {
      const response = '```sql\nSELECT * FROM users\n```';
      const result = (evaluator as any).extractSQLFromResponse(response);
      expect(result).toBe('SELECT * FROM users');
    });

    test('should extract SQL with prefixes', () => {
      const response = 'SQL: SELECT * FROM users';
      const result = (evaluator as any).extractSQLFromResponse(response);
      expect(result).toBe('SELECT * FROM users');
    });

    test('should handle plain SQL responses', () => {
      const response = 'SELECT * FROM users';
      const result = (evaluator as any).extractSQLFromResponse(response);
      expect(result).toBe('SELECT * FROM users');
    });
  });

  describe('Prompt Building', () => {
    test('should build proper HuggingFace prompts', () => {
      const testCase = {
        naturalLanguage: 'show me all users',
        expectedSQL: 'SELECT * FROM users',
        schema: 'users(id, name, email)',
        difficulty: 'simple' as const
      };

      const prompt = (evaluator as any).buildHuggingFacePrompt(testCase);
      
      expect(prompt).toContain('### Task');
      expect(prompt).toContain('### Database Schema');
      expect(prompt).toContain('users(id, name, email)');
      expect(prompt).toContain('show me all users');
    });

    test('should build proper OpenAI prompts', () => {
      const testCase = {
        naturalLanguage: 'show me all users',
        expectedSQL: 'SELECT * FROM users',
        schema: 'users(id, name, email)',
        difficulty: 'simple' as const
      };

      const prompt = (evaluator as any).buildOpenAIPrompt(testCase);
      
      expect(prompt.model).toBe('gpt-3.5-turbo');
      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[1].role).toBe('user');
      expect(prompt.messages[1].content).toBe('show me all users');
    });
  });

  describe('Recommendation Generation', () => {
    test('should generate positive recommendations for high accuracy', () => {
      const recommendations = (evaluator as any).generateRecommendations(95, 500, 0);
      
      expect(recommendations).toContain('Excellent accuracy - suitable for production use');
      expect(recommendations).toContain('Fast response times - good user experience');
      expect(recommendations).toContain('High reliability - no errors during testing');
    });

    test('should generate warnings for low accuracy', () => {
      const recommendations = (evaluator as any).generateRecommendations(30, 5000, 3);
      
      expect(recommendations).toContain('Low accuracy - not recommended for production');
      expect(recommendations).toContain('Slow response times - may impact user experience');
      expect(recommendations).toContain('Reliability concerns - multiple errors during testing');
    });

    test('should generate moderate recommendations for medium performance', () => {
      const recommendations = (evaluator as any).generateRecommendations(75, 2000, 1);
      
      expect(recommendations).toContain('Good accuracy - suitable with human review');
      expect(recommendations).toContain('Acceptable response times');
      expect(recommendations).toContain('Good reliability - few errors encountered');
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive comparison report', async () => {
      const mockResults: APIEvaluationResult[] = [
        {
          apiName: 'Test API 1',
          model: 'test-model-1',
          accuracy: 85.5,
          averageLatency: 1200,
          costPerQuery: 0.002,
          rateLimit: '1000/hour',
          reliability: 95.0,
          testResults: [],
          errors: [],
          recommendations: ['Good for production use']
        },
        {
          apiName: 'Test API 2',
          model: 'test-model-2',
          accuracy: 92.3,
          averageLatency: 800,
          costPerQuery: 0.005,
          rateLimit: '500/hour',
          reliability: 98.5,
          testResults: [],
          errors: [],
          recommendations: ['Excellent accuracy']
        }
      ];

      const report = await evaluator.generateComparisonReport(mockResults);
      
      expect(report).toContain('# SQL Generation API Evaluation Report');
      expect(report).toContain('## API Comparison');
      expect(report).toContain('Test API 1');
      expect(report).toContain('Test API 2');
      expect(report).toContain('85.5%');
      expect(report).toContain('92.3%');
      expect(report).toContain('## Overall Recommendations');
    });
  });

  describe('Integration Tests', () => {
    test('should handle API evaluation workflow', async () => {
      // Mock the API calls to avoid actual network requests
      const originalCallHF = (evaluator as any).callHuggingFaceAPI;
      const originalCallOpenAI = (evaluator as any).callOpenAIAPI;
      
      (evaluator as any).callHuggingFaceAPI = jest.fn().mockResolvedValue('SELECT * FROM users');
      (evaluator as any).callOpenAIAPI = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'SELECT * FROM users' }, finish_reason: 'stop' }]
      });

      const results = await evaluator.evaluateAllAPIs();
      
      expect(results).toHaveLength(5); // HF (2 models) + OpenAI + Anthropic + Google
      expect(results[0].apiName).toBe('Hugging Face');
      expect(results[2].apiName).toBe('OpenAI GPT-3.5-turbo');
      
      // Restore original methods
      (evaluator as any).callHuggingFaceAPI = originalCallHF;
      (evaluator as any).callOpenAIAPI = originalCallOpenAI;
    });
  });
});