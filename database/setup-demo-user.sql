-- Setup script for demo_readonly user in Neon database
-- Run this in your Neon SQL Editor

-- Step 1: Create the demo_readonly user with a secure password
-- IMPORTANT: Change 'CHANGE_THIS_PASSWORD' to a strong password
CREATE USER demo_readonly WITH PASSWORD 'CHANGE_THIS_PASSWORD';

-- Step 2: Grant connect permission to the database
GRANT CONNECT ON DATABASE neondb TO demo_readonly;

-- Step 3: Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO demo_readonly;

-- Step 4: Grant SELECT permission on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO demo_readonly;

-- Step 5: Ensure future tables also grant SELECT to this user
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO demo_readonly;

-- Step 6: Grant SELECT on all sequences (for serial columns)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO demo_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO demo_readonly;

-- Verify the user was created
SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename = 'demo_readonly';

-- Verify permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'demo_readonly';
