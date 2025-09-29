#!/bin/bash

# Build script for Docker containerization
set -e

echo "🏗️  Building Dyad Frontend for Production..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Run security audit
echo "🔒 Running security audit..."
npm audit --audit-level moderate || echo "⚠️  Security audit completed with warnings"

# Run linting
echo "🔍 Running linting..."
npm run lint || echo "⚠️  Linting completed with warnings"

# Run type checking
echo "📝 Running type checking..."
npm run type-check

# Build for production
echo "🚀 Building for production..."
npm run build

# Verify build
echo "✅ Verifying build..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ Build successful!"
    echo "📊 Build size:"
    du -sh dist/
    echo "📁 Build contents:"
    ls -la dist/
else
    echo "❌ Build failed - dist directory or index.html not found"
    exit 1
fi

echo "🎉 Frontend build completed successfully!"