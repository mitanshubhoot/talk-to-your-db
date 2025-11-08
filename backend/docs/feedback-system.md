# Feedback and Performance Monitoring System

This document describes the feedback collection and performance monitoring system implemented for the advanced NL2SQL feature.

## Overview

The system consists of three main components:

1. **Performance Monitor** - Tracks SQL generation performance metrics
2. **Feedback Collector** - Collects and analyzes user feedback
3. **Query Optimizer** - Provides query optimization suggestions

## Components

### Performance Monitor (`performanceMonitor.ts`)

Tracks and analyzes performance metrics for SQL generation:

- **Metrics Tracked:**
  - Model performance (accuracy, latency, error rate)
  - Query execution metrics (execution time, result count, success rate)
  - User satisfaction scores
  - API usage and costs

- **Features:**
  - Performance dashboard with comprehensive metrics
  - Automatic alerting for high error rates or latency
  - Model comparison and statistics
  - Time-based filtering and analysis

- **API Endpoints:**
  - `GET /api/performance/dashboard` - Get performance dashboard
  - `POST /api/performance/track` - Track query execution

### Feedback Collector (`feedbackCollector.ts`)

Collects and processes user feedback for continuous improvement:

- **Feedback Types:**
  - User ratings (1-5 scale)
  - SQL corrections from users
  - General improvement suggestions

- **Learning Features:**
  - Query pattern analysis
  - Common failure identification
  - Success rate tracking by pattern
  - Learning insights generation

- **API Endpoints:**
  - `POST /api/feedback/collect` - Collect user feedback
  - `GET /api/feedback/stats` - Get feedback statistics
  - `GET /api/feedback/insights` - Get learning insights

### Query Optimizer (`queryOptimizer.ts`)

Analyzes queries and provides optimization suggestions:

- **Analysis Features:**
  - Query complexity assessment
  - Performance impact estimation
  - Index usage analysis
  - Execution time estimation

- **Optimization Suggestions:**
  - Add LIMIT clauses for large datasets
  - Use specific columns instead of SELECT *
  - Add indexes for WHERE clause columns
  - Use explicit JOIN syntax

- **API Endpoints:**
  - `POST /api/performance/optimize` - Get optimization suggestions

## Usage Examples

### Collecting User Feedback

```javascript
// Collect user feedback on generated SQL
const feedback = {
  queryId: "query-123",
  originalQuery: "show me all users",
  generatedSql: "SELECT * FROM users;",
  correctedSql: "SELECT id, name, email FROM users LIMIT 100;",
  userRating: 4,
  feedbackType: "correction",
  comments: "Should limit results and select specific columns",
  modelUsed: "OpenAI GPT-4",
  confidence: 85
};

const response = await fetch('/api/feedback/collect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(feedback)
});
```

### Getting Performance Dashboard

```javascript
// Get performance metrics for the last 7 days
const response = await fetch('/api/performance/dashboard');
const dashboard = await response.json();

console.log('Total queries:', dashboard.data.totalQueries);
console.log('Success rate:', dashboard.data.successRate);
console.log('Average confidence:', dashboard.data.averageConfidence);
```

### Getting Query Optimization Suggestions

```javascript
// Get optimization suggestions for a query
const optimization = {
  sql: "SELECT * FROM users WHERE name = 'John';",
  schema: {
    tables: {
      users: {
        columns: [/* column definitions */],
        indexes: [/* index definitions */]
      }
    }
  }
};

const response = await fetch('/api/performance/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(optimization)
});
```

## Data Storage

The system stores data in JSON files for simplicity:

- `backend/data/performance-metrics.json` - Performance metrics
- `backend/data/query-metrics.json` - Query execution metrics
- `backend/data/user-feedback.json` - User feedback
- `backend/data/query-patterns.json` - Analyzed query patterns
- `backend/data/learning-insights.json` - Generated insights

## Integration

The system is integrated with the Enhanced Model Manager:

```typescript
// Enhanced SQL generation with feedback integration
const result = await enhancedModelManager.generateEnhancedSQL({
  userQuery: "show me all users",
  schema: schemaInfo,
  connectionId: "conn-123"
});

// Result includes optimization suggestions and query ID for feedback
console.log('Generated SQL:', result.sql);
console.log('Optimization suggestions:', result.optimizationSuggestions);
console.log('Query ID for feedback:', result.queryId);
```

## Monitoring and Alerts

The system provides automatic monitoring:

- **Performance Alerts:**
  - High error rate (>20%)
  - High latency (>5 seconds)
  - Low confidence (<60%)

- **Dashboard Metrics:**
  - Success rates by model
  - Query type distribution
  - API cost tracking
  - User satisfaction trends

## Learning and Improvement

The system continuously learns from user feedback:

1. **Pattern Recognition:** Identifies common query patterns and their success rates
2. **Failure Analysis:** Categorizes common failure types (missing JOINs, filters, etc.)
3. **Success Tracking:** Records successful corrections for future training
4. **Insight Generation:** Provides actionable insights for system improvement

This feedback loop enables the system to improve over time by learning from user interactions and corrections.