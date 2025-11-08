# UI Testing Guide for Database Connection Fix

## Quick Start Testing

### 1. Start Your Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm start
```

### 2. Test Error Handling (No Database)
- Open browser to your frontend (usually http://localhost:3000)
- Try any database operation
- You should see clear error: "DATABASE_URL not configured"

### 3. Test With Invalid Database
```bash
# Add to backend/.env:
DATABASE_URL=postgresql://baduser:badpass@localhost:5432/baddb
```
- Restart backend
- Try database operations in UI
- Should see specific errors like "Cannot connect to database server"

### 4. Test With Valid Database
Run in terminal:
```bash
docker run --name test-postgres -e POSTGRES_DB=testdb -e POSTGRES_USER=testuser -e POSTGRES_PASSWORD=testpass -p 5432:5432 -d postgres:15
```

Add to backend/.env:
```bash
DATABASE_URL=postgresql://testuser:testpass@localhost:5432/testdb
```

- Restart backend
- Test database operations - should work!

## What to Look For
- Clear, helpful error messages
- No crashes or generic errors  
- Proper connection status indicators
- Smooth user experience even with errors