# Deploying to Render

This guide will help you deploy the Talk-to-Your-DB application to Render's free tier.

## Prerequisites

- A Render account (sign up at https://render.com)
- Your GitHub repository connected to Render
- A Google API key for Gemini (get it from https://aistudio.google.com/app/apikey)

## Deployment Steps

### 1. Create a New Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** button
3. Select **"Web Service"**
4. Connect your GitHub repository: `https://github.com/mitanshubhoot/talk-to-your-db`
5. Render will automatically detect the `render.yaml` file

### 2. Configure the Service

Render should auto-configure from `render.yaml`, but verify these settings:

- **Name**: `talk-to-your-db`
- **Environment**: `Node`
- **Build Command**: 
  ```bash
  cd backend && npm install && npm run build && cd .. && cd frontend && npm install && npm run build && cd .. && mkdir -p backend/dist/public && cp -r frontend/dist/* backend/dist/public/
  ```
- **Start Command**: 
  ```bash
  cd backend && node dist/index.js
  ```
- **Instance Type**: `Free`

### 3. Set Environment Variables

Click on **"Environment"** tab and add these variables:

**Required:**
- `NODE_ENV` = `production`
- `PORT` = `10000`
- `GOOGLE_API_KEY` = `your_google_api_key_here`

**Optional (for additional AI providers):**
- `OPENAI_API_KEY` = `your_openai_key` (if you have one)
- `ANTHROPIC_API_KEY` = `your_anthropic_key` (if you have one)

### 4. Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying your application
3. This will take 5-10 minutes for the first deployment
4. Watch the logs for any errors

### 5. Access Your Application

Once deployed, your app will be available at:
```
https://talk-to-your-db.onrender.com
```

## Important Notes

### Free Tier Limitations

- **Spin Down**: Free services spin down after 15 minutes of inactivity
- **Spin Up**: First request after spin down takes 30-60 seconds
- **Build Minutes**: 500 free build minutes per month
- **Bandwidth**: 100 GB/month

### Database Connections

Your app connects to external databases that users provide. Make sure:
- Users can connect to publicly accessible databases
- Or use connection strings with proper authentication
- PostgreSQL, MySQL, and SQLite are supported

### Troubleshooting

**Build Fails:**
- Check the build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify Node version compatibility

**App Won't Start:**
- Check environment variables are set correctly
- Look for errors in the deployment logs
- Ensure `PORT` is set to `10000`

**API Errors:**
- Verify `GOOGLE_API_KEY` is set correctly
- Check API key has proper permissions
- Look at runtime logs for specific errors

**Frontend Not Loading:**
- Ensure build command copied frontend files to `backend/dist/public/`
- Check that `NODE_ENV=production` is set
- Verify static file serving is working in logs

### Updating Your Deployment

Render automatically deploys when you push to your `main` branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Render will detect the push and redeploy automatically.

### Manual Redeploy

If you need to manually trigger a deployment:
1. Go to your service in Render dashboard
2. Click **"Manual Deploy"**
3. Select **"Deploy latest commit"**

## Cost Optimization

To stay within free tier limits:
- Use the free tier (spins down after 15 min of inactivity)
- Optimize build times by caching dependencies
- Monitor your usage in Render dashboard

## Support

If you encounter issues:
- Check Render's status page: https://status.render.com
- Review Render docs: https://render.com/docs
- Check application logs in Render dashboard
