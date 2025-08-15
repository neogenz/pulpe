#!/bin/bash
set -e

echo "🚀 Setting up CI environment (2025 best practices)..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Checking Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI version: $(supabase --version)${NC}"

echo -e "${YELLOW}🐳 Starting Supabase local (optimized)...${NC}"
supabase start --exclude studio,inbucket,imgproxy

echo -e "${YELLOW}⏳ Health check with timeout...${NC}"
timeout=120
counter=0
until curl -s http://127.0.0.1:54321/rest/v1/ >/dev/null; do
  if [ $counter -gt $timeout ]; then
    echo -e "${RED}❌ Timeout waiting for Supabase${NC}"
    supabase status
    exit 1
  fi
  echo "Waiting for Supabase... ($counter/${timeout}s)"
  sleep 1
  counter=$((counter + 1))
done

echo -e "${GREEN}✅ Supabase ready!${NC}"

echo -e "${YELLOW}📝 Generating TypeScript types...${NC}"
supabase gen types typescript --local > src/types/database.types.ts

echo -e "${YELLOW}🔧 Setting up environment variables...${NC}"
cp .env.ci .env

echo -e "${GREEN}✅ CI environment ready!${NC}"