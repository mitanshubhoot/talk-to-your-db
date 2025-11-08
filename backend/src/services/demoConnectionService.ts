import { DatabaseConnection, DatabaseConnectionConfig } from '../types/database.js';
import { ConnectionManager } from './connectionManager.js';

export interface DemoConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface DemoConnectionMetadata {
  isDemo: boolean;
  demoVersion: string;
  sampleDataDate: string;
  readOnly: boolean;
  exampleQueries: string[];
}

export class DemoConnectionService {
  private static DEMO_CONNECTION_ID = 'demo_connection';
  private connectionManager: ConnectionManager;
  private demoConnectionId: string | null = null;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Check if demo database is configured via environment variables
   */
  isDemoConfigured(): boolean {
    const config = this.getDemoConfig();
    return config !== null;
  }

  /**
   * Get demo database configuration from environment variables
   */
  getDemoConfig(): DemoConnectionConfig | null {
    const host = process.env.DEMO_DB_HOST;
    const port = process.env.DEMO_DB_PORT;
    const database = process.env.DEMO_DB_NAME;
    const username = process.env.DEMO_DB_USER;
    const password = process.env.DEMO_DB_PASSWORD;
    const ssl = process.env.DEMO_DB_SSL;

    // Check if all required variables are present
    if (!host || !port || !database || !username || !password) {
      console.info('Demo database not configured - missing required environment variables');
      return null;
    }

    return {
      host,
      port: parseInt(port, 10),
      database,
      username,
      password,
      ssl: ssl === 'true' || ssl === '1'
    };
  }

  /**
   * Validate demo database connectivity with retry logic
   */
  async validateDemoDatabase(maxRetries: number = 3): Promise<boolean> {
    const config = this.getDemoConfig();
    if (!config) {
      return false;
    }

    const connectionConfig: DatabaseConnectionConfig = {
      name: 'Demo Database',
      type: 'postgresql',
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: config.ssl
    };

    // Retry with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connectionManager.testConnection(connectionConfig);
        if (attempt > 1) {
          console.info(`Demo database validation succeeded on attempt ${attempt}`);
        }
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (attempt < maxRetries) {
          // Calculate exponential backoff delay: 1s, 2s, 4s, etc.
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          console.warn(
            `Demo database validation failed (attempt ${attempt}/${maxRetries}): ${errorMessage}. ` +
            `Retrying in ${delayMs}ms...`
          );
          await this.sleep(delayMs);
        } else {
          console.error(
            `Demo database validation failed after ${maxRetries} attempts: ${errorMessage}`
          );
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a connection is the demo connection
   */
  isDemoConnection(connectionId: string): boolean {
    return connectionId === this.demoConnectionId || connectionId === DemoConnectionService.DEMO_CONNECTION_ID;
  }

  /**
   * Initialize demo connection and add it to ConnectionManager
   * Falls back to "No Database" state on failure
   */
  async initializeDemoConnection(): Promise<DatabaseConnection | null> {
    const config = this.getDemoConfig();
    if (!config) {
      console.info('Demo database not configured - skipping initialization');
      return null;
    }

    try {
      // Validate the demo database first with retry logic
      const isValid = await this.validateDemoDatabase(3);
      if (!isValid) {
        console.error(
          'Demo database validation failed after retries - falling back to "No Database" state. ' +
          'Users will need to connect their own database.'
        );
        return null;
      }

      // Check if demo connection already exists
      const existingConnections = await this.connectionManager.listConnections();
      const existingDemo = existingConnections.find(conn => 
        conn.name === 'Demo Database' && 
        conn.host === config.host &&
        conn.database === config.database
      );

      if (existingDemo) {
        console.info('Demo connection already exists:', existingDemo.id);
        this.demoConnectionId = existingDemo.id;
        
        // Verify the existing connection still works
        try {
          await this.connectionManager.testConnection(existingDemo);
          return existingDemo;
        } catch (testError) {
          console.warn(
            'Existing demo connection failed validation, will attempt to recreate:',
            testError instanceof Error ? testError.message : String(testError)
          );
          // Continue to create a new connection
        }
      }

      // Create the demo connection
      const connectionConfig: DatabaseConnectionConfig = {
        name: 'Demo Database',
        type: 'postgresql',
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl,
        isDefault: false // Don't set as default automatically
      };

      const connection = await this.connectionManager.createConnection(connectionConfig);
      this.demoConnectionId = connection.id;

      // Mark this connection as a demo connection with metadata
      const metadata = this.getDemoMetadata();
      await this.connectionManager.markAsDemoConnection(connection.id, metadata);

      console.info('Demo connection initialized successfully:', connection.id);
      return connection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        'Failed to initialize demo connection - falling back to "No Database" state:',
        errorMessage
      );
      
      // Log additional context for debugging
      console.error('Demo connection error details:', {
        host: config.host,
        port: config.port,
        database: config.database,
        ssl: config.ssl,
        error: errorMessage
      });
      
      return null;
    }
  }

  /**
   * Get demo connection metadata
   */
  getDemoMetadata(): DemoConnectionMetadata {
    return {
      isDemo: true,
      demoVersion: '1.0',
      sampleDataDate: new Date().toISOString().split('T')[0],
      readOnly: true,
      exampleQueries: [
        'Show me the top 10 products by revenue',
        'List all orders from the last 30 days',
        'Find customers who have spent more than $500',
        'What are the most popular product categories?',
        'Show monthly sales trends for the past year',
        'List products that are low in stock (less than 10 units)',
        'Find customers who haven\'t ordered in the last 90 days',
        'Calculate average order value by customer city'
      ]
    };
  }

  /**
   * Get the demo connection ID if it exists
   */
  getDemoConnectionId(): string | null {
    return this.demoConnectionId;
  }
}
