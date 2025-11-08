import { enhancedIntegrationService } from '../services/enhancedIntegrationService';
import { featureFlagService } from '../services/featureFlagService';

// Mock the production monitoring service to avoid background tasks in tests
jest.mock('../services/productionMonitoringService', () => ({
  productionMonitoringService: {
    recordAPIUsage: jest.fn(),
    trackError: jest.fn(),
    checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 100, resetTime: new Date() }))
  }
}));

describe('Enhanced Integration Service', () => {
  const mockSchema = {
    tables: {
      customers: {
        columns: [
          { 
            column_name: 'id', 
            data_type: 'integer', 
            is_primary_key: true, 
            is_nullable: 'NO',
            table_name: 'customers',
            column_default: null,
            ordinal_position: 1
          },
          { 
            column_name: 'name', 
            data_type: 'varchar', 
            is_primary_key: false, 
            is_nullable: 'NO',
            table_name: 'customers',
            column_default: null,
            ordinal_position: 2
          },
          { 
            column_name: 'email', 
            data_type: 'varchar', 
            is_primary_key: false, 
            is_nullable: 'YES',
            table_name: 'customers',
            column_default: null,
            ordinal_position: 3
          }
        ],
        primaryKeys: ['id'],
        foreignKeys: [],
        indexes: []
      }
    },
    relationships: [],
    views: []
  };

  beforeEach(() => {
    // Reset feature flags to default state
    jest.clearAllMocks();
  });

  test('should generate SQL with enhanced features when enabled', async () => {
    const request = {
      userQuery: 'show me all customers',
      schema: mockSchema,
      connectionType: 'postgresql',
      databaseDialect: 'PostgreSQL',
      userId: 'test-user',
      sessionId: 'test-session'
    };

    const result = await enhancedIntegrationService.generateSql(request);

    expect(result).toBeDefined();
    expect(result.sql).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.provider).toBeDefined();
    expect(result.enhancedFeatures).toBeDefined();
    expect(result.enhancedFeatures?.featureFlagsUsed).toContain('enhanced_sql_generation');
  });

  test('should include dialect information in response', async () => {
    const request = {
      userQuery: 'count all customers',
      schema: mockSchema,
      connectionType: 'mysql',
      databaseDialect: 'MySQL'
    };

    const result = await enhancedIntegrationService.generateSql(request);

    expect(result.dialectUsed).toBe('mysql');
  });

  test('should provide feature flag status', () => {
    const context = {
      userId: 'test-user',
      connectionType: 'postgresql',
      sessionId: 'test-session'
    };

    const status = enhancedIntegrationService.getFeatureFlagStatus(context);

    expect(status).toBeDefined();
    expect(status.enhanced_sql_generation).toBeDefined();
    expect(status.dialect_aware_prompting).toBeDefined();
    expect(status.production_monitoring).toBeDefined();
  });

  test('should perform health check', async () => {
    const health = await enhancedIntegrationService.healthCheck();

    expect(health).toBeDefined();
    expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    expect(health.services).toBeDefined();
    expect(health.featureFlags).toBeDefined();
  });

  test('should get available providers', () => {
    const providers = enhancedIntegrationService.getAvailableProviders();

    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  test('should handle feature flag evaluation', () => {
    // Test that feature flags are properly evaluated
    const enabled = featureFlagService.isEnabled('enhanced_sql_generation');
    expect(typeof enabled).toBe('boolean');

    const allFlags = featureFlagService.getAllFlags();
    expect(Array.isArray(allFlags)).toBe(true);
    expect(allFlags.length).toBeGreaterThan(0);
  });
});