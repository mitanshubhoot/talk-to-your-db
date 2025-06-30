import axios from 'axios'

// Configure API base URL
const getBaseURL = () => {
  // Always use the production backend URL
  return 'https://talk-to-your-db.onrender.com/api'
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
}

export default api 