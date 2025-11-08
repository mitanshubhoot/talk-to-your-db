# Demo Database Credentials

**⚠️ IMPORTANT: This file should NEVER be committed to version control!**

Add this file to `.gitignore` if you fill it out with real credentials.

## Connection Details

### Neon Project Information
- **Project Name**: _________________________
- **Project ID**: _________________________
- **Region**: _________________________
- **Created Date**: _________________________

### Database Connection
- **Host**: _________________________.neon.tech
- **Port**: 5432
- **Database Name**: demo_ecommerce
- **SSL Mode**: require

### Read-Only User Credentials
- **Username**: demo_readonly
- **Password**: _________________________

### Full Connection String
```
postgresql://demo_readonly:PASSWORD@HOST.neon.tech:5432/demo_ecommerce?sslmode=require
```

### Connection String (with actual values)
```
postgresql://demo_readonly:_________________________@_________________________.neon.tech:5432/demo_ecommerce?sslmode=require
```

## Environment Variables

Copy these to your `.env` file:

```env
DEMO_DB_HOST=_________________________.neon.tech
DEMO_DB_PORT=5432
DEMO_DB_NAME=demo_ecommerce
DEMO_DB_USER=demo_readonly
DEMO_DB_PASSWORD=_________________________
DEMO_DB_SSL=true
```

## Admin Access (Database Owner)

**Note:** Keep these credentials separate and more secure. Only use for maintenance.

- **Admin Username**: _________________________
- **Admin Password**: _________________________

## Password Generation

Use one of these methods to generate a secure password:

```bash
# Method 1: Using openssl
openssl rand -base64 32

# Method 2: Using /dev/urandom
LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c 32

# Method 3: Using pwgen (if installed)
pwgen -s 32 1
```

## Access Log

Track who has access to these credentials:

| Date | Person | Purpose | Revoked Date |
|------|--------|---------|--------------|
| YYYY-MM-DD | | | |
| | | | |
| | | | |

## Rotation Schedule

- **Last Rotated**: _________________________
- **Next Rotation Due**: _________________________ (90 days from last rotation)
- **Rotation Procedure**: See SETUP_GUIDE.md

## Emergency Contacts

- **Neon Support**: https://neon.tech/docs/introduction/support
- **Project Owner**: _________________________
- **Backup Contact**: _________________________

## Notes

_Add any additional notes about the database setup, special configurations, or known issues here._

---

**Security Reminder:**
- Store this file in a secure password manager or encrypted storage
- Do not share credentials via email or chat
- Use environment variables in all deployments
- Rotate passwords every 90 days
- Monitor access logs regularly
