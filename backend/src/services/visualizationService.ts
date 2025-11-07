import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID?: number; oid?: number }>;
  executionTime?: number;
}

export interface ChartRecommendation {
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

export interface VisualizationRecommendation {
  primary: ChartRecommendation;
  alternatives: ChartRecommendation[];
  insights: string[];
  warnings: string[];
}

export interface DashboardLayout {
  title: string;
  description: string;
  widgets: DashboardWidget[];
  layout: {
    columns: number;
    rows: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  query: string;
  sql: string;
  visualization: ChartRecommendation;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class VisualizationService {
  /**
   * Analyzes query results and suggests the best chart type
   */
  async suggestChartType(
    queryResult: QueryResult,
    originalQuery?: string,
    sql?: string
  ): Promise<VisualizationRecommendation> {
    try {
      const { rows, fields } = queryResult;
      
      if (!rows || rows.length === 0) {
        return {
          primary: {
            type: 'table',
            confidence: 1.0,
            reasoning: 'No data returned - table view is most appropriate',
            config: { title: 'Empty Result' }
          },
          alternatives: [],
          insights: ['Query returned no results'],
          warnings: ['Consider checking your query conditions']
        };
      }

      // Analyze data structure
      const analysis = this.analyzeDataStructure(rows, fields);
      
      // Generate primary recommendation
      const primary = this.generatePrimaryRecommendation(analysis, originalQuery, sql);
      
      // Generate alternative recommendations
      const alternatives = this.generateAlternativeRecommendations(analysis, primary);
      
      // Generate insights and warnings
      const insights = this.generateInsights(analysis, queryResult);
      const warnings = this.generateWarnings(analysis, queryResult);

      return {
        primary,
        alternatives,
        insights,
        warnings
      };
    } catch (error) {
      logger.error('Error suggesting chart type:', error);
      
      return {
        primary: {
          type: 'table',
          confidence: 0.5,
          reasoning: 'Error analyzing data - defaulting to table view',
          config: { title: 'Data Table' }
        },
        alternatives: [],
        insights: [],
        warnings: ['Error occurred during visualization analysis']
      };
    }
  }

  /**
   * Generates dashboard layout from natural language description
   */
  async generateDashboard(
    description: string,
    schema: any,
    connectionId?: string
  ): Promise<DashboardLayout> {
    try {
      // Parse dashboard requirements from natural language
      const requirements = this.parseDashboardRequirements(description);
      
      // Generate queries for each widget
      const widgets = await this.generateDashboardWidgets(requirements, schema);
      
      // Create layout
      const layout = this.createDashboardLayout(widgets, requirements);
      
      return {
        title: requirements.title || 'Generated Dashboard',
        description: requirements.description || description,
        widgets,
        layout
      };
    } catch (error) {
      logger.error('Error generating dashboard:', error);
      throw new Error('Failed to generate dashboard layout');
    }
  }

  /**
   * Analyzes the structure and characteristics of query result data
   */
  private analyzeDataStructure(rows: any[], fields: Array<{ name: string; dataTypeID?: number; oid?: number }>) {
    const rowCount = rows.length;
    const columnCount = fields.length;
    
    const columnAnalysis = fields.map(field => {
      const values = rows.map(row => row[field.name]).filter(v => v !== null && v !== undefined);
      const uniqueValues = new Set(values);
      
      return {
        name: field.name,
        dataType: this.inferDataType(field, values),
        uniqueCount: uniqueValues.size,
        nullCount: rowCount - values.length,
        isNumeric: this.isNumericColumn(field, values),
        isDate: this.isDateColumn(field, values),
        isCategorical: this.isCategoricalColumn(uniqueValues.size, rowCount),
        sampleValues: Array.from(uniqueValues).slice(0, 5)
      };
    });

    const numericColumns = columnAnalysis.filter(col => col.isNumeric);
    const categoricalColumns = columnAnalysis.filter(col => col.isCategorical);
    const dateColumns = columnAnalysis.filter(col => col.isDate);

    return {
      rowCount,
      columnCount,
      columns: columnAnalysis,
      numericColumns,
      categoricalColumns,
      dateColumns,
      hasAggregation: this.detectAggregation(rows, fields),
      hasGrouping: this.detectGrouping(columnAnalysis),
      dataComplexity: this.calculateDataComplexity(columnAnalysis, rowCount)
    };
  }

  /**
   * Generates the primary chart recommendation based on data analysis
   */
  private generatePrimaryRecommendation(
    analysis: any,
    originalQuery?: string,
    sql?: string
  ): ChartRecommendation {
    const { rowCount, numericColumns, categoricalColumns, dateColumns, hasAggregation } = analysis;

    // Single metric (1 row, 1 numeric column)
    if (rowCount === 1 && numericColumns.length === 1) {
      return {
        type: 'metric',
        confidence: 0.95,
        reasoning: 'Single numeric value is best displayed as a metric card',
        config: {
          title: numericColumns[0].name,
          description: 'Key Performance Indicator'
        }
      };
    }

    // Time series data (date column + numeric columns)
    if (dateColumns.length >= 1 && numericColumns.length >= 1) {
      return {
        type: 'line',
        confidence: 0.9,
        reasoning: 'Time-based data with numeric values is ideal for line charts',
        config: {
          xAxis: dateColumns[0].name,
          yAxis: numericColumns[0].name,
          title: `${numericColumns[0].name} over ${dateColumns[0].name}`
        }
      };
    }

    // Categorical breakdown with counts/sums
    if (categoricalColumns.length >= 1 && numericColumns.length >= 1 && hasAggregation) {
      const categoryCol = categoricalColumns[0];
      const numericCol = numericColumns[0];
      
      // Pie chart for small number of categories
      if (categoryCol.uniqueCount <= 8 && rowCount <= 10) {
        return {
          type: 'pie',
          confidence: 0.85,
          reasoning: 'Small number of categories with numeric values work well as pie chart',
          config: {
            groupBy: categoryCol.name,
            yAxis: numericCol.name,
            title: `${numericCol.name} by ${categoryCol.name}`
          }
        };
      }
      
      // Bar chart for larger number of categories
      return {
        type: 'bar',
        confidence: 0.88,
        reasoning: 'Categorical data with numeric values is ideal for bar charts',
        config: {
          xAxis: categoryCol.name,
          yAxis: numericCol.name,
          title: `${numericCol.name} by ${categoryCol.name}`
        }
      };
    }

    // Scatter plot for two numeric columns
    if (numericColumns.length >= 2) {
      return {
        type: 'scatter',
        confidence: 0.8,
        reasoning: 'Two numeric columns can show correlation in scatter plot',
        config: {
          xAxis: numericColumns[0].name,
          yAxis: numericColumns[1].name,
          title: `${numericColumns[1].name} vs ${numericColumns[0].name}`
        }
      };
    }

    // Histogram for single numeric column with many values
    if (numericColumns.length === 1 && rowCount > 20) {
      return {
        type: 'histogram',
        confidence: 0.75,
        reasoning: 'Single numeric column with many values shows distribution well in histogram',
        config: {
          xAxis: numericColumns[0].name,
          title: `Distribution of ${numericColumns[0].name}`
        }
      };
    }

    // Default to table for complex or unclear data
    return {
      type: 'table',
      confidence: 0.6,
      reasoning: 'Data structure is complex or unclear - table provides comprehensive view',
      config: {
        title: 'Data Table'
      }
    };
  }

  /**
   * Generates alternative chart recommendations
   */
  private generateAlternativeRecommendations(
    analysis: any,
    primary: ChartRecommendation
  ): ChartRecommendation[] {
    const alternatives: ChartRecommendation[] = [];
    const { numericColumns, categoricalColumns, dateColumns } = analysis;

    // Always offer table as alternative
    if (primary.type !== 'table') {
      alternatives.push({
        type: 'table',
        confidence: 0.7,
        reasoning: 'Table view shows all data comprehensively',
        config: { title: 'Data Table' }
      });
    }

    // Offer bar chart if not primary
    if (primary.type !== 'bar' && categoricalColumns.length >= 1 && numericColumns.length >= 1) {
      alternatives.push({
        type: 'bar',
        confidence: 0.7,
        reasoning: 'Bar chart alternative for categorical data',
        config: {
          xAxis: categoricalColumns[0].name,
          yAxis: numericColumns[0].name,
          title: `${numericColumns[0].name} by ${categoricalColumns[0].name}`
        }
      });
    }

    // Offer line chart for time series if not primary
    if (primary.type !== 'line' && dateColumns.length >= 1 && numericColumns.length >= 1) {
      alternatives.push({
        type: 'line',
        confidence: 0.75,
        reasoning: 'Line chart alternative for time-based data',
        config: {
          xAxis: dateColumns[0].name,
          yAxis: numericColumns[0].name,
          title: `${numericColumns[0].name} trend`
        }
      });
    }

    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  /**
   * Generates insights about the data
   */
  private generateInsights(analysis: any, queryResult: QueryResult): string[] {
    const insights: string[] = [];
    const { rowCount, numericColumns, categoricalColumns, dateColumns } = analysis;

    insights.push(`Dataset contains ${rowCount} rows and ${analysis.columnCount} columns`);

    if (numericColumns.length > 0) {
      insights.push(`Found ${numericColumns.length} numeric column(s): ${numericColumns.map((c: any) => c.name).join(', ')}`);
    }

    if (categoricalColumns.length > 0) {
      insights.push(`Found ${categoricalColumns.length} categorical column(s) with distinct values`);
    }

    if (dateColumns.length > 0) {
      insights.push(`Time-based data detected in ${dateColumns.length} column(s)`);
    }

    if (analysis.hasAggregation) {
      insights.push('Data appears to be aggregated (grouped/summarized)');
    }

    return insights;
  }

  /**
   * Generates warnings about potential visualization issues
   */
  private generateWarnings(analysis: any, queryResult: QueryResult): string[] {
    const warnings: string[] = [];
    const { rowCount, columns } = analysis;

    if (rowCount > 1000) {
      warnings.push('Large dataset - consider adding filters or pagination for better performance');
    }

    if (columns.some((col: any) => col.nullCount > rowCount * 0.5)) {
      warnings.push('Some columns have many null values - may affect visualization quality');
    }

    if (analysis.categoricalColumns.some((col: any) => col.uniqueCount > 20)) {
      warnings.push('Some categorical columns have many unique values - consider grouping or filtering');
    }

    return warnings;
  }

  /**
   * Parses dashboard requirements from natural language
   */
  private parseDashboardRequirements(description: string) {
    // Simple keyword-based parsing - in production, this could use NLP
    const requirements: any = {
      title: 'Dashboard',
      description,
      widgets: []
    };

    // Extract dashboard title
    const titleMatch = description.match(/dashboard (?:for|about|showing) (.+?)(?:\.|,|$)/i);
    if (titleMatch) {
      requirements.title = titleMatch[1].trim();
    }

    // Identify widget types based on keywords
    const widgetKeywords = {
      metrics: ['kpi', 'metric', 'total', 'count', 'sum', 'average'],
      charts: ['chart', 'graph', 'plot', 'trend', 'over time'],
      tables: ['list', 'table', 'details', 'breakdown']
    };

    for (const [type, keywords] of Object.entries(widgetKeywords)) {
      for (const keyword of keywords) {
        if (description.toLowerCase().includes(keyword)) {
          requirements.widgets.push({ type, keyword });
        }
      }
    }

    return requirements;
  }

  /**
   * Generates dashboard widgets based on requirements
   */
  private async generateDashboardWidgets(requirements: any, schema: any): Promise<DashboardWidget[]> {
    const widgets: DashboardWidget[] = [];
    
    // Generate sample widgets based on schema
    // This is a simplified implementation - in production, this would use AI to generate appropriate queries
    
    let widgetId = 1;
    
    // Add a summary metric widget
    widgets.push({
      id: `widget-${widgetId++}`,
      type: 'metric',
      title: 'Total Records',
      query: 'Show total number of records',
      sql: `SELECT COUNT(*) as total FROM ${Object.keys(schema.tables)[0] || 'users'}`,
      visualization: {
        type: 'metric',
        confidence: 0.9,
        reasoning: 'Count metric for dashboard overview',
        config: { title: 'Total Records' }
      },
      position: { x: 0, y: 0, width: 3, height: 2 }
    });

    // Add a chart widget if we have suitable tables
    if (Object.keys(schema.tables).length > 0) {
      const tableName = Object.keys(schema.tables)[0];
      const table = schema.tables[tableName];
      
      widgets.push({
        id: `widget-${widgetId++}`,
        type: 'chart',
        title: `${tableName} Overview`,
        query: `Show ${tableName} data`,
        sql: `SELECT * FROM ${tableName} LIMIT 100`,
        visualization: {
          type: 'table',
          confidence: 0.8,
          reasoning: 'Table overview for dashboard',
          config: { title: `${tableName} Data` }
        },
        position: { x: 3, y: 0, width: 9, height: 4 }
      });
    }

    return widgets;
  }

  /**
   * Creates dashboard layout configuration
   */
  private createDashboardLayout(widgets: DashboardWidget[], requirements: any) {
    return {
      columns: 12,
      rows: Math.ceil(widgets.length / 2) * 2
    };
  }

  // Helper methods for data analysis
  private inferDataType(field: any, values: any[]): string {
    if (field.dataTypeID) {
      // PostgreSQL data type mapping
      const typeMap: { [key: number]: string } = {
        16: 'boolean',
        20: 'bigint',
        21: 'smallint',
        23: 'integer',
        25: 'text',
        700: 'real',
        701: 'double',
        1043: 'varchar',
        1082: 'date',
        1114: 'timestamp',
        1184: 'timestamptz',
        1700: 'numeric'
      };
      return typeMap[field.dataTypeID] || 'unknown';
    }

    // Infer from values
    if (values.length === 0) return 'unknown';
    
    const sample = values[0];
    if (typeof sample === 'number') return 'numeric';
    if (typeof sample === 'boolean') return 'boolean';
    if (sample instanceof Date) return 'date';
    if (typeof sample === 'string' && !isNaN(Date.parse(sample))) return 'date';
    
    return 'text';
  }

  private isNumericColumn(field: any, values: any[]): boolean {
    const numericTypes = [20, 21, 23, 700, 701, 1700]; // PostgreSQL numeric types
    if (field.dataTypeID && numericTypes.includes(field.dataTypeID)) return true;
    
    return values.length > 0 && values.every(v => typeof v === 'number' && !isNaN(v));
  }

  private isDateColumn(field: any, values: any[]): boolean {
    const dateTypes = [1082, 1114, 1184]; // PostgreSQL date/time types
    if (field.dataTypeID && dateTypes.includes(field.dataTypeID)) return true;
    
    return values.length > 0 && values.every(v => 
      v instanceof Date || (typeof v === 'string' && !isNaN(Date.parse(v)))
    );
  }

  private isCategoricalColumn(uniqueCount: number, totalCount: number): boolean {
    // Consider categorical if unique values are less than 50% of total or less than 20 unique values
    return uniqueCount < Math.min(totalCount * 0.5, 20);
  }

  private detectAggregation(rows: any[], fields: any[]): boolean {
    // Simple heuristic: if we have few rows compared to what might be expected, it's likely aggregated
    return rows.length < 100 && fields.some(f => 
      f.name.toLowerCase().includes('count') || 
      f.name.toLowerCase().includes('sum') || 
      f.name.toLowerCase().includes('avg') ||
      f.name.toLowerCase().includes('total')
    );
  }

  private detectGrouping(columnAnalysis: any[]): boolean {
    // If we have categorical columns with reasonable unique counts, likely grouped
    return columnAnalysis.some(col => col.isCategorical && col.uniqueCount > 1 && col.uniqueCount < 50);
  }

  private calculateDataComplexity(columnAnalysis: any[], rowCount: number): 'simple' | 'medium' | 'complex' {
    const numColumns = columnAnalysis.length;
    
    if (numColumns <= 3 && rowCount <= 100) return 'simple';
    if (numColumns <= 10 && rowCount <= 1000) return 'medium';
    return 'complex';
  }
}

export const visualizationService = new VisualizationService();