import axios from 'axios'

// Configure API base URL
const getBaseURL = () => {
  // Use local development server when running locally
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001/api'
  }
  // Use relative URL in production (same server serves frontend and backend)
  return '/api'
}

// Configure axios defaults
const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data)
    return Promise.reject(error)
  }
)

// API service functions
export const textToSqlApi = {
  // Generate SQL from natural language
  generate: async (query: string) => {
    const response = await api.post('/text-to-sql/generate', { query })
    return response.data
  },

  // Execute SQL query
  execute: async (sql: string) => {
    const response = await api.post('/text-to-sql/execute', { sql })
    return response.data
  },

  // Generate and execute in one step
  generateAndExecute: async (query: string) => {
    const response = await api.post('/text-to-sql/generate-and-execute', { query })
    return response.data
  },

  // Test database connection
  testConnection: async (connectionData: any) => {
    const response = await api.post('/connections/test', connectionData)
    return response.data
  },

  // Get database schema
  getSchema: async () => {
    const response = await api.get('/database/schema')
    return response.data
  },

  // Get list of tables
  getTables: async () => {
    const response = await api.get('/database/tables')
    return response.data
  },

  // Visualization endpoints
  suggestChart: async (queryResult: any, originalQuery?: string, sql?: string) => {
    const response = await api.post('/visualization/suggest-chart', {
      queryResult,
      originalQuery,
      sql
    })
    return response.data
  },

  generateDashboard: async (description: string, connectionId?: string) => {
    const response = await api.post('/visualization/generate-dashboard', {
      description,
      connectionId
    })
    return response.data
  },

  getChartTypes: async () => {
    const response = await api.get('/visualization/chart-types')
    return response.data
  },

  analyzeData: async (queryResult: any) => {
    const response = await api.post('/visualization/analyze-data', {
      queryResult
    })
    return response.data
  },
}

export default api 