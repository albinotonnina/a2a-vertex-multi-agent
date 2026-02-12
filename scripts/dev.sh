#!/bin/bash

set -e

echo "🎭 Starting A2A Multi-Agent System in development mode..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Run './scripts/setup.sh' first"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Check if built
if [ ! -d "packages/core/dist" ]; then
    echo "📦 Building packages first..."
    pnpm run build
fi

# Start services with docker-compose
echo "🐳 Starting services with docker-compose..."
docker-compose up --build

# Cleanup on exit
trap 'echo "🛑 Shutting down..."; docker-compose down' EXIT INT TERM
