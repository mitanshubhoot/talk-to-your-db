import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  TextField,
  Tabs,
  Tab,
  Tooltip,
  Alert,
  CircularProgress,
  Badge
} from '@mui/material';
import {
  Star,
  StarBorder,
  Delete,
  History,
  Favorite,
  Assignment,
  Search,
  ContentCopy,
  PlayArrow,
  Analytics
} from '@mui/icons-material';
import { historyApi, QueryHistoryItem, QueryTemplate } from '../services/historyApi';

interface Props {
  onQuerySelect: (query: string) => void;
  onSqlSelect?: (sql: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 1 }}>{children}</Box>}
    </div>
  );
}

export const QueryHistory: React.FC<Props> = ({ onQuerySelect, onSqlSelect }) => {
  const [tabValue, setTabValue] = useState(0);
  const [historyItems, setHistoryItems] = useState<QueryHistoryItem[]>([]);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // Load data based on active tab
  useEffect(() => {
    loadData();
  }, [tabValue, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      switch (tabValue) {
        case 0: // Recent
          const recent = await historyApi.getRecentQueries();
          setHistoryItems(recent.items);
          break;
        case 1: // Favorites
          const favorites = await historyApi.getFavorites();
          setHistoryItems(favorites.items);
          break;
        case 2: // Templates
          const templatesData = await historyApi.getTemplates();
          setTemplates(templatesData.templates);
          break;
        case 3: // Search
          if (searchTerm) {
            const searchResults = await historyApi.searchHistory(searchTerm);
            setHistoryItems(searchResults.items);
          } else {
            setHistoryItems([]);
          }
          break;
        case 4: // Analytics
          const analyticsData = await historyApi.getAnalytics();
          setAnalytics(analyticsData);
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleToggleFavorite = async (item: QueryHistoryItem) => {
    try {
      await historyApi.toggleFavorite(item.id);
      // Update local state
      setHistoryItems(prev => 
        prev.map(i => 
          i.id === item.id ? { ...i, favorite: !i.favorite } : i
        )
      );
    } catch (err) {
      setError('Failed to toggle favorite');
    }
  };

  const handleDeleteQuery = async (queryId: string) => {
    if (!window.confirm('Are you sure you want to delete this query?')) return;
    
    try {
      await historyApi.deleteQuery(queryId);
      setHistoryItems(prev => prev.filter(i => i.id !== queryId));
    } catch (err) {
      setError('Failed to delete query');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'error';
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return timestamp.toLocaleDateString();
  };

  const renderHistoryItem = (item: QueryHistoryItem, _index: number) => (
    <ListItem 
      key={item.id} 
      divider={_index < historyItems.length - 1}
      sx={{ 
        cursor: 'pointer', 
        '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
        flexDirection: 'column',
        alignItems: 'stretch',
        py: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          {formatTimestamp(item.timestamp)} • {item.provider}
        </Typography>
        <Box>
          <Chip 
            label={`${item.confidence}%`} 
            size="small" 
            color={getConfidenceColor(item.confidence)}
            sx={{ mr: 1, fontSize: '0.7rem', height: 20 }}
          />
          {item.resultCount !== undefined && (
            <Chip 
              label={`${item.resultCount} rows`} 
              size="small" 
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          )}
        </Box>
      </Box>
      
      <ListItemText
        primary={
          <Typography 
            variant="body2" 
            sx={{ fontWeight: 'medium', mb: 0.5 }}
            onClick={() => onQuerySelect(item.query)}
          >
            {item.query}
          </Typography>
        }
        secondary={
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              fontFamily: 'monospace', 
              fontSize: '0.7rem',
              display: 'block',
              mt: 0.5,
              cursor: 'pointer'
            }}
            onClick={() => onSqlSelect?.(item.sql)}
          >
            {item.sql.length > 60 ? `${item.sql.substring(0, 60)}...` : item.sql}
          </Typography>
        }
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Box>
          {item.tags?.map(tag => (
            <Chip 
              key={tag} 
              label={tag} 
              size="small" 
              variant="outlined" 
              sx={{ mr: 0.5, fontSize: '0.6rem', height: 18 }}
            />
          ))}
        </Box>
        
        <Box>
          <Tooltip title="Copy SQL">
            <IconButton 
              size="small" 
              onClick={() => navigator.clipboard.writeText(item.sql)}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Use Query">
            <IconButton 
              size="small" 
              onClick={() => onQuerySelect(item.query)}
            >
              <PlayArrow fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={item.favorite ? "Remove from favorites" : "Add to favorites"}>
            <IconButton 
              size="small" 
              onClick={() => handleToggleFavorite(item)}
            >
              {item.favorite ? <Star fontSize="small" color="primary" /> : <StarBorder fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton 
              size="small" 
              onClick={() => handleDeleteQuery(item.id)}
              color="error"
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </ListItem>
  );

  const renderTemplateItem = (template: QueryTemplate, _index: number) => (
    <ListItem 
      key={template.id} 
      divider={_index < templates.length - 1}
      sx={{ 
        cursor: 'pointer', 
        '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
        flexDirection: 'column',
        alignItems: 'stretch',
        py: 2
      }}
      onClick={() => onQuerySelect(template.query)}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          {template.name}
        </Typography>
        <Chip 
          label={template.difficulty} 
          size="small" 
          color={template.difficulty === 'beginner' ? 'success' : template.difficulty === 'intermediate' ? 'warning' : 'error'}
          sx={{ fontSize: '0.7rem', height: 20 }}
        />
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {template.description}
      </Typography>
      
      <Typography variant="caption" color="primary" sx={{ fontStyle: 'italic' }}>
        "{template.query}"
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Chip 
          label={template.category} 
          size="small" 
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 18 }}
        />
        <Typography variant="caption" color="text.secondary">
          Tables: {template.expectedTables.join(', ')}
        </Typography>
      </Box>
    </ListItem>
  );

  const renderAnalytics = () => (
    <Box sx={{ p: 2 }}>
      {analytics && (
        <>
          <Typography variant="h6" gutterBottom>Query Analytics</Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
            <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
              <Typography variant="h4" color="primary">{analytics.totalQueries}</Typography>
              <Typography variant="caption">Total Queries</Typography>
            </Box>
            <Box sx={{ textAlign: 'center', p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
              <Typography variant="h4" color="secondary">{analytics.favoriteQueries}</Typography>
              <Typography variant="caption">Favorites</Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Average Confidence</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h5" color="primary" sx={{ mr: 1 }}>
                {analytics.avgConfidence}%
              </Typography>
              <Chip 
                label={analytics.avgConfidence >= 80 ? 'Excellent' : analytics.avgConfidence >= 60 ? 'Good' : 'Needs Improvement'} 
                size="small" 
                color={getConfidenceColor(analytics.avgConfidence)}
              />
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>Top Providers</Typography>
            {analytics.topProviders.map((provider: any, index: number) => (
              <Box key={provider.provider} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">{provider.provider}</Typography>
                <Badge badgeContent={provider.count} color="primary">
                  <Box sx={{ width: 20 }} />
                </Badge>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab icon={<History />} label="Recent" />
          <Tab icon={<Favorite />} label="Favorites" />
          <Tab icon={<Assignment />} label="Templates" />
          <Tab icon={<Search />} label="Search" />
          <Tab icon={<Analytics />} label="Analytics" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ m: 1 }}>
          {error}
        </Alert>
      )}

      {/* Search Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
        </Box>
      </TabPanel>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Recent/Favorites/Search Results */}
            <TabPanel value={tabValue} index={0}>
              {historyItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  No recent queries found
                </Typography>
              ) : (
                <List dense>
                  {historyItems.map(renderHistoryItem)}
                </List>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {historyItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  No favorite queries found
                </Typography>
              ) : (
                <List dense>
                  {historyItems.map(renderHistoryItem)}
                </List>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {templates.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  No templates found
                </Typography>
              ) : (
                <List dense>
                  {templates.map(renderTemplateItem)}
                </List>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              {historyItems.length === 0 && searchTerm ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  No results found for "{searchTerm}"
                </Typography>
              ) : searchTerm ? (
                <List dense>
                  {historyItems.map(renderHistoryItem)}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                  Enter a search term to find queries
                </Typography>
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={4}>
              {renderAnalytics()}
            </TabPanel>
          </>
        )}
      </Box>
    </Box>
  );
}; 