import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Grid,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  PieChart as PieChartIcon,
  ScatterPlot as ScatterPlotIcon,
  TableChart as TableChartIcon,
  Dashboard as MetricIcon,
  Timeline as HistogramIcon,
  GridOn as HeatmapIcon,
  Lightbulb as InsightIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

interface ChartRecommendation {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'table' | 'metric' | 'histogram' | 'heatmap';
  confidence: number;
  reasoning: string;
  config: {
    xAxis?: string;
    yAxis?: string | string[];
    groupBy?: string;
    aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max';
    title?: string;
    description?: string;
  };
  alternatives?: ChartRecommendation[];
}

interface VisualizationRecommendation {
  primary: ChartRecommendation;
  alternatives: ChartRecommendation[];
  insights: string[];
  warnings: string[];
}

interface ChartRecommendationProps {
  recommendation: VisualizationRecommendation;
  onChartSelect?: (chartType: string, config: any) => void;
}

const getChartIcon = (type: string) => {
  const iconProps = { fontSize: 'small' as const };
  
  switch (type) {
    case 'bar': return <BarChartIcon {...iconProps} />;
    case 'line': return <LineChartIcon {...iconProps} />;
    case 'pie': return <PieChartIcon {...iconProps} />;
    case 'scatter': return <ScatterPlotIcon {...iconProps} />;
    case 'table': return <TableChartIcon {...iconProps} />;
    case 'metric': return <MetricIcon {...iconProps} />;
    case 'histogram': return <HistogramIcon {...iconProps} />;
    case 'heatmap': return <HeatmapIcon {...iconProps} />;
    default: return <BarChartIcon {...iconProps} />;
  }
};

const getChartName = (type: string) => {
  const names: { [key: string]: string } = {
    bar: 'Bar Chart',
    line: 'Line Chart',
    pie: 'Pie Chart',
    scatter: 'Scatter Plot',
    table: 'Data Table',
    metric: 'Metric Card',
    histogram: 'Histogram',
    heatmap: 'Heatmap'
  };
  return names[type] || type;
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'success';
  if (confidence >= 0.6) return 'warning';
  return 'error';
};

const ChartOption: React.FC<{
  chart: ChartRecommendation;
  isPrimary?: boolean;
  onSelect?: (chartType: string, config: any) => void;
}> = ({ chart, isPrimary = false, onSelect }) => {
  return (
    <Card 
      variant={isPrimary ? 'elevation' : 'outlined'} 
      sx={{ 
        mb: 1,
        border: isPrimary ? '2px solid #1976d2' : undefined,
        cursor: onSelect ? 'pointer' : 'default',
        '&:hover': onSelect ? { 
          boxShadow: 2,
          transform: 'translateY(-1px)',
          transition: 'all 0.2s ease-in-out'
        } : {}
      }}
      onClick={() => onSelect?.(chart.type, chart.config)}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {getChartIcon(chart.type)}
          <Typography variant="subtitle2" sx={{ ml: 1, fontWeight: 'bold' }}>
            {getChartName(chart.type)}
            {isPrimary && (
              <Chip 
                label="Recommended" 
                size="small" 
                color="primary" 
                sx={{ ml: 1, fontSize: '0.7rem' }}
              />
            )}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label={`${Math.round(chart.confidence * 100)}%`}
            size="small"
            color={getConfidenceColor(chart.confidence)}
            variant="outlined"
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {chart.reasoning}
        </Typography>
        
        {chart.config.title && (
          <Typography variant="caption" sx={{ 
            display: 'block', 
            fontStyle: 'italic',
            color: 'text.secondary'
          }}>
            Suggested title: "{chart.config.title}"
          </Typography>
        )}
        
        {(chart.config.xAxis || chart.config.yAxis) && (
          <Box sx={{ mt: 1 }}>
            {chart.config.xAxis && (
              <Chip 
                label={`X: ${chart.config.xAxis}`} 
                size="small" 
                variant="outlined" 
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            )}
            {chart.config.yAxis && (
              <Chip 
                label={`Y: ${Array.isArray(chart.config.yAxis) ? chart.config.yAxis.join(', ') : chart.config.yAxis}`} 
                size="small" 
                variant="outlined" 
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            )}
            {chart.config.groupBy && (
              <Chip 
                label={`Group: ${chart.config.groupBy}`} 
                size="small" 
                variant="outlined" 
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export const ChartRecommendationComponent: React.FC<ChartRecommendationProps> = ({ 
  recommendation, 
  onChartSelect 
}) => {
  const [expanded, setExpanded] = useState<string | false>('primary');

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <BarChartIcon sx={{ mr: 1 }} />
        Visualization Recommendations
      </Typography>

      {/* Primary Recommendation */}
      <Accordion 
        expanded={expanded === 'primary'} 
        onChange={handleAccordionChange('primary')}
        defaultExpanded
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Recommended Visualization
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ChartOption 
            chart={recommendation.primary} 
            isPrimary={true}
            onSelect={onChartSelect}
          />
        </AccordionDetails>
      </Accordion>

      {/* Alternative Recommendations */}
      {recommendation.alternatives.length > 0 && (
        <Accordion 
          expanded={expanded === 'alternatives'} 
          onChange={handleAccordionChange('alternatives')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Alternative Options ({recommendation.alternatives.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1}>
              {recommendation.alternatives.map((chart, index) => (
                <Grid item xs={12} key={index}>
                  <ChartOption 
                    chart={chart}
                    onSelect={onChartSelect}
                  />
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Insights */}
      {recommendation.insights.length > 0 && (
        <Accordion 
          expanded={expanded === 'insights'} 
          onChange={handleAccordionChange('insights')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center' }}>
              <InsightIcon sx={{ mr: 1, fontSize: 'small' }} />
              Data Insights ({recommendation.insights.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {recommendation.insights.map((insight, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={insight}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Warnings */}
      {recommendation.warnings.length > 0 && (
        <Accordion 
          expanded={expanded === 'warnings'} 
          onChange={handleAccordionChange('warnings')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center' }}>
              <WarningIcon sx={{ mr: 1, fontSize: 'small', color: 'warning.main' }} />
              Considerations ({recommendation.warnings.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {recommendation.warnings.map((warning, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={warning}
                    primaryTypographyProps={{ 
                      variant: 'body2',
                      color: 'warning.main'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {onChartSelect && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #374151' }}>
          <Typography variant="caption" color="text.secondary">
            💡 Click on any chart option above to apply the visualization to your data
          </Typography>
        </Box>
      )}
    </Box>
  );
};