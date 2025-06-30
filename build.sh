#!/bin/bash
set -e

echo "🔧 Building Talk to your DB backend for Render..."

# Navigate to backend directory
cd backend

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

# Verify build
echo "✅ Build complete! Checking files..."
ls -la dist/

echo "�� Ready to start!" 