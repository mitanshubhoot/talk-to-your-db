import { Pool, PoolClient, QueryResult } from 'pg';
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
}

export interface SchemaInfo {
  tables: Record<string, {
    columns: TableInfo[];
    rowCount?: number;
  }>;
  relationships: Array<{
    table: string;
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
}

export class DatabaseService {
  private pool: Pool | null = null;

  constructor() {
    this.initializePool();
  }

  private initializePool() {
    const databaseUrl = process.env.DATABASE_URL;
    
    console.log('DEBUG: DATABASE_URL =', databaseUrl);
    console.log('DEBUG: All env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE')));
    
    if (!databaseUrl) {
      logger.warn('DATABASE_URL not configured. Database functionality will be limited.');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
      });

      logger.info('Database pool initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database pool:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database not configured');
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async discoverSchema(): Promise<SchemaInfo> {
    if (!this.pool) {
      throw new Error('Database not configured');
    }

    const client = await this.pool.connect();
    
    try {
      // Get all tables and columns
      const tablesQuery = `
        SELECT 
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.ordinal_position
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name, c.ordinal_position;
      `;

      const tablesResult = await client.query(tablesQuery);
      
      // Organize tables and columns
      const tables: Record<string, { columns: TableInfo[]; rowCount?: number }> = {};
      
      tablesResult.rows.forEach((row: TableInfo) => {
        if (!tables[row.table_name]) {
          tables[row.table_name] = { columns: [] };
        }
        tables[row.table_name].columns.push(row);
      });

      // Get foreign key relationships
      const relationshipsQuery = `
        SELECT
          kcu.table_name as table,
          kcu.column_name as column,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
      `;

      const relationshipsResult = await client.query(relationshipsQuery);

      const relationships = relationshipsResult.rows.map(row => ({
        table: row.table,
        column: row.column,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column
      }));

      // Get row counts for each table (for context)
      for (const tableName of Object.keys(tables)) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          tables[tableName].rowCount = parseInt(countResult.rows[0].count);
        } catch (error) {
          logger.warn(`Could not get row count for table ${tableName}:`, error);
          tables[tableName].rowCount = 0;
        }
      }

      logger.info(`Discovered schema: ${Object.keys(tables).length} tables, ${relationships.length} relationships`);

      return {
        tables,
        relationships
      };

    } finally {
      client.release();
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database not configured');
    }

    const client = await this.pool.connect();
    
    try {
      logger.info('Executing query:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
      
      // Add basic safety checks
      const upperSql = sql.trim().toUpperCase();
      if (upperSql.startsWith('DROP') || 
          upperSql.startsWith('DELETE') || 
          upperSql.startsWith('UPDATE') ||
          upperSql.startsWith('INSERT') ||
          upperSql.startsWith('ALTER') ||
          upperSql.startsWith('CREATE')) {
        throw new Error('Only SELECT queries are allowed for security reasons');
      }

      const result = await client.query(sql);
      logger.info(`Query executed successfully. Rows returned: ${result.rows.length}`);
      
      return result;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database pool closed');
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService(); 