#!/bin/bash

echo "Testing Real Web Search Integration..."
echo "======================================="
echo ""

echo "1. Testing Research Agent directly..."
response=$(curl -s -X POST http://localhost:3001/api/v1/research/process \
  -H "Content-Type: application/json" \
  -d '{"query": "artificial intelligence news"}')

echo "Response:"
echo "$response" | jq '.'
echo ""

echo "2. Checking if web_search tool was used..."
echo "$response" | jq -r '.metadata.toolsUsed[]?' 2>/dev/null || echo "No tools used"
echo ""

echo "3. Checking search source..."
echo "$response" | jq -r '.result' 2>/dev/null | grep -o '"source":"[^"]*"' | head -1 || echo "Could not find source"
