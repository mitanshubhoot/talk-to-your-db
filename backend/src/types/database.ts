export interface DatabaseConnectionConfig {
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mssql' | 'oracle' | 'snowflake' | 'redshift' | 'bigquery' | 'mariadb' | 'mongodb' | 'clickhouse';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filepath?: string; // For SQLite
  ssl?: boolean;
  
  // Cloud-specific parameters
  account?: string; // For Snowflake
  warehouse?: string; // For Snowflake
  role?: string; // For Snowflake
  schema?: string; // For Snowflake/BigQuery
  project?: string; // For BigQuery
  dataset?: string; // For BigQuery
  keyFile?: string; // For BigQuery service account
  cluster?: string; // For Redshift
  region?: string; // For cloud databases
  
  // MongoDB specific
  authSource?: string;
  authMechanism?: string;
  
  isDefault?: boolean;
}

export interface DatabaseConnection extends DatabaseConnectionConfig {
  id: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryPerformance {
  queryId: string;
  sql: string;
  executionTime: number;
  rowsReturned: number;
  connectionId: string;
  timestamp: Date;
  explainPlan?: ExplainPlan;
  optimizationSuggestions?: OptimizationSuggestion[];
}

export interface ExplainPlan {
  plan: any; // Database-specific plan structure
  totalCost: number;
  estimatedRows: number;
  actualTime?: number;
  planType: string;
}

export interface OptimizationSuggestion {
  type: 'index' | 'rewrite' | 'performance' | 'structure';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestedSql?: string;
  impact: string;
}

export interface SchemaComparison {
  connectionA: string;
  connectionB: string;
  differences: SchemaDifference[];
  generatedAt: Date;
}

export interface SchemaDifference {
  type: 'table' | 'column' | 'index' | 'constraint';
  action: 'added' | 'removed' | 'modified';
  objectName: string;
  details: any;
}

export interface DatabaseDialect {
  name: string;
  quotingChar: string;
  limitSyntax: (limit: number, offset?: number) => string;
  dateFormat: string;
  supportsExplain: boolean;
  explainKeyword: string;
} 