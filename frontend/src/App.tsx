import React, { useState, useEffect } from 'react'
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Tooltip,
  Avatar,
  Divider,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  AutoAwesome,
  TuneRounded,
  HelpOutline,
  PlayArrow,
  ExpandLess,
  ExpandMore,
  History,
  Storage,
  Settings as SettingsIcon,
  AddRounded,
  CheckCircle,
  Close,
  SwapHoriz,
  Info,
  Refresh,
} from '@mui/icons-material'
import { textToSqlApi } from './services/api'
import api from './services/api'
import { QueryHistory } from './components/QueryHistory'
import { PerformanceDashboard } from './components/PerformanceDashboard'
import { DatabaseSelector } from './components/DatabaseSelector'
import { ResultsTable } from './components/ResultsTable'
import { ChartRecommendationComponent } from './components/ChartRecommendation'
import { DashboardGenerator } from './components/DashboardGenerator'
import { DemoModeBanner } from './components/DemoModeBanner'
import { ExampleQueries } from './components/ExampleQueries'

const DRAWER_WIDTH = 280

interface QueryResult {
  sql: string
  explanation: string
  confidence: number
  warnings?: string[]
  rows?: any[]
  rowCount?: number
  fields?: Array<{ name: string; dataTypeID: number }>
  provider?: string
  visualization?: any
}

interface OptimizationSuggestion {
  type: 'index' | 'rewrite' | 'performance' | 'structure'
  severity: 'low' | 'medium' | 'high'
  message: string
  suggestedSql?: string
  impact: string
}

interface OptimizationResult {
  suggestions: OptimizationSuggestion[]
  totalSuggestions: number
  suggestionsByType: { [key: string]: number }
  suggestionsBySeverity: { [key: string]: number }
}

interface DatabaseConnection {
  id: string
  name: string
  type: string
  database: string
  host?: string
  port?: number
  isConnected: boolean
  lastConnected?: string
}

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  children?: NavigationItem[]
}

type ViewType = 'main' | 'history' | 'databases' | 'performance' | 'settings' | 'templates' | 'dashboards'

function App() {
  const [result, setResult] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>('main')
  const [userQuery, setUserQuery] = useState('')
  const [expandedNav, setExpandedNav] = useState<string[]>(['assistant', 'configuration'])
  const [currentDatabase, setCurrentDatabase] = useState<DatabaseConnection | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileUpdateLoading, setProfileUpdateLoading] = useState(false)
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false)
  const [connectionLoading, setConnectionLoading] = useState(false)
  
  // Demo mode state
  const [isDemoMode, setIsDemoMode] = useState(false)
  
  // Optimization state
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [optimizationLoading, setOptimizationLoading] = useState(false)
  const [showOptimizationModal, setShowOptimizationModal] = useState(false)

  useEffect(() => {
    const initializeApp = async () => {
      // Check for demo mode and auto-connect if needed
      await checkDemoModeAndAutoConnect()
    }
    initializeApp()
  }, [])

  const loadCurrentDatabase = async () => {
    setConnectionLoading(true)
    try {
      // Try to load current database info
      const response = await api.get('/connections/current')
      if (response.data.success && response.data.data) {
        // Backend has verified connection - safe to display as connected
        const dbData = response.data.data
        setCurrentDatabase({
          ...dbData,
          isConnected: true,
          lastConnected: new Date().toISOString()
        })
        
        // Check if this is a demo connection
        const isDemo = dbData.metadata?.isDemo === true
        setIsDemoMode(isDemo)
        return
      }
    } catch (error: any) {
      // 404 or connection test failed - this is expected behavior
      // Log to console for debugging but don't show error to user
      if (error.response?.status === 404) {
        console.log('No valid database connection found')
      } else {
        console.log('Failed to load database connection:', error.message || error)
      }
    } finally {
      setConnectionLoading(false)
    }
    
    // No valid connection - show disconnected state
    setCurrentDatabase(null)
    setIsDemoMode(false)
  }

  const checkDemoModeAndAutoConnect = async () => {
    setConnectionLoading(true)
    try {
      // First, check if there's an existing connection
      const currentResponse = await api.get('/connections/current')
      if (currentResponse.data.success && currentResponse.data.data) {
        // We have a connection, load it
        const dbData = currentResponse.data.data
        setCurrentDatabase({
          ...dbData,
          isConnected: true,
          lastConnected: new Date().toISOString()
        })
        
        // Check if this is a demo connection
        const isDemo = dbData.metadata?.isDemo === true
        setIsDemoMode(isDemo)
        setConnectionLoading(false)
        return
      }
    } catch (error: any) {
      // No current connection, continue to check demo mode
      console.log('No current connection found, checking demo mode...')
    }

    // No existing connection, check if demo mode should be activated
    try {
      const demoResponse = await api.get('/demo/status')
      if (demoResponse.data.success && demoResponse.data.data) {
        const demoData = demoResponse.data.data
        
        if (demoData.isActive && demoData.connection) {
          // Demo is active and connected, set it as current database
          setCurrentDatabase({
            ...demoData.connection,
            isConnected: true,
            lastConnected: new Date().toISOString(),
            metadata: demoData.metadata
          })
          setIsDemoMode(true)
          console.log('Auto-connected to demo database')
        } else if (demoData.isConfigured && !demoData.isActive) {
          // Demo is configured but not connected, try to initialize it
          try {
            const initResponse = await api.post('/demo/initialize')
            if (initResponse.data.success && initResponse.data.data.connection) {
              const connection = initResponse.data.data.connection
              setCurrentDatabase({
                ...connection,
                isConnected: true,
                lastConnected: new Date().toISOString(),
                metadata: initResponse.data.data.metadata
              })
              setIsDemoMode(true)
              console.log('Demo database initialized and connected')
            }
          } catch (initError) {
            console.log('Failed to initialize demo database:', initError)
            // Fall through to show no connection state
          }
        }
      }
    } catch (error: any) {
      // Demo mode not available or failed, this is okay
      console.log('Demo mode not available:', error.message || error)
    } finally {
      setConnectionLoading(false)
    }
    
    // If we get here and still no connection, show disconnected state
    if (!currentDatabase) {
      setCurrentDatabase(null)
      setIsDemoMode(false)
    }
  }

  const handleNavToggle = (itemId: string) => {
    setExpandedNav(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleNavClick = (itemId: string) => {
    setCurrentView(itemId as ViewType)
  }

  const handleGenerateSQL = async () => {
    if (!userQuery.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await api.post('/text-to-sql/generate-and-execute', { query: userQuery })
      if (response.data.success) {
        setResult(response.data.data)
      } else {
        setError(response.data.error?.message || 'Failed to generate SQL')
      }
    } catch (err) {
      setError('Failed to generate SQL. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizeSQL = async () => {
    if (!result?.sql || !currentDatabase) return

    setOptimizationLoading(true)
    setError(null)

    try {
      // Get optimization suggestions
      const response = await api.post('/performance/suggestions', {
        sql: result.sql,
        executionTime: 1000, // Default execution time for analysis
        connectionId: currentDatabase.id
      })

      if (response.data.success) {
        const suggestions = response.data.data
        
        // Create optimization result with summary
        const optimizationData: OptimizationResult = {
          suggestions,
          totalSuggestions: suggestions.length,
          suggestionsByType: suggestions.reduce((acc: any, s: OptimizationSuggestion) => {
            acc[s.type] = (acc[s.type] || 0) + 1
            return acc
          }, {}),
          suggestionsBySeverity: suggestions.reduce((acc: any, s: OptimizationSuggestion) => {
            acc[s.severity] = (acc[s.severity] || 0) + 1
            return acc
          }, {})
        }
        
        setOptimizationResult(optimizationData)
        setShowOptimizationModal(true)
      } else {
        setError(response.data.error?.message || 'Failed to optimize SQL')
      }
    } catch (err) {
      setError('Failed to optimize SQL. Please check your connection.')
    } finally {
      setOptimizationLoading(false)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      handleGenerateSQL()
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'success'
    if (confidence >= 70) return 'warning'
    return 'error'
  }

  const handleNewChat = () => {
    setUserQuery('')
    setResult(null)
    setError(null)
    setCurrentView('main')
  }

  const refreshConnection = async () => {
    await loadCurrentDatabase()
  }

  const handleProfileUpdate = async () => {
    setProfileUpdateLoading(true)
    setProfileUpdateSuccess(false)
    
    try {
      // Simulate API call to update profile
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In a real app, you would make an API call here
      // const response = await fetch('/api/profile/update', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email: profileEmail, name: profileName })
      // })
      
      setProfileUpdateSuccess(true)
      setTimeout(() => setProfileUpdateSuccess(false), 3000)
      
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setProfileUpdateLoading(false)
    }
  }

  const getNavigationItems = (): NavigationItem[] => [
    {
      id: 'assistant',
      label: 'Assistant',
      icon: <AutoAwesome />,
      children: [
        { id: 'templates', label: 'Templates', icon: <History /> },
        { id: 'history', label: 'History', icon: <History /> },
        { id: 'dashboards', label: 'Dashboards', icon: <AutoAwesome /> },
      ],
    },
    {
      id: 'configuration',
      label: 'Configuration',
      icon: <SettingsIcon />,
      children: [
        { 
          id: 'databases', 
          label: 'Databases', 
          icon: currentDatabase ? (
            <Badge
              badgeContent={<CheckCircle sx={{ fontSize: 10 }} />}
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: 'transparent',
                  color: 'success.main',
                  right: -6,
                  top: -6,
                }
              }}
            >
              <Storage />
            </Badge>
          ) : <Storage />
        },
        { id: 'settings', label: 'Settings', icon: <AutoAwesome /> },
      ],
    },
  ]

  const renderNavItem = (item: NavigationItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedNav.includes(item.id)
    const isSelected = currentView === item.id

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            selected={isSelected}
            onClick={() => hasChildren ? handleNavToggle(item.id) : handleNavClick(item.id)}
            sx={{ pl: 2 + level * 2 }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label} 
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: level === 0 ? 500 : 400 }}
            />
            {hasChildren && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map(child => renderNavItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    )
  }

  const renderDatabaseStatus = () => {
    if (connectionLoading) {
      return (
        <Paper sx={{ p: 3, mb: 4, border: '1px solid #374151' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body1">Loading database connection...</Typography>
          </Box>
        </Paper>
      )
    }

    if (!currentDatabase) {
      return (
        <Paper sx={{ p: 3, mb: 4, border: '1px solid #374151' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Storage sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  No Database Connected
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Connect to a database to start querying
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              onClick={() => setCurrentView('databases')}
              sx={{ px: 3 }}
            >
              Connect Database
            </Button>
          </Box>
        </Paper>
      )
    }

    return (
      <Paper sx={{ p: 3, mb: 4, border: '1px solid #374151' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge
              badgeContent={<CheckCircle sx={{ fontSize: 16 }} />}
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: 'transparent',
                  color: 'success.main',
                  right: -8,
                  top: -8,
                }
              }}
            >
              <Storage sx={{ color: 'primary.main' }} />
            </Badge>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {currentDatabase.name}
                </Typography>
                {isDemoMode && (
                  <Chip
                    label="Demo Mode"
                    size="small"
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      height: 20
                    }}
                  />
                )}
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {currentDatabase.type.toUpperCase()} • {currentDatabase.database}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Database Details">
              <IconButton size="small" onClick={() => setCurrentView('databases')}>
                <Info fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh Connection">
              <IconButton size="small" onClick={refreshConnection} disabled={connectionLoading}>
                {connectionLoading ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Switch Database">
              <IconButton size="small" onClick={() => setCurrentView('databases')}>
                <SwapHoriz fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
              Host
            </Typography>
            <Typography variant="body2">
              {currentDatabase.host}:{currentDatabase.port}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
              Status
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ fontSize: 14, color: 'success.main' }} />
              <Typography variant="body2">
                {isDemoMode ? 'Demo Connected' : 'Connected'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    )
  }

  const renderMainView = () => (
    <Box sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" sx={{ mb: 2, fontWeight: 700 }}>
          Ready to explore your data?
        </Typography>
      </Box>

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <DemoModeBanner
          onConnectDatabase={() => setCurrentView('databases')}
          onViewExamples={() => setCurrentView('templates')}
        />
      )}

      {/* Database Status */}
      {renderDatabaseStatus()}

      {/* Query Input - Always show to make it feel like an AI agent */}
      <Paper sx={{ p: 4, mb: 4, border: '1px solid #374151' }}>
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder={currentDatabase ? "Show me the top 5 products by revenue" : "Ask me anything about databases or SQL..."}
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          variant="outlined"
          sx={{ mb: 3 }}
          disabled={!currentDatabase}
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!currentDatabase && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              Connect a database to start querying your data
            </Typography>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateSQL}
              disabled={loading || !userQuery.trim() || !currentDatabase}
              startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {loading ? 'Generating...' : 'Send'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Action Buttons - Always show to make it feel like an AI agent */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<AutoAwesome />}
          onClick={handleGenerateSQL}
          disabled={loading || !userQuery.trim() || !currentDatabase}
          sx={{ borderColor: '#374151', color: 'text.primary' }}
        >
          Generate SQL
        </Button>
        <Button
          variant="outlined"
          startIcon={optimizationLoading ? <CircularProgress size={16} /> : <TuneRounded />}
          onClick={handleOptimizeSQL}
          disabled={optimizationLoading || !result?.sql || !currentDatabase}
          sx={{ borderColor: '#374151', color: 'text.primary' }}
        >
          {optimizationLoading ? 'Optimizing...' : 'Optimize SQL'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<HelpOutline />}
          disabled={!currentDatabase}
          sx={{ borderColor: '#374151', color: 'text.primary' }}
        >
          Explain SQL
        </Button>
        <Button
          variant="text"
          endIcon={<PlayArrow />}
          onClick={() => setCurrentView('templates')}
          sx={{ color: 'primary.main' }}
        >
          More Templates
        </Button>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Results */}
      {result && (
        <Paper sx={{ p: 4, border: '1px solid #374151' }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Generated SQL</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Chip
                  label={`${result.confidence}% confidence`}
                  color={getConfidenceColor(result.confidence)}
                  size="small"
                />
                {result.provider && (
                  <Chip
                    label={result.provider}
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
            </Box>
            
            <Paper sx={{ p: 2, bgcolor: '#000000', border: '1px solid #374151' }}>
              <Typography variant="body2" component="pre" sx={{ 
                fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                whiteSpace: 'pre-wrap',
                color: '#E2E8F0'
              }}>
                {result.sql}
              </Typography>
            </Paper>
          </Box>

          {result.rows && result.rows.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Results ({result.rowCount} rows)
              </Typography>
              <ResultsTable result={result} />
              
              {/* Visualization Recommendations */}
              {result.visualization && (
                <ChartRecommendationComponent 
                  recommendation={result.visualization}
                  onChartSelect={(chartType, config) => {
                    console.log('Selected chart:', chartType, config);
                    // Here you could implement chart rendering logic
                    alert(`Chart type "${chartType}" selected! In a full implementation, this would render the chart.`);
                  }}
                />
              )}
            </Box>
          )}
        </Paper>
      )}

      {/* Optimization Modal */}
      <Dialog
        open={showOptimizationModal}
        onClose={() => setShowOptimizationModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#000000',
            border: '1px solid #374151',
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid #374151',
          pb: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TuneRounded color="primary" />
            <Typography variant="h6">SQL Optimization Suggestions</Typography>
          </Box>
          <IconButton
            onClick={() => setShowOptimizationModal(false)}
            sx={{ color: 'text.secondary' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {optimizationResult && (
            <Box>
              {/* Summary */}
              <Box sx={{ p: 3, borderBottom: '1px solid #374151' }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Summary</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1A1A1A', border: '1px solid #374151' }}>
                      <Typography variant="h4" color="primary">{optimizationResult.totalSuggestions}</Typography>
                      <Typography variant="body2" color="text.secondary">Total Suggestions</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1A1A1A', border: '1px solid #374151' }}>
                      <Typography variant="h4" sx={{ color: '#ef4444' }}>
                        {optimizationResult.suggestionsBySeverity.high || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">High Priority</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1A1A1A', border: '1px solid #374151' }}>
                      <Typography variant="h4" sx={{ color: '#f59e0b' }}>
                        {optimizationResult.suggestionsBySeverity.medium || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">Medium Priority</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              {/* Suggestions List */}
              <Box sx={{ p: 3 }}>
                {optimizationResult.suggestions.length > 0 ? (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 3 }}>Optimization Suggestions</Typography>
                    {optimizationResult.suggestions.map((suggestion, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 3,
                          mb: 2,
                          bgcolor: '#1A1A1A',
                          border: '1px solid #374151',
                          borderLeftColor: suggestion.severity === 'high' ? '#ef4444' : 
                                          suggestion.severity === 'medium' ? '#f59e0b' : '#10b981',
                          borderLeftWidth: 4
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Chip
                            label={suggestion.type.toUpperCase()}
                            size="small"
                            sx={{ 
                              bgcolor: 'primary.main', 
                              color: 'white',
                              fontWeight: 600 
                            }}
                          />
                          <Chip
                            label={suggestion.severity.toUpperCase()}
                            size="small"
                            sx={{ 
                              bgcolor: suggestion.severity === 'high' ? '#ef4444' : 
                                      suggestion.severity === 'medium' ? '#f59e0b' : '#10b981',
                              color: 'white',
                              fontWeight: 600 
                            }}
                          />
                        </Box>
                        
                        <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
                          {suggestion.message}
                        </Typography>
                        
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                          <strong>Impact:</strong> {suggestion.impact}
                        </Typography>
                        
                        {suggestion.suggestedSql && (
                          <Box>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                              Suggested SQL:
                            </Typography>
                            <Paper sx={{ p: 2, bgcolor: '#000000', border: '1px solid #374151' }}>
                              <Typography 
                                variant="body2" 
                                component="pre" 
                                sx={{ 
                                  fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                  whiteSpace: 'pre-wrap',
                                  color: '#E2E8F0',
                                  fontSize: '0.875rem'
                                }}
                              >
                                {suggestion.suggestedSql}
                              </Typography>
                            </Paper>
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <CheckCircle sx={{ fontSize: 64, color: '#10b981', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>Great Job!</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Your SQL query is already well optimized. No suggestions at this time.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, borderTop: '1px solid #374151' }}>
          <Button
            onClick={() => setShowOptimizationModal(false)}
            variant="outlined"
            sx={{ borderColor: '#374151' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )

  const renderCurrentView = () => {
    switch (currentView) {
      case 'history':
        return (
          <QueryHistory
            onQuerySelect={(query) => {
              setUserQuery(query)
              setCurrentView('main')
            }}
            onSqlSelect={(sql) => alert(`SQL: ${sql}`)}
          />
        )
             case 'databases':
         return (
           <DatabaseSelector
             onConnectionCreated={async (connectionId) => {
               // Reload the current database connection
               await loadCurrentDatabase()
               setCurrentView('main')
             }}
           />
         )
       case 'performance':
         return <PerformanceDashboard isOpen={true} onClose={() => setCurrentView('main')} />
      case 'settings':
        return (
          <Box sx={{ maxWidth: 600, mx: 'auto', p: 4 }}>
            <Typography variant="h4" sx={{ mb: 4 }}>Settings</Typography>
            <Paper sx={{ p: 4, border: '1px solid #374151' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Profile</Typography>
              <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                Manage your personal information
              </Typography>
              
              <TextField
                fullWidth
                label="Name"
                placeholder="Enter your full name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                variant="outlined"
                sx={{ mb: 3 }}
              />
              
              <TextField
                fullWidth
                label="Email"
                placeholder="Enter your email address"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                variant="outlined"
                sx={{ mb: 3 }}
                type="email"
              />
              
              {profileUpdateSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Profile updated successfully!
                </Alert>
              )}
              
              <Button 
                variant="contained" 
                onClick={handleProfileUpdate}
                disabled={profileUpdateLoading}
                startIcon={profileUpdateLoading ? <CircularProgress size={20} /> : undefined}
                sx={{ 
                  minWidth: 140,
                  '&:disabled': { 
                    backgroundColor: 'primary.main', 
                    opacity: 0.7 
                  }
                }}
              >
                {profileUpdateLoading ? 'Updating...' : 'Update profile'}
              </Button>
            </Paper>
          </Box>
        )
      case 'templates':
        return (
          <ExampleQueries
            onQuerySelect={(query) => {
              setUserQuery(query)
              setCurrentView('main')
            }}
            isDemoMode={isDemoMode}
          />
        )
      case 'dashboards':
        return (
          <Box sx={{ maxWidth: 1000, mx: 'auto', p: 4 }}>
            <Typography variant="h4" sx={{ mb: 2 }}>Dashboard Generator</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Create interactive dashboards from natural language descriptions. 
              Describe what you want to see and we'll generate the appropriate widgets and queries.
            </Typography>
            <DashboardGenerator 
              connectionId={currentDatabase?.id}
              onDashboardGenerated={(dashboard) => {
                console.log('Dashboard generated:', dashboard);
              }}
            />
          </Box>
        )
      default:
        return renderMainView()
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 3, borderBottom: '1px solid #374151' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2
            }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                DB
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Talk to your DB
            </Typography>
          </Box>
          
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddRounded />}
            onClick={handleNewChat}
            sx={{
              justifyContent: 'flex-start',
              borderColor: '#374151',
              color: 'text.primary',
              '&:hover': { borderColor: '#4B5563' }
            }}
          >
            New Chat
          </Button>
        </Box>

        {/* Navigation */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <List>
            {getNavigationItems().map(item => renderNavItem(item))}
          </List>
        </Box>

        {/* Bottom Section - Database Status */}
        <Box sx={{ p: 3, borderTop: '1px solid #374151' }}>
          {connectionLoading ? (
            <Paper sx={{ 
              p: 2, 
              background: 'linear-gradient(135deg, #1A1A1A 0%, #374151 100%)',
              border: '1px solid #4B5563'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                  Loading...
                </Typography>
              </Box>
            </Paper>
          ) : currentDatabase ? (
            <Paper sx={{ 
              p: 2, 
              background: 'linear-gradient(135deg, #1A1A1A 0%, #374151 100%)',
              border: '1px solid #4B5563'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Badge
                  badgeContent={<CheckCircle sx={{ fontSize: 12 }} />}
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: 'transparent',
                      color: 'success.main',
                      right: -4,
                      top: -4,
                    }
                  }}
                >
                  <Storage sx={{ color: 'primary.main', fontSize: 20 }} />
                </Badge>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {currentDatabase.name}
                    </Typography>
                    {isDemoMode && (
                      <Chip
                        label="Demo"
                        size="small"
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          height: 16,
                          '& .MuiChip-label': {
                            px: 0.75
                          }
                        }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {currentDatabase.database}
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                onClick={() => setCurrentView('databases')}
                sx={{ color: 'primary.main', p: 0, fontSize: '0.75rem' }}
                fullWidth
              >
                Manage Connection →
              </Button>
            </Paper>
          ) : (
            <Paper sx={{ 
              p: 2, 
              background: 'linear-gradient(135deg, #1A1A1A 0%, #374151 100%)',
              border: '1px solid #4B5563'
            }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Connect your database to start querying your own data with AI.
              </Typography>
              <Button
                size="small"
                onClick={() => setCurrentView('databases')}
                sx={{ color: 'primary.main', p: 0, fontSize: '0.875rem' }}
              >
                Add Database →
              </Button>
            </Paper>
          )}
        </Box>

        {/* User Profile */}
        <Box sx={{ p: 2, borderTop: '1px solid #374151' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                {profileName ? profileName.charAt(0).toUpperCase() : 'U'}
              </Avatar>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {profileName || 'Set up profile'}
              </Typography>
            </Box>
            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setCurrentView('settings')}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
        {renderCurrentView()}
      </Box>
    </Box>
  )
}

export default App 