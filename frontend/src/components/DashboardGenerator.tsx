import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  BarChart as ChartIcon,
  TableChart as TableIcon,
  Assessment as MetricIcon,
  TextFields as TextIcon
} from '@mui/icons-material';
import api from '../services/api';

interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  query: string;
  sql: string;
  visualization: any;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DashboardLayout {
  title: string;
  description: string;
  widgets: DashboardWidget[];
  layout: {
    columns: number;
    rows: number;
  };
}

interface DashboardGeneratorProps {
  connectionId?: string;
  onDashboardGenerated?: (dashboard: DashboardLayout) => void;
}

const getWidgetIcon = (type: string) => {
  switch (type) {
    case 'chart': return <ChartIcon />;
    case 'metric': return <MetricIcon />;
    case 'table': return <TableIcon />;
    case 'text': return <TextIcon />;
    default: return <ChartIcon />;
  }
};

const getWidgetTypeColor = (type: string) => {
  switch (type) {
    case 'chart': return 'primary';
    case 'metric': return 'success';
    case 'table': return 'info';
    case 'text': return 'default';
    default: return 'default';
  }
};

export const DashboardGenerator: React.FC<DashboardGeneratorProps> = ({
  connectionId,
  onDashboardGenerated
}) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedDashboard, setGeneratedDashboard] = useState<DashboardLayout | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleGenerateDashboard = async () => {
    if (!description.trim()) {
      setError('Please provide a description for your dashboard');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/visualization/generate-dashboard', {
        description: description.trim(),
        connectionId
      });

      if (response.data.success) {
        const dashboard = response.data.data;
        setGeneratedDashboard(dashboard);
        setPreviewOpen(true);
        onDashboardGenerated?.(dashboard);
      } else {
        setError(response.data.error?.message || 'Failed to generate dashboard');
      }
    } catch (err: any) {
      console.error('Dashboard generation error:', err);
      setError(
        err.response?.data?.error?.message || 
        'Failed to generate dashboard. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportDashboard = () => {
    if (!generatedDashboard) return;

    const dataStr = JSON.stringify(generatedDashboard, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedDashboard.title.replace(/\s+/g, '_').toLowerCase()}_dashboard.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exampleDescriptions = [
    "Sales performance dashboard showing revenue trends, top products, and customer metrics",
    "User analytics dashboard with registration trends, activity metrics, and engagement data",
    "Financial overview with monthly revenue, expenses, profit margins, and key ratios",
    "E-commerce dashboard showing order volumes, conversion rates, and inventory status",
    "HR dashboard with employee counts, department breakdown, and performance metrics"
  ];

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <DashboardIcon sx={{ mr: 1 }} />
            Generate Dashboard from Description
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Describe what kind of dashboard you want to create, and we'll automatically generate 
            the layout with appropriate widgets and queries based on your database schema.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Dashboard Description"
            placeholder="e.g., Create a sales dashboard showing revenue trends, top products, and customer metrics..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Describe the purpose, key metrics, and type of insights you want to see"
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              onClick={handleGenerateDashboard}
              disabled={loading || !description.trim()}
              startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
            >
              {loading ? 'Generating...' : 'Generate Dashboard'}
            </Button>

            {generatedDashboard && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => setPreviewOpen(true)}
                  startIcon={<PreviewIcon />}
                >
                  Preview
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleExportDashboard}
                  startIcon={<DownloadIcon />}
                >
                  Export JSON
                </Button>
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Example Descriptions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Example Dashboard Descriptions:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {exampleDescriptions.map((example, index) => (
              <Chip
                key={index}
                label={example}
                variant="outlined"
                size="small"
                onClick={() => setDescription(example)}
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Dashboard Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DashboardIcon sx={{ mr: 1 }} />
            Dashboard Preview
          </Box>
          <IconButton onClick={() => setPreviewOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {generatedDashboard && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {generatedDashboard.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {generatedDashboard.description}
              </Typography>

              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Dashboard Layout ({generatedDashboard.layout.columns} columns × {generatedDashboard.layout.rows} rows)
              </Typography>

              <Grid container spacing={2}>
                {generatedDashboard.widgets.map((widget, index) => (
                  <Grid item xs={12} sm={6} md={4} key={widget.id}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          {getWidgetIcon(widget.type)}
                          <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
                            {widget.title}
                          </Typography>
                          <Box sx={{ flexGrow: 1 }} />
                          <Chip
                            label={widget.type}
                            size="small"
                            color={getWidgetTypeColor(widget.type) as any}
                            variant="outlined"
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {widget.query}
                        </Typography>
                        
                        <Box sx={{ 
                          bgcolor: 'background.default', 
                          p: 1, 
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          overflow: 'auto'
                        }}>
                          {widget.sql}
                        </Box>
                        
                        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                          <Chip 
                            label={`${widget.position.width}×${widget.position.height}`} 
                            size="small" 
                            variant="outlined"
                          />
                          <Chip 
                            label={`Position: (${widget.position.x}, ${widget.position.y})`} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {generatedDashboard.widgets.length === 0 && (
                <Alert severity="info">
                  No widgets were generated. Try providing a more specific description 
                  or ensure your database has tables with data.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
          <Button 
            variant="contained" 
            onClick={handleExportDashboard}
            startIcon={<DownloadIcon />}
          >
            Export Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};