import api from './api';

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

export interface QueryAnalytics {
  totalQueries: number;
  favoriteQueries: number;
  topProviders: Array<{ provider: string; count: number }>;
  avgConfidence: number;
  recentActivity: Array<{ date: string; count: number }>;
}

export interface HistoryOptions {
  limit?: number;
  favoritesOnly?: boolean;
  search?: string;
  category?: string;
}

export const historyApi = {
  // Save a query to history
  async saveQuery(queryData: {
    query: string;
    sql: string;
    explanation: string;
    confidence: number;
    provider: string;
    executionTime?: number;
    resultCount?: number;
  }): Promise<QueryHistoryItem> {
    const response = await api.post('/history/save', queryData);
    return {
      ...response.data.data,
      timestamp: new Date(response.data.data.timestamp)
    };
  },

  // Get query history with optional filters
  async getHistory(options?: HistoryOptions): Promise<{
    items: QueryHistoryItem[];
    count: number;
  }> {
    const params = new URLSearchParams();
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.favoritesOnly) params.append('favoritesOnly', 'true');
    if (options?.search) params.append('search', options.search);
    if (options?.category) params.append('category', options.category);

    const response = await api.get(`/history?${params.toString()}`);
    
    return {
      items: response.data.data.items.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })),
      count: response.data.data.count
    };
  },

  // Get recent queries (last 10)
  async getRecentQueries(): Promise<{
    items: QueryHistoryItem[];
    count: number;
  }> {
    const response = await api.get('/history/recent');
    
    return {
      items: response.data.data.items.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })),
      count: response.data.data.count
    };
  },

  // Get favorite queries
  async getFavorites(): Promise<{
    items: QueryHistoryItem[];
    count: number;
  }> {
    const response = await api.get('/history/favorites');
    
    return {
      items: response.data.data.items.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })),
      count: response.data.data.count
    };
  },

  // Toggle favorite status
  async toggleFavorite(queryId: string): Promise<{ id: string; favorite: boolean }> {
    const response = await api.post(`/history/${queryId}/favorite`);
    return response.data.data;
  },

  // Delete a query from history
  async deleteQuery(queryId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await api.delete(`/history/${queryId}`);
    return response.data.data;
  },

  // Add tags to a query
  async addTags(queryId: string, tags: string[]): Promise<{ id: string; tags: string[] }> {
    const response = await api.post(`/history/${queryId}/tags`, { tags });
    return response.data.data;
  },

  // Get query templates
  async getTemplates(category?: string): Promise<{
    templates: QueryTemplate[];
    count: number;
  }> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const response = await api.get(`/history/templates${params}`);
    return response.data.data;
  },

  // Get analytics
  async getAnalytics(): Promise<QueryAnalytics> {
    const response = await api.get('/history/analytics');
    return response.data.data;
  },

  // Search history
  async searchHistory(searchTerm: string, limit = 20): Promise<{
    items: QueryHistoryItem[];
    count: number;
  }> {
    return this.getHistory({ 
      search: searchTerm, 
      limit 
    });
  }
}; 