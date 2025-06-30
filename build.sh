#!/bin/bash
set -e

echo "🔧 Building Talk to your DB backend for Render..."

# Navigate to backend directory
cd backend

# Install ALL dependencies (including devDependencies for TypeScript types)
echo "📦 Installing ALL backend dependencies (including devDependencies)..."
npm install --include=dev

# Rebuild native modules for the current platform (fixes SQLite3 issues)
echo "🔨 Rebuilding native modules for deployment platform..."
npm rebuild

# Build TypeScript
echo "🏗️ Building TypeScript..."
npm run build

# Verify build
echo "✅ Build complete! Checking files..."
ls -la dist/

echo "�� Ready to start!" 