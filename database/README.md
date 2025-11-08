# Demo Database Setup

This directory contains the SQL initialization script for the demo database.

## Files

- `demo-init.sql` - Complete initialization script that creates tables, populates sample data, and sets up permissions

## What's Included

The script creates a complete e-commerce demo database with:

### Tables
- **products** (50 records) - Electronics, Home & Kitchen, Clothing, Books, Sports & Outdoors
- **customers** (35 records) - Diverse locations across the USA
- **orders** (115 records) - Orders spanning 12 months with various statuses
- **order_items** (200+ records) - Line items for all orders

### Features
- Foreign key relationships between tables
- Indexes on commonly queried columns
- Check constraints for data integrity
- Read-only user (`demo_user`) with SELECT-only permissions
- Sample data that supports various query patterns (aggregations, joins, filtering, sorting)

## Usage

### Running on Neon (or other PostgreSQL service)

1. Create a new PostgreSQL database on your hosting service
2. Connect to the database using psql or the web console
3. Run the initialization script:

```bash
psql -h <host> -U <admin_user> -d <database_name> -f demo-init.sql
```

Or copy and paste the contents into the SQL console.

### Verification

The script includes verification queries that will output:
- Number of records in each table
- Warnings if requirements aren't met (50+ products, 30+ customers, 100+ orders, 200+ order items)

### Demo User Credentials

After running the script, you'll have a read-only user:
- **Username**: `demo_user`
- **Password**: `demo_readonly_2024`
- **Permissions**: SELECT only on all tables

**Important**: Change the password in the script before running in production!

## Environment Variables

To use this demo database in the application, set these environment variables:

```bash
DEMO_DB_HOST=your-neon-host.neon.tech
DEMO_DB_PORT=5432
DEMO_DB_NAME=your-database-name
DEMO_DB_USER=demo_user
DEMO_DB_PASSWORD=demo_readonly_2024
```

## Sample Queries

The script includes commented sample queries at the end for testing:
- Top selling products
- Monthly sales trends
- Customer lifetime value

## Maintenance

The script is idempotent - you can run it multiple times safely. It will:
- Drop existing tables before creating new ones
- Drop and recreate the demo_user

To refresh the data, simply run the script again.
