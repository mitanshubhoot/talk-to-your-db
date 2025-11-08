import express from 'express';
import { ConnectionManager } from '../services/connectionManager.js';
import { DemoConnectionService } from '../services/demoConnectionService.js';

const router = express.Router();
const connectionManager = new ConnectionManager();
const demoService = new DemoConnectionService(connectionManager);

/**
 * GET /api/demo/status
 * Returns whether demo mode is active and demo connection details
 */
router.get('/status', async (req, res) => {
  try {
    // Check if demo is configured
    const isDemoConfigured = demoService.isDemoConfigured();
    
    if (!isDemoConfigured) {
      return res.json({
        success: true,
        data: {
          isActive: false,
          isConfigured: false,
          message: 'Demo database is not configured'
        }
      });
    }

    // Check if demo connection exists
    const demoConnection = await connectionManager.getDemoConnection();
    
    if (!demoConnection) {
      return res.json({
        success: true,
        data: {
          isActive: false,
          isConfigured: true,
          message: 'Demo database is configured but not connected'
        }
      });
    }

    // Get demo metadata
    const metadata = demoConnection.connection.metadata;
    
    res.json({
      success: true,
      data: {
        isActive: true,
        isConfigured: true,
        connection: {
          id: demoConnection.connection.id,
          name: demoConnection.connection.name,
          type: demoConnection.connection.type,
          database: demoConnection.connection.database,
          // Don't expose credentials
          host: demoConnection.connection.host,
          port: demoConnection.connection.port
        },
        metadata: metadata || {
          isDemo: true,
          readOnly: true
        }
      }
    });
  } catch (error) {
    console.error('Error getting demo status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get demo status' }
    });
  }
});

/**
 * GET /api/demo/examples
 * Returns list of example queries for the demo database
 */
router.get('/examples', async (req, res) => {
  try {
    // Check if demo is configured
    const isDemoConfigured = demoService.isDemoConfigured();
    
    if (!isDemoConfigured) {
      return res.status(404).json({
        success: false,
        error: { message: 'Demo database is not configured' }
      });
    }

    // Get example queries with descriptions and expected results
    const examples = [
      {
        id: 'top-products-revenue',
        title: 'Top 10 Products by Revenue',
        description: 'Find the best-selling products based on total revenue',
        query: `SELECT 
  p.name,
  p.category,
  SUM(oi.subtotal) as total_revenue,
  SUM(oi.quantity) as units_sold
FROM products p
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.category
ORDER BY total_revenue DESC
LIMIT 10;`,
        expectedColumns: ['name', 'category', 'total_revenue', 'units_sold'],
        category: 'aggregation'
      },
      {
        id: 'recent-orders',
        title: 'Recent Orders (Last 30 Days)',
        description: 'List all orders placed in the last 30 days',
        query: `SELECT 
  o.id,
  o.order_date,
  c.first_name || ' ' || c.last_name as customer_name,
  o.total_amount,
  o.status
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY o.order_date DESC;`,
        expectedColumns: ['id', 'order_date', 'customer_name', 'total_amount', 'status'],
        category: 'filtering'
      },
      {
        id: 'high-value-customers',
        title: 'High-Value Customers',
        description: 'Find customers who have spent more than $500',
        query: `SELECT 
  c.first_name,
  c.last_name,
  c.email,
  c.city,
  SUM(o.total_amount) as total_spent,
  COUNT(o.id) as order_count
FROM customers c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.first_name, c.last_name, c.email, c.city
HAVING SUM(o.total_amount) > 500
ORDER BY total_spent DESC;`,
        expectedColumns: ['first_name', 'last_name', 'email', 'city', 'total_spent', 'order_count'],
        category: 'aggregation'
      },
      {
        id: 'popular-categories',
        title: 'Most Popular Product Categories',
        description: 'Analyze which product categories are selling best',
        query: `SELECT 
  p.category,
  COUNT(DISTINCT oi.order_id) as order_count,
  SUM(oi.quantity) as units_sold,
  SUM(oi.subtotal) as total_revenue
FROM products p
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.category
ORDER BY total_revenue DESC;`,
        expectedColumns: ['category', 'order_count', 'units_sold', 'total_revenue'],
        category: 'aggregation'
      },
      {
        id: 'monthly-sales-trend',
        title: 'Monthly Sales Trends',
        description: 'Show sales trends over the past year by month',
        query: `SELECT 
  DATE_TRUNC('month', order_date) as month,
  COUNT(*) as order_count,
  SUM(total_amount) as total_sales,
  AVG(total_amount) as avg_order_value
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;`,
        expectedColumns: ['month', 'order_count', 'total_sales', 'avg_order_value'],
        category: 'time-series'
      },
      {
        id: 'low-stock-products',
        title: 'Low Stock Products',
        description: 'Find products with less than 10 units in stock',
        query: `SELECT 
  name,
  category,
  stock_quantity,
  price
FROM products
WHERE stock_quantity < 10
ORDER BY stock_quantity ASC;`,
        expectedColumns: ['name', 'category', 'stock_quantity', 'price'],
        category: 'filtering'
      },
      {
        id: 'inactive-customers',
        title: 'Inactive Customers',
        description: 'Find customers who haven\'t ordered in the last 90 days',
        query: `SELECT 
  c.first_name,
  c.last_name,
  c.email,
  MAX(o.order_date) as last_order_date,
  CURRENT_DATE - MAX(o.order_date)::date as days_since_order
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
GROUP BY c.id, c.first_name, c.last_name, c.email
HAVING MAX(o.order_date) < CURRENT_DATE - INTERVAL '90 days'
   OR MAX(o.order_date) IS NULL
ORDER BY last_order_date DESC NULLS LAST;`,
        expectedColumns: ['first_name', 'last_name', 'email', 'last_order_date', 'days_since_order'],
        category: 'filtering'
      },
      {
        id: 'avg-order-by-city',
        title: 'Average Order Value by City',
        description: 'Calculate average order value grouped by customer city',
        query: `SELECT 
  c.city,
  c.state,
  COUNT(o.id) as order_count,
  AVG(o.total_amount) as avg_order_value,
  SUM(o.total_amount) as total_revenue
FROM customers c
JOIN orders o ON c.id = o.customer_id
GROUP BY c.city, c.state
HAVING COUNT(o.id) >= 3
ORDER BY total_revenue DESC;`,
        expectedColumns: ['city', 'state', 'order_count', 'avg_order_value', 'total_revenue'],
        category: 'aggregation'
      }
    ];

    res.json({
      success: true,
      data: {
        examples,
        totalCount: examples.length,
        categories: ['aggregation', 'filtering', 'time-series', 'joins']
      }
    });
  } catch (error) {
    console.error('Error getting demo examples:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get demo examples' }
    });
  }
});

/**
 * POST /api/demo/initialize
 * Manually trigger demo connection initialization
 * Note: In a production environment, this should be protected with authentication
 */
router.post('/initialize', async (req, res) => {
  try {
    // Check if demo is configured
    const isDemoConfigured = demoService.isDemoConfigured();
    
    if (!isDemoConfigured) {
      return res.status(400).json({
        success: false,
        error: { 
          message: 'Demo database is not configured. Please set the required environment variables.',
          requiredVariables: [
            'DEMO_DB_HOST',
            'DEMO_DB_PORT',
            'DEMO_DB_NAME',
            'DEMO_DB_USER',
            'DEMO_DB_PASSWORD'
          ]
        }
      });
    }

    // Check if demo connection already exists
    const existingDemo = await connectionManager.getDemoConnection();
    if (existingDemo) {
      return res.json({
        success: true,
        data: {
          message: 'Demo connection already exists',
          connection: {
            id: existingDemo.connection.id,
            name: existingDemo.connection.name,
            type: existingDemo.connection.type,
            database: existingDemo.connection.database
          },
          alreadyInitialized: true
        }
      });
    }

    // Initialize the demo connection with retry logic
    const connection = await demoService.initializeDemoConnection();
    
    if (!connection) {
      return res.status(503).json({
        success: false,
        error: { 
          message: 'Failed to initialize demo connection after multiple attempts. ' +
                   'The demo database may be temporarily unavailable. ' +
                   'Please try again later or connect your own database.',
          code: 'DEMO_CONNECTION_FAILED',
          fallbackAction: 'Connect your own database to continue using the application.'
        }
      });
    }

    res.status(201).json({
      success: true,
      data: {
        message: 'Demo connection initialized successfully',
        connection: {
          id: connection.id,
          name: connection.name,
          type: connection.type,
          database: connection.database,
          host: connection.host,
          port: connection.port
        },
        metadata: connection.metadata
      }
    });
  } catch (error) {
    console.error('Error initializing demo connection:', error);
    
    // Provide helpful error messages based on error type
    let errorMessage = 'Failed to initialize demo connection';
    let errorCode = 'DEMO_INIT_ERROR';
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Cannot connect to demo database server. The server may be down or unreachable.';
        errorCode = 'DEMO_CONNECTION_REFUSED';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Connection to demo database timed out. Please try again later.';
        errorCode = 'DEMO_CONNECTION_TIMEOUT';
      } else if (error.message.includes('authentication failed')) {
        errorMessage = 'Demo database authentication failed. Please contact support.';
        errorCode = 'DEMO_AUTH_FAILED';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(500).json({
      success: false,
      error: { 
        message: errorMessage,
        code: errorCode,
        fallbackAction: 'Connect your own database to continue using the application.'
      }
    });
  }
});

export default router;
