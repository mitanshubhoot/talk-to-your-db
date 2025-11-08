# Demo User Setup Instructions

## Quick Setup (5 minutes)

### Step 1: Connect to Your Neon Database

1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Make sure you're connected to the `neondb` database

### Step 2: Create the Demo User

Copy and paste the contents of `setup-demo-user.sql` into the SQL Editor, but **FIRST**:

1. Replace `CHANGE_THIS_PASSWORD` with a strong password (e.g., generate one with: `openssl rand -base64 32`)
2. Run the SQL script
3. Verify you see success messages

### Step 3: Update Render Environment Variables

Go to your Render dashboard and add/update these environment variables:

```
DEMO_DB_HOST=ep-solitary-resonance-af0ht5lv.c-2.us-west-2.aws.neon.tech
DEMO_DB_PORT=5432
DEMO_DB_NAME=neondb
DEMO_DB_USER=demo_readonly
DEMO_DB_PASSWORD=<the_password_you_set_in_step_2>
DEMO_DB_SSL=true
```

### Step 4: Redeploy

Render will automatically redeploy when you save the environment variables. Wait for the deployment to complete.

### Step 5: Test

1. Visit your application
2. You should see the demo database automatically connected
3. Try running a query like "show me all tables"

## Troubleshooting

### "password authentication failed"
- Double-check the password in Render matches what you set in Neon
- Make sure there are no extra spaces in the password
- Try resetting the password: `ALTER USER demo_readonly WITH PASSWORD 'new_password';`

### "permission denied"
- Make sure you ran ALL the GRANT statements
- Verify with: `SELECT * FROM information_schema.role_table_grants WHERE grantee = 'demo_readonly';`

### "user does not exist"
- Run: `SELECT usename FROM pg_user WHERE usename = 'demo_readonly';`
- If empty, the user wasn't created - run the CREATE USER statement again

## Security Notes

- The `demo_readonly` user can ONLY read data (SELECT queries)
- No INSERT, UPDATE, DELETE, or DDL operations are allowed
- This is enforced at both the database level (permissions) and application level (validation)
- The password should be strong and unique
- Store the password securely (e.g., in a password manager)

## Generate a Secure Password

Use one of these methods:

```bash
# Method 1: Using openssl
openssl rand -base64 32

# Method 2: Using pwgen (if installed)
pwgen -s 32 1

# Method 3: Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Quick Test Query

After setup, test the connection with:

```sql
-- This should work (SELECT is allowed)
SELECT current_database(), current_user, version();

-- This should fail (INSERT is not allowed)
INSERT INTO test_table VALUES (1);
```
