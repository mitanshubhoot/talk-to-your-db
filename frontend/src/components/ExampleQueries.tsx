import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
} from '@mui/material'
import {
  Functions,
  FilterAlt,
  Timeline,
  JoinInner,
  Code,
  ExpandMore,
  ExpandLess,
  PlayArrow,
} from '@mui/icons-material'
import api from '../services/api'

interface ExampleQuery {
  id: string
  title: string
  description: string
  query: string
  expectedColumns: string[]
  category: string
}

interface ExampleQueriesProps {
  onQuerySelect: (query: string) => void
  isDemoMode: boolean
}

const categoryConfig = {
  aggregation: {
    label: 'Aggregation',
    icon: <Functions />,
    color: '#3B82F6',
    description: 'Queries that calculate sums, averages, and counts'
  },
  filtering: {
    label: 'Filtering',
    icon: <FilterAlt />,
    color: '#10B981',
    description: 'Queries that filter and search data'
  },
  'time-series': {
    label: 'Time Series',
    icon: <Timeline />,
    color: '#F59E0B',
    description: 'Queries that analyze data over time'
  },
  joins: {
    label: 'Joins',
    icon: <JoinInner />,
    color: '#8B5CF6',
    description: 'Queries that combine data from multiple tables'
  }
}

export const ExampleQueries: React.FC<ExampleQueriesProps> = ({
  onQuerySelect,
  isDemoMode,
}) => {
  const [examples, setExamples] = useState<ExampleQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    'aggregation',
    'filtering',
    'time-series',
    'joins'
  ])
  const [selectedExample, setSelectedExample] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) {
      loadExamples()
    }
  }, [isDemoMode])

  const loadExamples = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.get('/demo/examples')
      if (response.data.success) {
        setExamples(response.data.data.examples)
      } else {
        setError('Failed to load example queries')
      }
    } catch (err: any) {
      console.error('Error loading examples:', err)
      setError(err.response?.data?.error?.message || 'Failed to load example queries')
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryToggle = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleQuerySelect = (example: ExampleQuery) => {
    setSelectedExample(example.id)
    onQuerySelect(example.query)
    
    // Clear selection after a brief moment
    setTimeout(() => setSelectedExample(null), 1000)
  }

  const groupExamplesByCategory = () => {
    const grouped: { [key: string]: ExampleQuery[] } = {}
    
    examples.forEach(example => {
      if (!grouped[example.category]) {
        grouped[example.category] = []
      }
      grouped[example.category].push(example)
    })
    
    return grouped
  }

  if (!isDemoMode) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
        <Alert severity="info">
          Example queries are only available in demo mode. Connect to the demo database to see examples.
        </Alert>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          Loading example queries...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  const groupedExamples = groupExamplesByCategory()

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Example Queries
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Click any query to try it out with the demo database. These examples showcase different SQL capabilities.
        </Typography>
      </Box>

      {/* Categories */}
      {Object.entries(groupedExamples).map(([category, categoryExamples]) => {
        const config = categoryConfig[category as keyof typeof categoryConfig]
        if (!config) return null

        const isExpanded = expandedCategories.includes(category)
        const exampleCount = categoryExamples.length

        return (
          <Paper
            key={category}
            sx={{
              mb: 3,
              border: '1px solid #374151',
              overflow: 'hidden',
            }}
          >
            {/* Category Header */}
            <Box
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                },
              }}
              onClick={() => handleCategoryToggle(category)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: `${config.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: config.color,
                  }}
                >
                  {config.icon}
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {config.label}
                    </Typography>
                    <Chip
                      label={`${exampleCount} ${exampleCount === 1 ? 'query' : 'queries'}`}
                      size="small"
                      sx={{
                        bgcolor: `${config.color}20`,
                        color: config.color,
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {config.description}
                  </Typography>
                </Box>
              </Box>
              <IconButton>
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            {/* Category Examples */}
            <Collapse in={isExpanded}>
              <Box sx={{ p: 3, pt: 0 }}>
                <Grid container spacing={2}>
                  {categoryExamples.map((example) => (
                    <Grid item xs={12} md={6} key={example.id}>
                      <Tooltip
                        title={
                          <Box>
                            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                              {example.title}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
                              {example.description}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)' }}>
                              Returns: {example.expectedColumns.join(', ')}
                            </Typography>
                          </Box>
                        }
                        placement="top"
                        arrow
                      >
                        <Card
                          sx={{
                            border: selectedExample === example.id
                              ? `2px solid ${config.color}`
                              : '1px solid #374151',
                            bgcolor: selectedExample === example.id
                              ? `${config.color}10`
                              : 'background.paper',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              borderColor: config.color,
                              transform: 'translateY(-2px)',
                              boxShadow: `0 8px 25px ${config.color}40`,
                            },
                          }}
                        >
                          <CardActionArea onClick={() => handleQuerySelect(example)}>
                            <CardContent sx={{ p: 3 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                <Box
                                  sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '8px',
                                    bgcolor: `${config.color}20`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: config.color,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Code fontSize="small" />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography
                                    variant="subtitle1"
                                    sx={{
                                      fontWeight: 600,
                                      mb: 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    {example.title}
                                    {selectedExample === example.id && (
                                      <PlayArrow
                                        sx={{
                                          fontSize: 16,
                                          color: config.color,
                                          animation: 'pulse 1s ease-in-out',
                                          '@keyframes pulse': {
                                            '0%, 100%': { opacity: 1 },
                                            '50%': { opacity: 0.5 },
                                          },
                                        }}
                                      />
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: 'text.secondary',
                                      mb: 2,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {example.description}
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {example.expectedColumns.slice(0, 3).map((col) => (
                                      <Chip
                                        key={col}
                                        label={col}
                                        size="small"
                                        sx={{
                                          fontSize: '0.7rem',
                                          height: 20,
                                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                                          color: 'text.secondary',
                                        }}
                                      />
                                    ))}
                                    {example.expectedColumns.length > 3 && (
                                      <Chip
                                        label={`+${example.expectedColumns.length - 3}`}
                                        size="small"
                                        sx={{
                                          fontSize: '0.7rem',
                                          height: 20,
                                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                                          color: 'text.secondary',
                                        }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                              </Box>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Collapse>
          </Paper>
        )
      })}

      {/* Empty State */}
      {examples.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center', border: '1px solid #374151' }}>
          <Code sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            No Example Queries Available
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Example queries will appear here when you're connected to the demo database.
          </Typography>
        </Paper>
      )}
    </Box>
  )
}
