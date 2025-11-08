# Design Document

## Overview

This feature implements an automatic demo database connection that allows new users to immediately experience the application's capabilities without setting up their own database. The system will automatically connect to a pre-configured PostgreSQL database hosted on Neon (or similar free service) containing realistic e-commerce sample data.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Application                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  App.tsx - Initialization & Demo Mode Detection       │ │
│  │  DemoModeBanner - Visual indicator for demo mode      │ │
│  │  ExampleQueries - Suggested queries for demo data     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend Application                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ConnectionManager - Enhanced with demo DB logic      │ │
│  │  DemoConnectionService - Demo DB initialization       │ │
│  │  Environment Config - Demo DB credentials             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Demo Database (Neon PostgreSQL)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  products (50+ rows)                                   │ │
│  │  customers (30+ rows)                                  │ │
│  │  orders (100+ rows)                                    │ │
│  │  order_items (200+ rows)                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Demo Database Schema

**Tables:**

```sql
-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  city VARCHAR(100),
  state VARCHAR(50),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  order_date TIMESTAMP NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  shipping_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items table
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL
);
```

### 2. Backend: DemoConnectionService

**Purpose:** Manages demo database connection initialization and validation

**Interface:**
```typescript
interface DemoConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

class DemoConnectionService {
  // Check if demo database is configured
  isDemoConfigured(): boolean;
  
  // Get demo database configuration from environment
  getDemoConfig(): DemoConnectionConfig | null;
  
  // Initialize demo connection in ConnectionManager
  async initializeDemoConnection(): Promise<DatabaseConnection | null>;
  
  // Validate demo database connectivity
  async validateDemoDatabase(): Promise<boolean>;
  
  // Check if a connection is the demo connection
  isDemoConnection(connectionId: string): boolean;
}
```

### 3. Backend: Enhanced ConnectionManager

**New Methods:**
```typescript
class ConnectionManager {
  // Existing methods...
  
  // Auto-connect to demo database if no connections exist
  async autoConnectDemo(): Promise<DatabaseConnection | null>;
  
  // Check if any user connections exist
  async hasUserConnections(): Promise<boolean>;
  
  // Mark a connection as demo connection
  markAsDemoConnection(connectionId: string): void;
  
  // Get demo connection if it exists
  async getDemoConnection(): Promise<DatabaseConnection | null>;
}
```

### 4. Frontend: DemoModeBanner Component

**Purpose:** Display visual indicator when in demo mode

**Props:**
```typescript
interface DemoModeBannerProps {
  onConnectDatabase: () => void;
  onViewExamples: () => void;
}
```

**Features:**
- Prominent banner at top of main view
- "You're in Demo Mode" message
- "Connect Your Database" CTA button
- "View Example Queries" link
- Dismissible (stores preference in localStorage)

### 5. Frontend: ExampleQueries Component

**Purpose:** Provide suggested queries for demo database

**Props:**
```typescript
interface ExampleQueriesProps {
  onQuerySelect: (query: string) => void;
  isDemoMode: boolean;
}
```

**Example Queries:**
1. "Show me the top 10 products by revenue"
2. "List all orders from the last 30 days"
3. "Find customers who have spent more than $500"
4. "What are the most popular product categories?"
5. "Show monthly sales trends for the past year"
6. "List products that are low in stock (less than 10 units)"
7. "Find customers who haven't ordered in the last 90 days"
8. "Calculate average order value by customer city"

## Data Models

### Demo Connection Metadata

```typescript
interface DemoConnectionMetadata {
  isDemo: boolean;
  demoVersion: string; // e.g., "1.0"
  sampleDataDate: string; // When sample data was last updated
  readOnly: boolean;
  exampleQueries: string[];
}

interface DatabaseConnection {
  // Existing fields...
  metadata?: DemoConnectionMetadata;
}
```

## Error Handling

### Demo Database Connection Failures

**Scenario 1: Demo DB credentials not configured**
- Action: Skip auto-connection
- User Experience: Show standard "No Database Connected" state
- Logging: Info level - "Demo database not configured"

**Scenario 2: Demo DB connection fails**
- Action: Retry once, then skip
- User Experience: Show standard "No Database Connected" state with optional info message
- Logging: Warning level - "Demo database connection failed: [error]"

**Scenario 3: Demo DB schema invalid**
- Action: Skip auto-connection
- User Experience: Show standard "No Database Connected" state
- Logging: Error level - "Demo database schema validation failed"

### Write Operation Attempts in Demo Mode

**Scenario: User tries INSERT/UPDATE/DELETE**
- Action: Block at application level before sending to database
- User Experience: Show error toast: "Demo database is read-only. Connect your own database to modify data."
- Logging: Info level - "Write operation blocked in demo mode"

## Testing Strategy

### Unit Tests

1. **DemoConnectionService Tests**
   - Test configuration loading from environment
   - Test connection validation
   - Test demo connection identification

2. **ConnectionManager Tests**
   - Test auto-connect logic
   - Test user connection detection
   - Test demo connection retrieval

### Integration Tests

1. **Demo Database Connection Flow**
   - Test successful auto-connection on first load
   - Test fallback when demo DB unavailable
   - Test switching from demo to user connection

2. **Read-Only Enforcement**
   - Test SELECT queries succeed
   - Test INSERT/UPDATE/DELETE blocked
   - Test DDL statements blocked

### End-to-End Tests

1. **First-Time User Experience**
   - Load application with no connections
   - Verify auto-connection to demo DB
   - Verify demo mode banner displays
   - Execute sample queries
   - Connect custom database
   - Verify switch from demo mode

2. **Demo Mode Features**
   - Test example queries
   - Test demo mode indicators
   - Test "Connect Your Database" flow

## Implementation Phases

### Phase 1: Database Setup (Manual)
1. Create Neon account and database
2. Run initialization SQL script
3. Verify data and permissions
4. Document connection credentials

### Phase 2: Backend Implementation
1. Create DemoConnectionService
2. Add environment variable configuration
3. Enhance ConnectionManager with demo logic
4. Add read-only enforcement
5. Add demo connection endpoints

### Phase 3: Frontend Implementation
1. Create DemoModeBanner component
2. Create ExampleQueries component
3. Update App.tsx initialization logic
4. Add demo mode visual indicators
5. Update DatabaseSelector for demo mode

### Phase 4: Testing & Documentation
1. Write unit tests
2. Write integration tests
3. Write E2E tests
4. Create user documentation
5. Create developer setup guide

## Security Considerations

1. **Credential Management**
   - Store demo DB credentials in environment variables only
   - Never commit credentials to version control
   - Use read-only database user

2. **Access Control**
   - Demo database user has SELECT permission only
   - No DDL permissions
   - No write permissions

3. **Rate Limiting**
   - Consider rate limiting demo database queries
   - Monitor for abuse patterns
   - Implement query timeout limits

4. **Data Privacy**
   - Use only synthetic/fake data in demo database
   - No real customer information
   - No sensitive data

## Performance Considerations

1. **Connection Pooling**
   - Reuse demo database connection pool
   - Set appropriate pool size limits
   - Monitor connection usage

2. **Query Performance**
   - Add indexes on commonly queried columns
   - Keep sample data size reasonable (< 1000 rows per table)
   - Monitor slow queries

3. **Caching**
   - Consider caching demo database schema
   - Cache example query results for common queries
   - Implement query result pagination

## Monitoring and Maintenance

1. **Health Checks**
   - Periodic demo database connectivity checks
   - Alert on demo database failures
   - Monitor query performance

2. **Usage Analytics**
   - Track demo mode usage frequency
   - Track example query usage
   - Monitor conversion from demo to custom DB

3. **Data Refresh**
   - Plan for periodic sample data updates
   - Version sample data for consistency
   - Document data refresh procedures

## Alternative Approaches Considered

### Alternative 1: SQLite In-Memory Database
**Pros:** No external dependencies, faster, no network latency
**Cons:** Limited to SQLite dialect, data lost on restart, no persistence
**Decision:** Rejected - Want to showcase real PostgreSQL features

### Alternative 2: Mock/Simulated Data
**Pros:** No database needed, complete control
**Cons:** Not realistic, doesn't test actual SQL generation, limited learning value
**Decision:** Rejected - Real database provides better demo experience

### Alternative 3: User-Specific Demo Databases
**Pros:** Each user gets their own sandbox
**Cons:** Complex provisioning, higher costs, management overhead
**Decision:** Rejected - Shared read-only demo is sufficient for initial experience
