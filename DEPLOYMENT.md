# 🚀 Deployment Guide - Talk to your DB

## 📋 Prerequisites

Before deploying, ensure you have:
- ✅ Code pushed to GitHub repository
- ✅ API keys for AI providers (Hugging Face, Cohere, OpenAI)
- ✅ Database requirements understood

## 🔥 Option 1: Railway (Recommended - Easiest)

### Why Railway?
- ✅ Full-stack support (frontend + backend + database)
- ✅ Free PostgreSQL database included
- ✅ GitHub integration
- ✅ $5/month free credits

### Step-by-Step:

1. **Sign Up & Connect GitHub**
   - Go to [railway.app](https://railway.app)
   - Sign up with your GitHub account
   - Click "New Project" → "Deploy from GitHub repo"
   - Select `mitanshubhoot/talk-to-your-db`

2. **Add Database**
   - In your Railway project, click "New" → "Database" → "PostgreSQL"
   - Railway will automatically create a database and provide connection URL

3. **Configure Environment Variables**
   ```bash
   # In Railway Dashboard → your service → Variables tab:
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-filled by Railway
   
   # AI Provider Keys (add your actual keys):
   HUGGING_FACE_API_KEY=hf_your_key_here
   COHERE_API_KEY=your_cohere_key_here
   OPENAI_API_KEY=sk-your_openai_key_here
   ```

4. **Deploy**
   - Railway will automatically build and deploy
   - Access your app at the provided Railway URL

---

## 🔄 Option 2: Render

### Step-by-Step:

1. **Backend Deployment**
   - Go to [render.com](https://render.com) → Sign up
   - "New" → "Web Service" → Connect GitHub repo
   - Settings:
     ```
     Build Command: npm run build:backend
     Start Command: npm run start:backend
     ```

2. **Database Setup**
   - "New" → "PostgreSQL" → Create free database
   - Copy the connection string

3. **Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=10000  # Render uses port 10000
   DATABASE_URL=your_postgres_connection_string
   HUGGING_FACE_API_KEY=hf_your_key_here
   COHERE_API_KEY=your_cohere_key_here
   OPENAI_API_KEY=sk-your_openai_key_here
   ```

4. **Frontend Deployment**
   - "New" → "Static Site" → Connect same repo
   - Settings:
     ```
     Build Command: npm run build:frontend
     Publish Directory: frontend/dist
     ```

---

## 🔀 Option 3: Split Deployment

### Frontend: Vercel
1. Go to [vercel.com](https://vercel.com) → Import project from GitHub
2. Framework Preset: "Vite"
3. Root Directory: `frontend`
4. Deploy

### Backend: Railway/Render
- Follow backend steps from Option 1 or 2

---

## 🔧 Environment Variables Guide

### Required Variables:
```bash
# Production
NODE_ENV=production
PORT=3001 (or 10000 for Render)

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# AI Providers (Get your keys from):
HUGGING_FACE_API_KEY=  # https://huggingface.co/settings/tokens
COHERE_API_KEY=        # https://dashboard.cohere.ai/api-keys  
OPENAI_API_KEY=        # https://platform.openai.com/api-keys
```

### Optional Variables:
```bash
# Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10

# Security
CORS_ORIGIN=https://your-frontend-domain.com
```

---

## 🐛 Troubleshooting

### Common Issues:

1. **Build Fails**
   ```bash
   # Check Node.js version (needs 18+)
   # Ensure all dependencies in package.json
   ```

2. **Database Connection Issues**
   ```bash
   # Verify DATABASE_URL format
   # Check if database allows external connections
   ```

3. **API Keys Not Working**
   ```bash
   # Ensure no extra spaces in environment variables
   # Check key permissions and quotas
   ```

4. **Frontend Can't Connect to Backend**
   ```bash
   # Update API base URL in frontend/src/services/api.ts
   # Check CORS settings in backend
   ```

---

## 🔄 Post-Deployment

1. **Test Your App**
   - Visit your deployed URL
   - Test database connection
   - Try generating SQL queries
   - Check optimization features

2. **Monitor Usage**
   - Check platform dashboards for resource usage
   - Monitor API key quotas
   - Set up alerts if needed

3. **Domain Setup (Optional)**
   - Add custom domain in platform settings
   - Update environment variables if needed

---

## 💰 Free Tier Limits

### Railway:
- $5/month free credits
- 500 hours execution time
- 1GB RAM, 1 vCPU

### Render:
- 750 hours/month free
- 512MB RAM
- Free PostgreSQL (expires after 90 days)

### Vercel:
- 100GB bandwidth/month
- 6000 serverless function hours
- Custom domains included

---

## 🚀 Ready to Deploy?

Choose your platform and follow the steps above. Railway is recommended for beginners due to its simplicity and integrated database.

**Need help?** Check the troubleshooting section or create an issue in the GitHub repository. 