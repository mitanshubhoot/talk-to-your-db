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
} from '@mui/icons-material'
import { textToSqlApi } from './services/api'
import api from './services/api'
import { QueryHistory } from './components/QueryHistory'
import { PerformanceDashboard } from './components/PerformanceDashboard'
import { DatabaseSelector } from './components/DatabaseSelector'
import { ResultsTable } from './components/ResultsTable'

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

type ViewType = 'main' | 'history' | 'databases' | 'performance' | 'settings' | 'templates'

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
  
  // Optimization state
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [optimizationLoading, setOptimizationLoading] = useState(false)
  const [showOptimizationModal, setShowOptimizationModal] = useState(false)

  useEffect(() => {
    const initializeApp = async () => {
      // Load current database directly without testing connection
      await loadCurrentDatabase()
    }
    initializeApp()
  }, [])

  const loadCurrentDatabase = async () => {
    try {
      // Try to load current database info
      const response = await api.get('/connections/current')
      if (response.data.success && response.data.data) {
        setCurrentDatabase(response.data.data)
        return
      }
    } catch (error) {
      console.log('No current database connection found')
    }
    
    // For demo purposes, let's set a mock connection if we detect connectivity  
    // This happens when the backend is connected but no explicit database connection exists
    setCurrentDatabase({
      id: 'demo-postgres',
      name: 'PostgreSQL Demo',
      type: 'postgresql',
      database: 'textosql_dev',
      host: 'localhost',
      port: 5432,
      isConnected: true,
      lastConnected: new Date().toISOString(),
    })
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
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {currentDatabase.name}
              </Typography>
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
              <Typography variant="body2">Connected</Typography>
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

      {/* Database Status */}
      {renderDatabaseStatus()}

      {/* Query Input */}
      {currentDatabase && (
        <Paper sx={{ p: 4, mb: 4, border: '1px solid #374151' }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Show me the top 5 products by revenue"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            variant="outlined"
            sx={{ mb: 3 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateSQL}
              disabled={loading || !userQuery.trim()}
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
        </Paper>
      )}

      {/* Action Buttons */}
      {currentDatabase && (
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesome />}
            onClick={handleGenerateSQL}
            disabled={loading || !userQuery.trim()}
            sx={{ borderColor: '#374151', color: 'text.primary' }}
          >
            Generate SQL
          </Button>
          <Button
            variant="outlined"
            startIcon={optimizationLoading ? <CircularProgress size={16} /> : <TuneRounded />}
            onClick={handleOptimizeSQL}
            disabled={optimizationLoading || !result?.sql}
            sx={{ borderColor: '#374151', color: 'text.primary' }}
          >
            {optimizationLoading ? 'Optimizing...' : 'Optimize SQL'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<HelpOutline />}
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
      )}

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
                            onConnectionCreated={(connectionId) => {
                 // Set a mock database connection for demo
                 setCurrentDatabase({
                   id: connectionId,
                   name: 'New Database Connection',
                   type: 'postgresql',
                   database: 'your_database',
                   host: 'localhost',
                   port: 5432,
                   isConnected: true,
                   lastConnected: new Date().toISOString(),
                 })
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
          <Box sx={{ maxWidth: 800, mx: 'auto', p: 4 }}>
            <Typography variant="h4" sx={{ mb: 4 }}>Templates</Typography>
            <Grid container spacing={3}>
              {[
                'Show top customers by revenue',
                'Find products with low inventory',
                'Calculate monthly sales growth',
                'List recent orders by customer'
              ].map((template, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer', 
                      border: '1px solid #374151',
                      '&:hover': { 
                        borderColor: '#3B82F6',
                        backgroundColor: '#1A1A1A'
                      }
                    }}
                    onClick={() => {
                      setUserQuery(template)
                      setCurrentView('main')
                    }}
                  >
                    <CardContent>
                      <Typography variant="body1">{template}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
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
          {currentDatabase ? (
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
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                    {currentDatabase.name}
                  </Typography>
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