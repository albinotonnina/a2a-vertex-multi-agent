#!/bin/bash

set -e

echo "🧪 Running tests for A2A Multi-Agent System..."

# Run linting
echo "🔍 Running linter..."
pnpm run lint

# Run type checking
echo "📝 Running type checker..."
pnpm run typecheck

# Run tests
echo "🧪 Running test suite..."
pnpm run test:ci

echo ""
echo "✅ All tests passed!"
