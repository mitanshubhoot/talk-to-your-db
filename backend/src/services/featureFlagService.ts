import fs from 'fs/promises';
import path from 'path';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  conditions?: {
    userIds?: string[];
    connectionTypes?: string[];
    queryPatterns?: string[];
  };
}

export interface FeatureFlagConfig {
  flags: Record<string, FeatureFlag>;
  lastUpdated: Date;
}

/**
 * Feature flag service for gradual rollout and A/B testing
 */
export class FeatureFlagService {
  private configFilePath = path.join(process.cwd(), 'data', 'feature-flags.json');
  private flags = new Map<string, FeatureFlag>();

  constructor() {
    this.initializeDefaultFlags();
    this.loadFlags();
  }

  private initializeDefaultFlags() {
    const defaultFlags: FeatureFlag[] = [
      {
        name: 'enhanced_sql_generation',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Use enhanced SQL generation with advanced models and validation',
        createdAt: new Date(),
        updatedAt: new Date(),
        conditions: {
          connectionTypes: ['postgresql', 'mysql', 'sqlite']
        }
      },
      {
        name: 'dialect_aware_prompting',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Use database dialect-specific prompting for better SQL generation',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'ensemble_generation',
        enabled: false,
        rolloutPercentage: 0,
        description: 'Use ensemble approach with multiple models for complex queries',
        createdAt: new Date(),
        updatedAt: new Date(),
        conditions: {
          queryPatterns: ['complex', 'analytical']
        }
      },
      {
        name: 'advanced_validation',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Use advanced SQL validation and confidence scoring',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'query_optimization_suggestions',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Provide query optimization suggestions in responses',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'production_monitoring',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Enable comprehensive production monitoring and logging',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.name, flag);
    });
  }

  private async loadFlags() {
    try {
      const data = await fs.readFile(this.configFilePath, 'utf-8');
      const config: FeatureFlagConfig = JSON.parse(data);
      
      Object.entries(config.flags).forEach(([name, flag]) => {
        this.flags.set(name, {
          ...flag,
          createdAt: new Date(flag.createdAt),
          updatedAt: new Date(flag.updatedAt)
        });
      });
    } catch (error) {
      // File doesn't exist, save default flags
      await this.saveFlags();
    }
  }

  private async saveFlags() {
    try {
      const config: FeatureFlagConfig = {
        flags: Object.fromEntries(this.flags.entries()),
        lastUpdated: new Date()
      };
      
      await fs.writeFile(this.configFilePath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save feature flags:', error);
    }
  }

  /**
   * Check if a feature flag is enabled for a given context
   */
  isEnabled(
    flagName: string,
    context?: {
      userId?: string;
      connectionType?: string;
      queryPattern?: string;
      sessionId?: string;
    }
  ): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashContext(flagName, context?.userId || context?.sessionId || 'anonymous');
      const bucket = hash % 100;
      if (bucket >= flag.rolloutPercentage) {
        return false;
      }
    }

    // Check conditions
    if (flag.conditions) {
      if (flag.conditions.userIds && context?.userId) {
        if (!flag.conditions.userIds.includes(context.userId)) {
          return false;
        }
      }

      if (flag.conditions.connectionTypes && context?.connectionType) {
        if (!flag.conditions.connectionTypes.includes(context.connectionType)) {
          return false;
        }
      }

      if (flag.conditions.queryPatterns && context?.queryPattern) {
        if (!flag.conditions.queryPatterns.includes(context.queryPattern)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Update a feature flag
   */
  async updateFlag(flagName: string, updates: Partial<FeatureFlag>): Promise<boolean> {
    const flag = this.flags.get(flagName);
    if (!flag) {
      return false;
    }

    const updatedFlag = {
      ...flag,
      ...updates,
      updatedAt: new Date()
    };

    this.flags.set(flagName, updatedFlag);
    await this.saveFlags();
    return true;
  }

  /**
   * Create a new feature flag
   */
  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    if (this.flags.has(flag.name)) {
      return false;
    }

    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.flags.set(flag.name, newFlag);
    await this.saveFlags();
    return true;
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagName: string): Promise<boolean> {
    if (!this.flags.has(flagName)) {
      return false;
    }

    this.flags.delete(flagName);
    await this.saveFlags();
    return true;
  }

  /**
   * Get feature flag evaluation context for logging
   */
  getEvaluationContext(
    flagName: string,
    context?: {
      userId?: string;
      connectionType?: string;
      queryPattern?: string;
      sessionId?: string;
    }
  ): {
    flagName: string;
    enabled: boolean;
    rolloutPercentage: number;
    context: any;
    evaluatedAt: Date;
  } {
    const flag = this.flags.get(flagName);
    const enabled = this.isEnabled(flagName, context);

    return {
      flagName,
      enabled,
      rolloutPercentage: flag?.rolloutPercentage || 0,
      context,
      evaluatedAt: new Date()
    };
  }

  /**
   * Hash context for consistent rollout bucketing
   */
  private hashContext(flagName: string, identifier: string): number {
    const str = `${flagName}:${identifier}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get feature flag statistics
   */
  getStats(): {
    totalFlags: number;
    enabledFlags: number;
    disabledFlags: number;
    partialRolloutFlags: number;
    flagsByRollout: Record<string, number>;
  } {
    const flags = Array.from(this.flags.values());
    
    const stats = {
      totalFlags: flags.length,
      enabledFlags: flags.filter(f => f.enabled).length,
      disabledFlags: flags.filter(f => !f.enabled).length,
      partialRolloutFlags: flags.filter(f => f.enabled && f.rolloutPercentage < 100).length,
      flagsByRollout: {} as Record<string, number>
    };

    // Group by rollout percentage
    flags.forEach(flag => {
      const key = flag.enabled ? `${flag.rolloutPercentage}%` : '0%';
      stats.flagsByRollout[key] = (stats.flagsByRollout[key] || 0) + 1;
    });

    return stats;
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();