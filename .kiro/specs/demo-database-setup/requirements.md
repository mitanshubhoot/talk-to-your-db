# Requirements Document

## Introduction

This feature enables new users to immediately try the application with a pre-configured demo database containing sample data. Users can explore the AI-powered SQL generation capabilities without needing to set up their own database connection first.

## Glossary

- **Demo Database**: A read-only PostgreSQL database hosted on a free cloud service containing sample e-commerce data
- **Auto-Connection**: Automatic connection to the demo database when no user-configured connections exist
- **Sample Dataset**: Pre-populated tables with realistic e-commerce data (products, orders, customers, etc.)
- **Connection Manager**: The backend service responsible for managing database connections
- **Demo Mode**: Application state when connected to the demo database

## Requirements

### Requirement 1: Demo Database Provisioning

**User Story:** As a developer, I want to provision a free cloud-hosted PostgreSQL database with sample data, so that users can try the application immediately.

#### Acceptance Criteria

1. WHEN THE System provisions a demo database, THE System SHALL create a PostgreSQL database on a free cloud service (Neon, Supabase, or Render)
2. WHEN THE System provisions a demo database, THE System SHALL populate the database with at least 4 tables containing realistic sample data
3. WHEN THE System provisions a demo database, THE System SHALL include tables for products, orders, customers, and order_items
4. WHEN THE System provisions a demo database, THE System SHALL ensure each table contains at least 20 rows of sample data
5. WHEN THE System provisions a demo database, THE System SHALL configure the database with read-only access for demo users

### Requirement 2: Auto-Connection on First Visit

**User Story:** As a new user, I want the application to automatically connect to a demo database when I first visit, so that I can immediately try the features without setup.

#### Acceptance Criteria

1. WHEN THE Application initializes AND no user connections exist, THE Application SHALL automatically connect to the demo database
2. WHEN THE Application connects to the demo database, THE Application SHALL mark the connection as "Demo Mode"
3. WHEN THE Application connects to the demo database, THE Application SHALL display a visual indicator that the user is in demo mode
4. WHEN THE User creates their first custom connection, THE Application SHALL switch from demo mode to the user's connection
5. IF THE Demo database connection fails, THEN THE Application SHALL display the standard "No Database Connected" state

### Requirement 3: Demo Database Configuration

**User Story:** As a system administrator, I want to configure the demo database connection via environment variables, so that I can easily update or change the demo database without code changes.

#### Acceptance Criteria

1. THE System SHALL read demo database credentials from environment variables
2. THE System SHALL support the following environment variables: DEMO_DB_HOST, DEMO_DB_PORT, DEMO_DB_NAME, DEMO_DB_USER, DEMO_DB_PASSWORD
3. WHEN THE Demo database environment variables are not set, THE System SHALL skip auto-connection and show the standard connection prompt
4. THE System SHALL validate demo database credentials on application startup
5. IF THE Demo database credentials are invalid, THEN THE System SHALL log an error and continue without auto-connection

### Requirement 4: Demo Mode User Experience

**User Story:** As a user in demo mode, I want to clearly understand that I'm using sample data and have the option to connect my own database, so that I know the limitations and next steps.

#### Acceptance Criteria

1. WHEN THE User is connected to the demo database, THE Application SHALL display a "Demo Mode" badge in the database status area
2. WHEN THE User is connected to the demo database, THE Application SHALL show a banner explaining they are using sample data
3. WHEN THE User views the demo database connection details, THE Application SHALL display a "Connect Your Own Database" call-to-action button
4. THE Application SHALL allow users to switch from demo mode to their own database at any time
5. WHEN THE User switches from demo mode, THE Application SHALL preserve the demo connection as an available option

### Requirement 5: Sample Data Quality

**User Story:** As a user trying the demo, I want the sample data to be realistic and diverse, so that I can test various types of queries and see meaningful results.

#### Acceptance Criteria

1. THE Demo database SHALL contain at least 50 products across multiple categories
2. THE Demo database SHALL contain at least 100 orders with varying dates spanning 12 months
3. THE Demo database SHALL contain at least 30 customers with complete profile information
4. THE Demo database SHALL include relationships between tables (foreign keys)
5. THE Demo database SHALL include data that supports common query patterns (aggregations, joins, filtering, sorting)

### Requirement 6: Read-Only Protection

**User Story:** As a system administrator, I want the demo database to be read-only, so that users cannot modify or delete the sample data.

#### Acceptance Criteria

1. THE Demo database user SHALL have SELECT permissions only
2. WHEN THE User attempts to execute INSERT, UPDATE, or DELETE queries on the demo database, THE System SHALL block the operation
3. WHEN THE User attempts to execute DDL statements on the demo database, THE System SHALL block the operation
4. THE System SHALL display a clear error message when write operations are attempted in demo mode
5. THE System SHALL log all attempted write operations to the demo database for monitoring

### Requirement 7: Demo Database Initialization Script

**User Story:** As a developer, I want an automated script to initialize the demo database with sample data, so that I can easily recreate or update the demo environment.

#### Acceptance Criteria

1. THE System SHALL provide a SQL script that creates all demo tables
2. THE System SHALL provide a SQL script that populates all demo tables with sample data
3. THE Script SHALL be idempotent (can be run multiple times safely)
4. THE Script SHALL include DROP TABLE IF EXISTS statements for clean recreation
5. THE Script SHALL complete execution within 30 seconds

### Requirement 8: Demo Mode Documentation

**User Story:** As a user in demo mode, I want access to example queries and use cases, so that I can quickly understand what the application can do.

#### Acceptance Criteria

1. WHEN THE User is in demo mode, THE Application SHALL display a "Try These Queries" section with 5-10 example queries
2. THE Example queries SHALL be relevant to the demo database schema
3. WHEN THE User clicks an example query, THE Application SHALL populate the query input with that text
4. THE Application SHALL provide tooltips explaining what each example query demonstrates
5. THE Example queries SHALL showcase different SQL capabilities (joins, aggregations, filtering, sorting)
