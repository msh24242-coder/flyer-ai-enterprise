#!/bin/bash

echo "🚀 PHASE 8: BUILDING AND TESTING"
echo "================================="

cd /home/claude/flyer-ai-enterprise/backend

echo "1️⃣ Installing dependencies..."
npm install

echo ""
echo "2️⃣ Running TypeScript type check..."
npx tsc --noEmit

echo ""
echo "3️⃣ Running ESLint..."
npx eslint src --max-warnings 5

echo ""
echo "4️⃣ Building project..."
npm run build

echo ""
echo "✅ BACKEND CHECKS COMPLETE"
