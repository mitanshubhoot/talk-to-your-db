import { Pool, PoolClient } from 'pg';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.simple(),
  transports: [new transports.Console()]
});

export interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
}

export interface EnhancedTableInfo {
  columns: TableInfo[];
  rowCount?: number;
  primaryKeys: string[];
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  indexes: Array<{
    name: string;
    columns: string[];
    isUnique: boolean;
  }>;
}

export interface SchemaInfo {
  tables: Record<string, EnhancedTableInfo>;
  relationships: Array<{
    table: string;
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  views?: Array<{
    name: string;
    definition: string;
  }>;
  lastDiscovered?: Date;
}

export class DatabaseService {
  private pool: Pool | null = null;
  private isInitialized: boolean = false;
  private initializationError: Error | null = null;

  constructor() {
    this.initializePool();
  }

  private initializePool() {
    const databaseUrl = process.env.DATABASE_URL;
    
    logger.info('Initializing database connection pool');
    logger.debug('DATABASE_URL configured:', !!databaseUrl);
    
    if (!databaseUrl) {
      const errorMsg = 'DATABASE_URL environment variable is not configured. Please set DATABASE_URL to connect to your PostgreSQL database.';
      this.initializationError = new Error(errorMsg);
      logger.error(errorMsg);
      return;
    }

    try {
      // Validate DATABASE_URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(databaseUrl);
      } catch (urlError) {
        throw new Error(`Invalid DATABASE_URL format. Expected format: postgresql://username:password@host:port/database`);
      }

      if (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') {
        throw new Error(`Unsupported database protocol: ${parsedUrl.protocol}. Only PostgreSQL is supported.`);
      }

      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased timeout
        statement_timeout: 30000,
        query_timeout: 30000,
      });

      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
        this.initializationError = err;
      });

      this.pool.on('connect', (client) => {
        logger.debug('New database client connected');
      });

      this.pool.on('remove', (client) => {
        logger.debug('Database client removed from pool');
      });

      this.isInitialized = true;
      this.initializationError = null;
      logger.info('Database pool initialized successfully');
    } catch (error) {
      const errorMsg = `Failed to initialize database pool: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.initializationError = new Error(errorMsg);
      logger.error(errorMsg, error);
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    // Check if pool was initialized
    if (!this.isInitialized || !this.pool) {
      const errorMsg = this.initializationError?.message || 'Database pool not initialized';
      logger.error('Connection test failed - pool not initialized:', errorMsg);
      return {
        success: false,
        error: errorMsg,
        details: { 
          initialized: this.isInitialized,
          poolExists: !!this.pool,
          initError: this.initializationError?.message
        }
      };
    }

    let client: any = null;
    try {
      logger.info('Testing database connection...');
      
      // Try to acquire a client from the pool
      client = await this.pool.connect();
      logger.debug('Successfully acquired database client from pool');
      
      // Test with a simple query
      const startTime = Date.now();
      const result = await client.query('SELECT 1 as test, NOW() as current_time, version() as pg_version');
      const duration = Date.now() - startTime;
      
      logger.info(`Database connection test successful (${duration}ms)`);
      logger.debug('Test query result:', result.rows[0]);
      
      return {
        success: true,
        details: {
          duration,
          serverInfo: result.rows[0],
          poolStats: {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
          }
        }
      };
    } catch (error) {
      const errorDetails = this.parseConnectionError(error);
      logger.error('Database connection test failed:', errorDetails);
      
      return {
        success: false,
        error: errorDetails.userMessage,
        details: errorDetails
      };
    } finally {
      if (client) {
        try {
          client.release();
          logger.debug('Released database client back to pool');
        } catch (releaseError) {
          logger.warn('Error releasing database client:', releaseError);
        }
      }
    }
  }

  private parseConnectionError(error: any): { userMessage: string; technicalMessage: string; code?: string; suggestions: string[] } {
    const suggestions: string[] = [];
    let userMessage = 'Database connection failed';
    let technicalMessage = error?.message || 'Unknown error';
    let code = error?.code;

    if (error?.code) {
      switch (error.code) {
        case 'ECONNREFUSED':
          userMessage = 'Cannot connect to database server. The server may be down or unreachable.';
          suggestions.push('Check if PostgreSQL server is running');
          suggestions.push('Verify host and port in DATABASE_URL');
          suggestions.push('Check network connectivity');
          break;
        
        case 'ENOTFOUND':
          userMessage = 'Database host not found. Please check the hostname in your connection string.';
          suggestions.push('Verify the hostname in DATABASE_URL');
          suggestions.push('Check DNS resolution');
          break;
        
        case 'ETIMEDOUT':
          userMessage = 'Connection timed out. The database server may be slow to respond.';
          suggestions.push('Check network connectivity');
          suggestions.push('Increase connection timeout');
          suggestions.push('Verify firewall settings');
          break;
        
        case '28P01':
          userMessage = 'Authentication failed. Please check your username and password.';
          suggestions.push('Verify username and password in DATABASE_URL');
          suggestions.push('Check user permissions in PostgreSQL');
          break;
        
        case '3D000':
          userMessage = 'Database does not exist. Please check the database name.';
          suggestions.push('Verify database name in DATABASE_URL');
          suggestions.push('Create the database if it doesn\'t exist');
          break;
        
        case '28000':
          userMessage = 'Invalid authorization specification. Check user permissions.';
          suggestions.push('Verify user has login permissions');
          suggestions.push('Check pg_hba.conf configuration');
          break;
        
        default:
          userMessage = `Database error (${error.code}): ${error.message}`;
          suggestions.push('Check PostgreSQL server logs for more details');
      }
    } else if (error?.message) {
      if (error.message.includes('password authentication failed')) {
        userMessage = 'Password authentication failed. Please check your credentials.';
        suggestions.push('Verify username and password in DATABASE_URL');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        userMessage = 'The specified database does not exist.';
        suggestions.push('Create the database or check the database name in DATABASE_URL');
      } else if (error.message.includes('SSL')) {
        userMessage = 'SSL connection issue. Check SSL configuration.';
        suggestions.push('Verify SSL settings in DATABASE_URL');
        suggestions.push('Check if server requires SSL');
      }
    }

    return {
      userMessage,
      technicalMessage,
      code,
      suggestions
    };
  }

  async discoverSchema(): Promise<SchemaInfo> {
    if (!this.isInitialized || !this.pool) {
      const errorMsg = this.initializationError?.message || 'Database not configured';
      throw new Error(errorMsg);
    }

    let client: any = null;
    try {
      client = await this.pool.connect();
      logger.info('Starting comprehensive schema discovery...');
      
      // Enhanced query to get all tables and columns with detailed information
      const tablesQuery = `
        SELECT 
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.ordinal_position,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        LEFT JOIN (
          SELECT kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
        ) pk ON t.table_name = pk.table_name AND c.column_name = pk.column_name
        LEFT JOIN (
          SELECT kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ) fk ON t.table_name = fk.table_name AND c.column_name = fk.column_name
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position;
      `;

      const tablesResult = await client.query(tablesQuery);
      
      // Organize tables and columns with enhanced information
      const tables: Record<string, EnhancedTableInfo> = {};
      
      tablesResult.rows.forEach((row: TableInfo) => {
        if (!tables[row.table_name]) {
          tables[row.table_name] = { 
            columns: [], 
            primaryKeys: [],
            foreignKeys: [],
            indexes: []
          };
        }
        tables[row.table_name].columns.push(row);
        
        // Track primary keys
        if (row.is_primary_key) {
          tables[row.table_name].primaryKeys.push(row.column_name);
        }
      });

      // Get foreign key relationships with detailed information
      const relationshipsQuery = `
        SELECT
          kcu.table_name as table,
          kcu.column_name as column,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ORDER BY kcu.table_name, kcu.column_name;
      `;

      const relationshipsResult = await client.query(relationshipsQuery);

      const relationships = relationshipsResult.rows.map((row: any) => ({
        table: row.table,
        column: row.column,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column
      }));

      // Add foreign key information to table metadata
      relationshipsResult.rows.forEach((row: any) => {
        if (tables[row.table]) {
          tables[row.table].foreignKeys.push({
            column: row.column,
            referencedTable: row.referenced_table,
            referencedColumn: row.referenced_column
          });
        }
      });

      // Get indexes for each table
      const indexesQuery = `
        SELECT
          t.relname as table_name,
          i.relname as index_name,
          array_agg(a.attname ORDER BY c.ordinality) as columns,
          ix.indisunique as is_unique
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
        WHERE n.nspname = 'public'
        AND t.relkind = 'r'
        AND NOT ix.indisprimary  -- Exclude primary key indexes
        GROUP BY t.relname, i.relname, ix.indisunique
        ORDER BY t.relname, i.relname;
      `;

      try {
        const indexesResult = await client.query(indexesQuery);
        indexesResult.rows.forEach((row: any) => {
          if (tables[row.table_name]) {
            tables[row.table_name].indexes.push({
              name: row.index_name,
              columns: row.columns,
              isUnique: row.is_unique
            });
          }
        });
      } catch (indexError) {
        logger.warn('Could not retrieve index information:', indexError);
      }

      // Get views information
      const viewsQuery = `
        SELECT 
          table_name as name,
          view_definition as definition
        FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;

      let views: Array<{ name: string; definition: string }> = [];
      try {
        const viewsResult = await client.query(viewsQuery);
        views = viewsResult.rows.map((row: any) => ({
          name: row.name,
          definition: row.definition
        }));
      } catch (viewError) {
        logger.warn('Could not retrieve view information:', viewError);
      }

      // Get row counts for each table (with error handling for large tables)
      const tableNames = Object.keys(tables);
      const rowCountPromises = tableNames.map(async (tableName) => {
        try {
          // Use a timeout for row count queries to avoid hanging on large tables
          const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
          const countResult = await client.query(countQuery);
          return { tableName, count: parseInt(countResult.rows[0].count) };
        } catch (error) {
          logger.warn(`Could not get row count for table ${tableName}:`, error);
          return { tableName, count: 0 };
        }
      });

      // Execute row count queries with a reasonable timeout
      const rowCounts = await Promise.allSettled(rowCountPromises);
      rowCounts.forEach((result, index) => {
        const tableName = tableNames[index];
        if (result.status === 'fulfilled') {
          tables[tableName].rowCount = result.value.count;
        } else {
          logger.warn(`Row count failed for table ${tableName}:`, result.reason);
          tables[tableName].rowCount = 0;
        }
      });

      const discoveryTime = new Date();
      logger.info(`Enhanced schema discovery completed: ${Object.keys(tables).length} tables, ${relationships.length} relationships, ${views.length} views`);

      return {
        tables,
        relationships,
        views,
        lastDiscovered: discoveryTime
      };

    } catch (error) {
      logger.error('Schema discovery failed:', error);
      throw new Error(`Schema discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          logger.warn('Error releasing client during schema discovery:', releaseError);
        }
      }
    }
  }

  async executeQuery(sql: string): Promise<{
    rows: any[];
    rowCount: number;
    fields: Array<{ name: string; dataTypeID?: number; oid?: number }>;
    executionTime: number;
    error?: string;
  }> {
    if (!this.isInitialized || !this.pool) {
      const errorMsg = this.initializationError?.message || 'Database not configured';
      return {
        rows: [],
        rowCount: 0,
        fields: [],
        executionTime: 0,
        error: errorMsg
      };
    }

    let client: any = null;
    const startTime = Date.now();
    
    try {
      const trimmedSql = sql.trim();
      logger.info('Executing query:', trimmedSql.substring(0, 100) + (trimmedSql.length > 100 ? '...' : ''));
      
      // Validate SQL for security - this will throw if invalid
      this.validateSqlSecurity(trimmedSql);

      client = await this.pool.connect();
      
      const result = await client.query(trimmedSql);
      const executionTime = Date.now() - startTime;
      
      logger.info(`Query executed successfully in ${executionTime}ms. Rows returned: ${result.rows.length}`);
      
      // Format the result for frontend consumption
      return {
        rows: result.rows || [],
        rowCount: result.rowCount || result.rows?.length || 0,
        fields: result.fields?.map((field: any) => ({
          name: field.name,
          dataTypeID: field.dataTypeID,
          oid: field.oid
        })) || [],
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Query execution failed:', error);
      
      let errorMessage = 'Query execution failed';
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('syntax error')) {
          errorMessage = `SQL syntax error: ${error.message}. Please check your query syntax.`;
        } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
          errorMessage = `Table or column not found: ${error.message}. Please check table and column names.`;
        } else if (error.message.includes('permission denied')) {
          errorMessage = `Permission denied: ${error.message}. Check user permissions for the requested operation.`;
        } else if (error.message.includes('operations are not allowed')) {
          // This is our security validation error
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        rows: [],
        rowCount: 0,
        fields: [],
        executionTime,
        error: errorMessage
      };
    } finally {
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          logger.warn('Error releasing client after query execution:', releaseError);
        }
      }
    }
  }

  private validateSqlSecurity(sql: string): void {
    const upperSql = sql.toUpperCase().trim();
    
    // Remove comments and normalize whitespace for better detection
    const normalizedSql = upperSql
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // List of dangerous SQL operations
    const dangerousOperations = [
      'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 
      'TRUNCATE', 'GRANT', 'REVOKE', 'COMMIT', 'ROLLBACK',
      'COPY', 'CALL', 'EXECUTE', 'PREPARE'
    ];
    
    // Check if query starts with dangerous operations
    for (const operation of dangerousOperations) {
      const pattern = new RegExp(`^${operation}\\s`, 'i');
      if (pattern.test(normalizedSql) || normalizedSql === operation) {
        throw new Error(`${operation} operations are not allowed for security reasons. Only SELECT queries are permitted.`);
      }
    }

    // Check for multiple statements (semicolon followed by non-whitespace)
    const statements = normalizedSql.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      throw new Error('Multiple SQL statements are not allowed for security reasons.');
    }

    // Additional security checks
    if (normalizedSql.includes('\\COPY') || normalizedSql.includes('\\!')) {
      throw new Error('PostgreSQL meta-commands are not allowed for security reasons.');
    }

    // Ensure the query is a SELECT statement or allowed utility command
    if (!normalizedSql.startsWith('SELECT') && 
        !normalizedSql.startsWith('WITH') && 
        !normalizedSql.startsWith('SHOW') &&
        !normalizedSql.startsWith('EXPLAIN') &&
        !normalizedSql.startsWith('DESCRIBE') &&
        !normalizedSql.startsWith('DESC')) {
      throw new Error('Only SELECT, WITH, SHOW, EXPLAIN, and DESCRIBE statements are allowed.');
    }
  }

  getConnectionStatus(): { 
    initialized: boolean; 
    hasPool: boolean; 
    error?: string;
    poolStats?: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    }
  } {
    const status: {
      initialized: boolean;
      hasPool: boolean;
      error?: string;
      poolStats?: {
        totalCount: number;
        idleCount: number;
        waitingCount: number;
      }
    } = {
      initialized: this.isInitialized,
      hasPool: !!this.pool,
      error: this.initializationError?.message
    };

    if (this.pool) {
      status.poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };
    }

    return status;
  }

  async reinitialize(): Promise<void> {
    logger.info('Reinitializing database connection pool');
    
    // Close existing pool if it exists
    if (this.pool) {
      try {
        await this.pool.end();
        logger.info('Closed existing database pool');
      } catch (error) {
        logger.warn('Error closing existing pool:', error);
      }
    }

    // Reset state
    this.pool = null;
    this.isInitialized = false;
    this.initializationError = null;

    // Reinitialize
    this.initializePool();
  }

  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        logger.info('Database pool closed successfully');
      } catch (error) {
        logger.error('Error closing database pool:', error);
        throw error;
      } finally {
        this.pool = null;
        this.isInitialized = false;
      }
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService(); 