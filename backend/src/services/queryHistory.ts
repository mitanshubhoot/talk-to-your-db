import { createLogger, format, transports } from 'winston';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface QueryHistoryItem {
  id: string;
  query: string;
  sql: string;
  explanation: string;
  confidence: number;
  provider: string;
  timestamp: Date;
  favorite: boolean;
  executionTime?: number;
  resultCount?: number;
  tags?: string[];
}

export interface QueryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  query: string;
  expectedTables: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export class QueryHistoryService {
  private historyFile: string;
  private templatesFile: string;
  private maxHistoryItems = 1000;

  constructor() {
    // Store in backend directory for persistence
    this.historyFile = path.join(process.cwd(), 'data', 'query-history.json');
    this.templatesFile = path.join(process.cwd(), 'data', 'query-templates.json');
    this.ensureDataDirectory();
    this.initializeTemplates();
  }

  private async ensureDataDirectory() {
    try {
      const dataDir = path.dirname(this.historyFile);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  // Save a query to history
  async saveQuery(item: Omit<QueryHistoryItem, 'id' | 'timestamp' | 'favorite'>): Promise<QueryHistoryItem> {
    try {
      const newItem: QueryHistoryItem = {
        ...item,
        id: this.generateId(),
        timestamp: new Date(),
        favorite: false
      };

      const history = await this.getHistory();
      history.unshift(newItem); // Add to beginning

      // Keep only the most recent items
      if (history.length > this.maxHistoryItems) {
        history.splice(this.maxHistoryItems);
      }

      await this.saveHistory(history);
      logger.info(`Query saved to history: ${newItem.id}`);
      
      return newItem;
    } catch (error) {
      logger.error('Failed to save query to history:', error);
      throw error;
    }
  }

  // Get query history with optional filtering
  async getHistory(options?: {
    limit?: number;
    favoritesOnly?: boolean;
    search?: string;
    category?: string;
  }): Promise<QueryHistoryItem[]> {
    try {
      const history = await this.loadHistory();
      let filtered = [...history];

      // Apply filters
      if (options?.favoritesOnly) {
        filtered = filtered.filter(item => item.favorite);
      }

      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        filtered = filtered.filter(item => 
          item.query.toLowerCase().includes(searchLower) ||
          item.explanation.toLowerCase().includes(searchLower) ||
          item.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Apply limit
      if (options?.limit) {
        filtered = filtered.slice(0, options.limit);
      }

      return filtered;
    } catch (error) {
      logger.error('Failed to get query history:', error);
      return [];
    }
  }

  // Toggle favorite status
  async toggleFavorite(queryId: string): Promise<boolean> {
    try {
      const history = await this.loadHistory();
      const item = history.find(h => h.id === queryId);
      
      if (!item) {
        throw new Error('Query not found');
      }

      item.favorite = !item.favorite;
      await this.saveHistory(history);
      
      logger.info(`Query ${queryId} favorite status: ${item.favorite}`);
      return item.favorite;
    } catch (error) {
      logger.error('Failed to toggle favorite:', error);
      throw error;
    }
  }

  // Delete a query from history
  async deleteQuery(queryId: string): Promise<boolean> {
    try {
      const history = await this.loadHistory();
      const initialLength = history.length;
      const filtered = history.filter(h => h.id !== queryId);
      
      if (filtered.length === initialLength) {
        return false; // Query not found
      }

      await this.saveHistory(filtered);
      logger.info(`Query deleted from history: ${queryId}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete query:', error);
      throw error;
    }
  }

  // Add tags to a query
  async addTags(queryId: string, tags: string[]): Promise<boolean> {
    try {
      const history = await this.loadHistory();
      const item = history.find(h => h.id === queryId);
      
      if (!item) {
        throw new Error('Query not found');
      }

      item.tags = [...(item.tags || []), ...tags].filter((tag, index, arr) => 
        arr.indexOf(tag) === index // Remove duplicates
      );

      await this.saveHistory(history);
      logger.info(`Tags added to query ${queryId}: ${tags.join(', ')}`);
      return true;
    } catch (error) {
      logger.error('Failed to add tags:', error);
      throw error;
    }
  }

  // Get query templates
  async getTemplates(category?: string): Promise<QueryTemplate[]> {
    try {
      const templates = await this.loadTemplates();
      
      if (category) {
        return templates.filter(t => t.category === category);
      }
      
      return templates;
    } catch (error) {
      logger.error('Failed to get templates:', error);
      return [];
    }
  }

  // Get analytics about query usage
  async getAnalytics(): Promise<{
    totalQueries: number;
    favoriteQueries: number;
    topProviders: Array<{ provider: string; count: number }>;
    avgConfidence: number;
    recentActivity: Array<{ date: string; count: number }>;
  }> {
    try {
      const history = await this.loadHistory();
      
      const totalQueries = history.length;
      const favoriteQueries = history.filter(h => h.favorite).length;
      
      // Top providers
      const providerCounts = history.reduce((acc, item) => {
        acc[item.provider] = (acc[item.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topProviders = Object.entries(providerCounts)
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count);
      
      // Average confidence
      const avgConfidence = history.length > 0 
        ? history.reduce((sum, item) => sum + item.confidence, 0) / history.length
        : 0;
      
      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentQueries = history.filter(h => new Date(h.timestamp) >= sevenDaysAgo);
      const dailyCounts = recentQueries.reduce((acc, item) => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const recentActivity = Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      return {
        totalQueries,
        favoriteQueries,
        topProviders,
        avgConfidence: Math.round(avgConfidence),
        recentActivity
      };
    } catch (error) {
      logger.error('Failed to get analytics:', error);
      return {
        totalQueries: 0,
        favoriteQueries: 0,
        topProviders: [],
        avgConfidence: 0,
        recentActivity: []
      };
    }
  }

  private async loadHistory(): Promise<QueryHistoryItem[]> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Convert timestamp strings back to Date objects
      return parsed.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    } catch (error) {
      // File doesn't exist or is invalid, return empty array
      return [];
    }
  }

  private async saveHistory(history: QueryHistoryItem[]): Promise<void> {
    try {
      await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      logger.error('Failed to save history file:', error);
      throw error;
    }
  }

  private async loadTemplates(): Promise<QueryTemplate[]> {
    try {
      const data = await fs.readFile(this.templatesFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist, return default templates
      return this.getDefaultTemplates();
    }
  }

  private async initializeTemplates(): Promise<void> {
    try {
      // Check if templates file exists
      await fs.access(this.templatesFile);
    } catch (error) {
      // File doesn't exist, create it with default templates
      const defaultTemplates = this.getDefaultTemplates();
      await fs.writeFile(this.templatesFile, JSON.stringify(defaultTemplates, null, 2));
      logger.info('Initialized default query templates');
    }
  }

  private getDefaultTemplates(): QueryTemplate[] {
    return [
      {
        id: 'customers-all',
        name: 'View All Customers',
        description: 'Display all customer information',
        category: 'Customer Management',
        query: 'show me all customers',
        expectedTables: ['customers'],
        difficulty: 'beginner'
      },
      {
        id: 'sales-summary',
        name: 'Sales Summary',
        description: 'Get total sales and revenue',
        category: 'Sales Analytics',
        query: 'show me total sales revenue',
        expectedTables: ['orders', 'order_items', 'products'],
        difficulty: 'intermediate'
      },
      {
        id: 'top-customers',
        name: 'Top Customers by Revenue',
        description: 'Find customers who have spent the most',
        category: 'Customer Analytics',
        query: 'show me top 10 customers by total spending',
        expectedTables: ['customers', 'orders', 'order_items'],
        difficulty: 'intermediate'
      },
      {
        id: 'product-performance',
        name: 'Product Performance',
        description: 'Analyze product sales performance',
        category: 'Product Analytics',
        query: 'show me products with highest sales volume',
        expectedTables: ['products', 'order_items'],
        difficulty: 'intermediate'
      },
      {
        id: 'monthly-trends',
        name: 'Monthly Sales Trends',
        description: 'View sales trends by month',
        category: 'Sales Analytics',
        query: 'show me sales by month for this year',
        expectedTables: ['orders', 'order_items'],
        difficulty: 'advanced'
      }
    ];
  }

  private generateId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const queryHistoryService = new QueryHistoryService(); 