#!/bin/bash

set -e

echo "🚀 Setting up A2A Multi-Agent System..."

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@9.1.0
else
    echo "✓ pnpm is already installed"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build all packages
echo "🔨 Building packages..."
pnpm run build

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration"
else
    echo "✓ .env file exists"
fi

# Check for GCP credentials
if [ ! -d credentials ]; then
    echo "⚠️  No credentials directory found."
    echo "📝 Please create a 'credentials' directory and add your GCP service account key"
    echo "   Then update GOOGLE_APPLICATION_CREDENTIALS_PATH in .env"
    mkdir -p credentials
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your GCP service account key to the credentials directory"
echo "2. Update .env with your VERTEX_AI_PROJECT"
echo "3. Run './scripts/dev.sh' to start all services"
