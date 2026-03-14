# Deployment Guide: Vercel + Supabase

## Overview
This guide will walk you through deploying your trucking app to production using Vercel for the frontend and Supabase for the backend and database.

## Prerequisites
- GitHub account
- Supabase account (https://supabase.com)
- Vercel account (https://vercel.com)
- Your project code pushed to GitHub

**Repository Structure Recommendation:**
Create a single repository in the root `usx_app` directory containing:
- `api/` - Backend Node.js server
- `interface/` - Frontend React application  
- `supabase/` - Database migrations and Edge Functions
- Configuration files (README.md, deployment guides, etc.)

This monorepo approach keeps your full-stack application organized and allows for easier management of the complete deployment pipeline.

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click "New project"
3. Choose your organization
4. Select your region (closest to your users)
5. Set a secure database password
6. Wait for project to be created (2-5 minutes)

### 1.2 Set Up Database
1. Go to your project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
5. Click "Run" to execute the migration

### 1.3 Configure Supabase Edge Functions
1. In your Supabase dashboard, go to "Edge Functions"
2. Click "Create a new function"
3. Name it `api` (or similar)
4. Upload the `supabase/edge-functions/api/index.ts` file (TypeScript)
5. **Check environment variables** (if not already set):
   - `SUPABASE_URL`: Your project URL (from Settings > API)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (from Settings > API)
   - `JWT_SECRET`: Generate a secure secret (use a tool like https://generate-secret.now.sh/32)

**Note:** These are Supabase Edge Function environment variables, NOT the `.env` file. In the Supabase dashboard, when you create the Edge Function, there will be a section to add environment variables specific to that function.

**Note:** Your local `.env` file already contains example values, but for production you'll need to get the actual values from your Supabase project settings.

**How to find your Supabase values (Updated for new API system):**
1. Go to your Supabase project dashboard
2. Click "Settings" in the left sidebar
3. Click "API" 
4. You'll find:
   - **Project URL** (SUPABASE_URL)
   - **anon public key** (SUPABASE_ANON_KEY) - for client-side access
   - **service_role key** (SUPABASE_SERVICE_ROLE_KEY) - for server-side access
   - **Database URL** (SUPABASE_DB_URL) - for direct database connections

**Note:** Supabase has updated their API key system. The service_role key is still available in the API settings and is required for server-side operations in Edge Functions.

**Important:** If these environment variables are already set and hashed in your Edge Function (as you mentioned), you can skip this step. The variables are persistent and don't need to be re-entered unless you're creating a new Edge Function.

**Note:** The Edge Function uses Deno imports:
- `@supabase/supabase-js` → `https://esm.sh/@supabase/supabase-js@2.38.0`
- JWT utilities from `../utils/jwt.ts`

### 1.4 Configure CORS
1. Go to "Authentication" > "Settings" in Supabase
2. Add your Vercel domain(s) to "Site URL" and "Redirect URLs"
3. Example: `https://your-project.vercel.app`

## Step 2: Prepare Frontend for Vercel

### 2.1 Update Package.json
Ensure your `interface/package.json` has the correct build script:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 2.2 Test Build Locally
```bash
cd interface
npm run build
```

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub Repository
1. Go to [vercel.com](https://vercel.com) and sign up/log in
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - Framework Preset: "Other"
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
   - Root Directory: `interface` (select this to deploy only the frontend)

**Important:** The Vercel configuration (`vercel.json`) is set up to serve your React app as a static site. API requests will be handled by your Supabase Edge Function via the `VITE_API_URL` environment variable.

### 3.2 Set Environment Variables
In Vercel dashboard, go to Settings > Environment Variables and add:
- `VITE_API_URL`: Your Supabase Edge Function URL
  - Format: `https://your-project.supabase.co/functions/v1/api`

### 3.3 Deploy
1. Click "Deploy"
2. Wait for deployment to complete
3. Note your production URL (e.g., `https://your-project.vercel.app`)

## Step 4: Configure Production Settings

### 4.1 Update Frontend Config
The `interface/src/config.js` file automatically detects the environment:
- Development: `localhost`
- iPad: `172.20.10.4`
- Production: `vercel.app` domains

### 4.2 Update Supabase CORS
Add your Vercel domain to Supabase CORS settings:
1. Go to "Settings" > "API" in Supabase
2. Add your Vercel URL to "Allowed URLs"
3. Example: `https://your-project.vercel.app`

## Step 5: Test Deployment

### 5.1 Test Registration and Login
1. Visit your Vercel deployment URL
2. Register a new account
3. Log in with the new account
4. Verify you can access the dashboard

### 5.2 Test Core Features
1. Add a load
2. Add fuel stops
3. Check settings
4. Verify all features work correctly

### 5.3 Test on iPad
1. Open your Vercel URL on iPad
2. Test login and navigation
3. Verify mobile responsiveness

## Troubleshooting

### Common Issues

**CORS Errors:**
- Ensure your Vercel domain is added to Supabase CORS settings
- Check that the API URL in frontend config is correct

**Authentication Issues:**
- Verify JWT_SECRET is the same in both Supabase and frontend
- Check that the API endpoint is accessible

**Database Connection:**
- Ensure Supabase project is running
- Verify database tables were created successfully

**Build Errors:**
- Check that all dependencies are in package.json
- Verify build command works locally

### Getting Help
- Supabase Documentation: https://supabase.com/docs
- Vercel Documentation: https://vercel.com/docs
- Check browser console for JavaScript errors
- Check network tab for API request issues

## Next Steps

1. **Custom Domain:** Set up a custom domain in Vercel
2. **SSL Certificate:** Vercel provides free SSL
3. **Monitoring:** Set up error tracking and monitoring
4. **Backups:** Configure database backups in Supabase
5. **Performance:** Optimize images and implement caching

## Production Checklist

- [ ] Supabase project created and configured
- [ ] Database schema migrated
- [ ] Edge Functions deployed
- [ ] CORS settings configured
- [ ] Frontend built successfully
- [ ] Vercel deployment complete
- [ ] Environment variables set
- [ ] Registration and login working
- [ ] Core features tested
- [ ] Mobile responsiveness verified
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active