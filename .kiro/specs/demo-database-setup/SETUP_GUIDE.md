# Demo Database Setup Guide

This guide walks you through setting up the demo PostgreSQL database on Neon.

## Prerequisites

- A Neon account (free tier is sufficient)
- Access to the Neon SQL Editor

## Step 1: Create Neon Account and Project

1. Go to [https://neon.tech](https://neon.tech)
2. Sign up for a free account
3. Create a new project named "nl-to-sql-demo"
4. Note down your connection details from the Neon dashboard

## Step 2: Create Database

The default database created by Neon can be used, or create a new one:

```sql
CREATE DATABASE demo_ecommerce;
```

## Step 3: Create Read-Only User

Connect to your database and run the following SQL commands:

```sql
-- Create a read-only user with a secure password
CREATE USER demo_readonly WITH PASSWORD 'CHANGE_THIS_TO_SECURE_PASSWORD';

-- Grant connect permission to the database
GRANT CONNECT ON DATABASE demo_ecommerce TO demo_readonly;

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO demo_readonly;

-- Grant SELECT permission on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO demo_readonly;

-- Ensure future tables also grant SELECT to this user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO demo_readonly;
```

**Important:** Replace `CHANGE_THIS_TO_SECURE_PASSWORD` with a strong, randomly generated password.

## Step 4: Get Connection Details

From your Neon dashboard, gather the following information:

- **Host**: Usually in format `your-project-name.neon.tech`
- **Port**: `5432` (default PostgreSQL port)
- **Database**: `demo_ecommerce` (or your database name)
- **User**: `demo_readonly`
- **Password**: The password you set in Step 3
- **SSL**: `true` (Neon requires SSL)

## Step 5: Configure Environment Variables

### For Local Development

1. Copy `env.example` to `.env` in the backend directory:
   ```bash
   cp env.example backend/.env
   ```

2. Add the demo database configuration to your `.env` file:
   ```env
   DEMO_DB_HOST=your-project-name.neon.tech
   DEMO_DB_PORT=5432
   DEMO_DB_NAME=demo_ecommerce
   DEMO_DB_USER=demo_readonly
   DEMO_DB_PASSWORD=your_secure_password_here
   DEMO_DB_SSL=true
   ```

### For Production Deployment

Add the same environment variables to your deployment platform:

**Render.com:**
1. Go to your service dashboard
2. Navigate to "Environment" tab
3. Add each variable individually

**Railway.app:**
1. Go to your project
2. Click on "Variables" tab
3. Add each variable

**Vercel/Netlify:**
1. Go to project settings
2. Navigate to "Environment Variables"
3. Add each variable for production environment

## Step 6: Verify Connection

After configuration, you can verify the connection works:

```bash
# Using psql
psql "postgresql://demo_readonly:your_password@your-project.neon.tech:5432/demo_ecommerce?sslmode=require"

# Or using a connection test script (to be created in next task)
npm run test:demo-connection
```

## Security Best Practices

1. **Never commit credentials to version control**
   - The `.env` file is in `.gitignore`
   - Only commit `env.example` with placeholder values

2. **Use strong passwords**
   - Generate passwords with at least 20 characters
   - Use a password manager to store credentials

3. **Rotate credentials periodically**
   - Change the demo_readonly password every 90 days
   - Update environment variables across all deployments

4. **Monitor usage**
   - Check Neon dashboard for unusual activity
   - Set up alerts for connection spikes

5. **Read-only enforcement**
   - The demo_readonly user has SELECT permissions only
   - No INSERT, UPDATE, DELETE, or DDL permissions

## Troubleshooting

### Connection Refused
- Verify SSL is enabled (`DEMO_DB_SSL=true`)
- Check that your IP is not blocked by Neon
- Verify the host and port are correct

### Authentication Failed
- Double-check username and password
- Ensure the user was created successfully
- Verify the user has CONNECT permission

### Permission Denied
- Ensure GRANT statements were executed
- Check that the user has USAGE on the schema
- Verify SELECT permissions on tables

## Next Steps

After completing this setup:

1. Proceed to Task 2: Create database initialization script
2. Run the initialization script to populate sample data
3. Test the demo connection in the application

## Maintenance

### Updating Sample Data

To refresh the demo data:

1. Connect as the database owner (not demo_readonly)
2. Run the initialization script from Task 2
3. Verify data integrity
4. Test queries with demo_readonly user

### Monitoring

Check these metrics regularly:

- Connection count (should be reasonable for free tier)
- Query performance (slow queries may indicate issues)
- Storage usage (Neon free tier has limits)
- Error rates in application logs

## Cost Considerations

Neon free tier includes:

- 10 GB storage
- 100 hours of compute per month
- Unlimited databases and branches

If usage exceeds free tier:

- Consider upgrading to paid plan
- Implement connection pooling
- Add query caching
- Monitor and optimize slow queries
