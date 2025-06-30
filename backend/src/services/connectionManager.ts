import { Pool, PoolConfig } from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseConnection, SchemaComparison, SchemaDifference, DatabaseDialect } from '../types/database.js';

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

  async createConnection(connectionData: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<DatabaseConnection> {
    const connection: DatabaseConnection = {
      ...connectionData,
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

  async testConnection(connection: DatabaseConnection): Promise<boolean> {
    try {
      // Check if database type is actually supported by installed drivers
      const supportedTypes = ['postgresql', 'mysql', 'sqlite', 'mssql'];
      if (!supportedTypes.includes(connection.type)) {
        throw new Error(`Database type '${connection.type}' is configured but requires additional drivers to be installed. Currently supported types: ${supportedTypes.join(', ')}`);
      }
      
      const pool = await this.createPool(connection);
      
      // Test query based on database type
      const testQuery = this.getTestQuery(connection.type);
      await this.executeQuery(pool, testQuery, connection.type);
      
      // Close test connection
      await this.closePool(pool, connection.type);
      return true;
    } catch (error) {
      throw new Error(`Connection test failed: ${error}`);
    }
  }

  private async createPool(connection: DatabaseConnection): Promise<any> {
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

  private getTestQuery(type: DatabaseConnection['type']): string {
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

  private async executeQuery(pool: any, query: string, type: DatabaseConnection['type']): Promise<any> {
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

  private async closePool(pool: any, type: DatabaseConnection['type']) {
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
    if (this.defaultConnectionId) {
      return await this.getConnection(this.defaultConnectionId);
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
    const tablesQuery = `
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const tables = await pool.query(tablesQuery);
    const schema: any = { tables: [], relationships: [] };

    for (const table of tables.rows) {
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `;
      
      const columns = await pool.query(columnsQuery, [table.table_name]);
      
      schema.tables.push({
        name: table.table_name,
        type: table.table_type,
        columns: columns.rows
      });
    }

    // Get relationships
    const relationshipsQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    `;
    
    const relationships = await pool.query(relationshipsQuery);
    schema.relationships = relationships.rows;

    return schema;
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

  getDatabaseDialect(type: DatabaseConnection['type']): DatabaseDialect {
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