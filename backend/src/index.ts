// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { createLogger, format, transports } from 'winston';
import { textToSqlRouter } from './routes/textToSql';
import { databaseRouter } from './routes/database';
import { queryHistoryRouter } from './routes/queryHistory';
import connectionsRouter from './routes/connections';
import performanceRouter from './routes/performance';
import feedbackRouter from './routes/feedback';
import { visualizationRouter } from './routes/visualization';

// Create logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  'https://talk-to-your-db.onrender.com',
  'https://talk-to-your-db-1.onrender.com'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/text-to-sql', textToSqlRouter);
app.use('/api/database', databaseRouter);
app.use('/api/history', queryHistoryRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/visualization', visualizationRouter);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  
  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'API route not found'
    }
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Log environment info
  logger.info('Configuration:', {
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    databaseConfigured: !!process.env.DATABASE_URL,
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});

export default app; 