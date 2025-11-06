import { Pool, PoolConfig } from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseConnection, DatabaseConnectionConfig, SchemaComparison, SchemaDifference, DatabaseDialect } from '../types/database.js';

interface ConnectionPool {
  id: string;
  type: DatabaseConnection['type'];
  pool: any; // Will be typed based on database type
  connection: DatabaseConnection;
}

export class ConnectionManager {
  private connections: Map<string, ConnectionPool> = new Map();
  private connectionsFilePath = path.join(process.cwd(), 'data', 'connections.json');
  private defaultConnectionId: string | null = null;

  constructor() {
    this.ensureDataDirectory();
    this.loadConnections();
  }

  private async ensureDataDirectory() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async loadConnections() {
    try {
      const data = await fs.readFile(this.connectionsFilePath, 'utf-8');
      const savedConnections: DatabaseConnection[] = JSON.parse(data);
      
      for (const conn of savedConnections) {
        if (conn.isDefault) {
          this.defaultConnectionId = conn.id;
        }
      }
    } catch (error) {
      // File doesn't exist, create empty connections file
      await this.saveConnections([]);
    }
  }

  private async saveConnections(connections: DatabaseConnection[]) {
    await fs.writeFile(this.connectionsFilePath, JSON.stringify(connections, null, 2));
  }

  private async getAllStoredConnections(): Promise<DatabaseConnection[]> {
    try {
      const data = await fs.readFile(this.connectionsFilePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async createConnection(connectionData: DatabaseConnectionConfig): Promise<DatabaseConnection> {
    const connection: DatabaseConnection = {
      ...connectionData,
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isDefault: connectionData.isDefault || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Test the connection first
    await this.testConnection(connection);

    // Save to file
    const connections = await this.getAllStoredConnections();
    
    // If this is set as default, unset other defaults
    if (connection.isDefault) {
      connections.forEach(conn => conn.isDefault = false);
      this.defaultConnectionId = connection.id;
    }
    
    connections.push(connection);
    await this.saveConnections(connections);

    return connection;
  }

  async testConnection(connection: DatabaseConnectionConfig): Promise<boolean> {
    try {
      // Check if database type is actually supported by installed drivers
      const supportedTypes = ['postgresql', 'mysql', 'sqlite', 'mssql'];
      if (!supportedTypes.includes(connection.type)) {
        throw new Error(`Database type '${connection.type}' is configured but requires additional drivers to be installed. Currently supported types: ${supportedTypes.join(', ')}`);
      }
      
      console.log('Creating pool with config:', {
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        ssl: connection.ssl
      });
      
      const pool = await this.createPool(connection);
      
      // Test query based on database type
      const testQuery = this.getTestQuery(connection.type);
      console.log('Executing test query:', testQuery);
      await this.executeQuery(pool, testQuery, connection.type);
      
      // Close test connection
      await this.closePool(pool, connection.type);
      return true;
    } catch (error) {
      console.error('Connection test error details:', error);
      if (error instanceof Error) {
        throw new Error(`Connection test failed: ${error.message}`);
      } else {
        throw new Error(`Connection test failed: ${String(error)}`);
      }
    }
  }

  private async createPool(connection: DatabaseConnectionConfig): Promise<any> {
    switch (connection.type) {
      case 'postgresql':
        const pgConfig: PoolConfig = {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.username,
          password: connection.password,
          ssl: connection.ssl ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        };
        return new Pool(pgConfig);

      case 'mysql':
        return mysql.createPool({
          host: connection.host,
          port: connection.port,
          database: connection.database,
          user: connection.username,
          password: connection.password,
          ssl: connection.ssl ? {} : undefined,
          connectionLimit: 20,
        });

      case 'sqlite':
        if (!connection.filepath) {
          throw new Error('SQLite filepath is required');
        }
        return await open({
          filename: connection.filepath,
          driver: sqlite3.Database
        });

      default:
        throw new Error(`Unsupported database type: ${connection.type}`);
    }
  }

  private getTestQuery(type: DatabaseConnectionConfig['type']): string {
    switch (type) {
      case 'postgresql':
      case 'redshift':
        return 'SELECT 1 as test';
      case 'mysql':
      case 'mariadb':
        return 'SELECT 1 as test';
      case 'sqlite':
        return 'SELECT 1 as test';
      case 'mssql':
        return 'SELECT 1 as test';
      case 'oracle':
        return 'SELECT 1 FROM DUAL';
      case 'snowflake':
        return 'SELECT 1 as test';
      case 'bigquery':
        return 'SELECT 1 as test';
      case 'clickhouse':
        return 'SELECT 1 as test';
      case 'mongodb':
        return 'db.runCommand({ping: 1})';
      default:
        return 'SELECT 1 as test';
    }
  }

  private async executeQuery(pool: any, query: string, type: DatabaseConnectionConfig['type']): Promise<any> {
    switch (type) {
      case 'postgresql':
        const pgResult = await pool.query(query);
        return pgResult.rows;
      
      case 'mysql':
        const [rows] = await pool.execute(query);
        return rows;
      
      case 'sqlite':
        return await pool.all(query);
      
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  private async closePool(pool: any, type: DatabaseConnectionConfig['type']) {
    switch (type) {
      case 'postgresql':
        await pool.end();
        break;
      case 'mysql':
        await pool.end();
        break;
      case 'sqlite':
        await pool.close();
        break;
    }
  }

  async getConnection(connectionId: string): Promise<ConnectionPool> {
    // Check if already in memory
    if (this.connections.has(connectionId)) {
      return this.connections.get(connectionId)!;
    }

    // Load from file
    const connections = await this.getAllStoredConnections();
    const connection = connections.find(c => c.id === connectionId);
    
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    // Create and cache pool
    const pool = await this.createPool(connection);
    const connectionPool: ConnectionPool = {
      id: connectionId,
      type: connection.type,
      pool,
      connection
    };

    this.connections.set(connectionId, connectionPool);
    return connectionPool;
  }

  async getDefaultConnection(): Promise<ConnectionPool | null> {
    // Always reload from file to get the latest default connection
    const connections = await this.getAllStoredConnections();
    const defaultConnection = connections.find(c => c.isDefault);
    
    if (defaultConnection) {
      this.defaultConnectionId = defaultConnection.id;
      return await this.getConnection(defaultConnection.id);
    }
    
    return null;
  }

  async listConnections(): Promise<DatabaseConnection[]> {
    return await this.getAllStoredConnections();
  }

  async deleteConnection(connectionId: string): Promise<void> {
    // Close pool if in memory
    if (this.connections.has(connectionId)) {
      const connectionPool = this.connections.get(connectionId)!;
      await this.closePool(connectionPool.pool, connectionPool.type);
      this.connections.delete(connectionId);
    }

    // Remove from file
    const connections = await this.getAllStoredConnections();
    const filteredConnections = connections.filter(c => c.id !== connectionId);
    await this.saveConnections(filteredConnections);

    // If this was the default, clear default
    if (this.defaultConnectionId === connectionId) {
      this.defaultConnectionId = null;
    }
  }

  async discoverSchema(connectionId: string): Promise<any> {
    const connectionPool = await this.getConnection(connectionId);
    const { pool, type, connection } = connectionPool;

    switch (type) {
      case 'postgresql':
        return await this.discoverPostgreSQLSchema(pool);
      case 'mysql':
        return await this.discoverMySQLSchema(pool, connection.database);
      case 'sqlite':
        return await this.discoverSQLiteSchema(pool);
      default:
        throw new Error(`Schema discovery not implemented for ${type}`);
    }
  }

  private async discoverPostgreSQLSchema(pool: Pool): Promise<any> {
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

    const tablesResult = await pool.query(tablesQuery);
    
    // Organize tables and columns with enhanced information
    const tables: Record<string, any> = {};
    
    tablesResult.rows.forEach((row: any) => {
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
        ccu.table_name AS referencedTable,
        ccu.column_name AS referencedColumn,
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

    const relationshipsResult = await pool.query(relationshipsQuery);

    const relationships = relationshipsResult.rows.map((row: any) => ({
      table: row.table,
      column: row.column,
      referencedTable: row.referencedtable,
      referencedColumn: row.referencedcolumn
    }));

    // Add foreign key information to table metadata
    relationshipsResult.rows.forEach((row: any) => {
      if (tables[row.table]) {
        tables[row.table].foreignKeys.push({
          column: row.column,
          referencedTable: row.referencedtable,
          referencedColumn: row.referencedcolumn
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
      const indexesResult = await pool.query(indexesQuery);
      indexesResult.rows.forEach((row: any) => {
        if (tables[row.table_name]) {
          // Ensure columns is always an array
          let columns = row.columns;
          if (typeof columns === 'string') {
            // Parse PostgreSQL array format like "{email}" or "{col1,col2}"
            columns = columns.replace(/[{}]/g, '').split(',').map((col: string) => col.trim());
          }
          
          tables[row.table_name].indexes.push({
            name: row.index_name,
            columns: Array.isArray(columns) ? columns : [columns],
            isUnique: row.is_unique
          });
        }
      });
    } catch (indexError) {
      console.warn('Could not retrieve index information:', indexError);
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
      const viewsResult = await pool.query(viewsQuery);
      views = viewsResult.rows.map((row: any) => ({
        name: row.name,
        definition: row.definition
      }));
    } catch (viewError) {
      console.warn('Could not retrieve view information:', viewError);
    }

    // Get row counts for each table (with error handling for large tables)
    const tableNames = Object.keys(tables);
    const rowCountPromises = tableNames.map(async (tableName) => {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
        const countResult = await pool.query(countQuery);
        return { tableName, count: parseInt(countResult.rows[0].count) };
      } catch (error) {
        console.warn(`Could not get row count for table ${tableName}:`, error);
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
        console.warn(`Row count failed for table ${tableName}:`, result.reason);
        tables[tableName].rowCount = 0;
      }
    });

    const discoveryTime = new Date();

    return {
      tables,
      relationships,
      views,
      lastDiscovered: discoveryTime
    };
  }

  private async discoverMySQLSchema(pool: any, database: string): Promise<any> {
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME as table_name, TABLE_TYPE as table_type
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [database]);

    const schema: any = { tables: [], relationships: [] };

    for (const table of tables as any[]) {
      const [columns] = await pool.execute(`
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          CHARACTER_MAXIMUM_LENGTH as character_maximum_length
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [database, table.table_name]);
      
      schema.tables.push({
        name: table.table_name,
        type: table.table_type,
        columns: columns
      });
    }

    return schema;
  }

  private async discoverSQLiteSchema(pool: Database): Promise<any> {
    const tables = await pool.all(`
      SELECT name as table_name, type as table_type
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const schema: any = { tables: [], relationships: [] };

    for (const table of tables) {
      const columns = await pool.all(`PRAGMA table_info(${table.table_name})`);
      
      schema.tables.push({
        name: table.table_name,
        type: table.table_type,
        columns: columns.map((col: any) => ({
          column_name: col.name,
          data_type: col.type,
          is_nullable: col.notnull ? 'NO' : 'YES',
          column_default: col.dflt_value
        }))
      });
    }

    return schema;
  }

  getDatabaseDialect(type: DatabaseConnectionConfig['type']): DatabaseDialect {
    switch (type) {
      case 'postgresql':
      case 'redshift':
        return {
          name: 'PostgreSQL',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
      
      case 'mysql':
      case 'mariadb':
        return {
          name: 'MySQL',
          quotingChar: '`',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${offset}, ${limit}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
      
      case 'sqlite':
        return {
          name: 'SQLite',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN QUERY PLAN'
        };
      
      case 'mssql':
        return {
          name: 'Microsoft SQL Server',
          quotingChar: '[',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY` : `TOP ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'SET SHOWPLAN_ALL ON'
        };
      
      case 'oracle':
        return {
          name: 'Oracle',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY` : `FETCH FIRST ${limit} ROWS ONLY`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN PLAN FOR'
        };
      
      case 'snowflake':
        return {
          name: 'Snowflake',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
      
      case 'bigquery':
        return {
          name: 'BigQuery',
          quotingChar: '`',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: false,
          explainKeyword: ''
        };
      
      case 'clickhouse':
        return {
          name: 'ClickHouse',
          quotingChar: '`',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${offset}, ${limit}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'EXPLAIN'
        };
      
      case 'mongodb':
        return {
          name: 'MongoDB',
          quotingChar: '',
          limitSyntax: (limit: number) => `.limit(${limit})`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: true,
          explainKeyword: 'explain'
        };
      
      default:
        return {
          name: 'Generic SQL',
          quotingChar: '"',
          limitSyntax: (limit: number, offset?: number) => 
            offset ? `LIMIT ${limit} OFFSET ${offset}` : `LIMIT ${limit}`,
          dateFormat: 'YYYY-MM-DD',
          supportsExplain: false,
          explainKeyword: ''
        };
    }
  }
} 