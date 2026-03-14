#!/bin/bash

# Deployment script for Vercel
echo "Building frontend..."
cd interface
npm run build

echo "Deployment ready. Please:"
echo "1. Go to Vercel Dashboard"
echo "2. Navigate to your project"
echo "3. Click 'Deployments'"
echo "4. Click '⋮' on latest deployment"
echo "5. Select 'Redeploy'"
echo ""
echo "Or push a new commit to trigger automatic deployment."