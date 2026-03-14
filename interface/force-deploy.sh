#!/bin/bash

echo "Building frontend with fresh cache..."
cd interface

# Clear any cached files
rm -rf dist/
rm -rf node_modules/.vite/

# Build fresh
npm run build

echo ""
echo "Build complete. Please:"
echo "1. Go to Vercel Dashboard"
echo "2. Navigate to your project"
echo "3. Click 'Deployments'"
echo "4. Click '⋮' on latest deployment"
echo "5. Select 'Redeploy'"
echo ""
echo "Or push a new commit to trigger automatic deployment:"
echo "git add ."
echo "git commit -m 'Force redeploy with fresh build'"
echo "git push"