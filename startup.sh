#!/bin/sh

# Azure App Service Startup Script for Next.js
# This script ensures Next.js is properly started with the correct port

echo "🚀 Starting MGNREGA Visualizer..."
echo "📍 Current directory: $(pwd)"
echo "📦 Node version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Running npm install..."
  npm install --production
fi

# Check if .next build directory exists
if [ ! -d ".next" ]; then
  echo "⚠️  .next directory not found. Running build..."
  npm run build
fi

# Set port
export PORT=${PORT:-8080}
echo "🌐 Starting server on port $PORT"

# Start the application
exec npm start
