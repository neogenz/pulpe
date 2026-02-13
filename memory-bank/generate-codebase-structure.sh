#!/bin/bash

# Script to generate codebase structure documentation
# Author: Pulpe Budget Project
# Description: Generates a comprehensive markdown file showing the project structure using the tree command

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$SCRIPT_DIR/CODEBASE_STRUCTURE.md"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🌳 Generating Codebase Structure Documentation${NC}"

# Check if tree command is available
if ! command -v tree &> /dev/null; then
    echo -e "${RED}❌ Error: 'tree' command not found${NC}"
    echo ""
    echo "Please install tree:"
    echo "  - macOS: brew install tree"
    echo "  - Ubuntu/Debian: sudo apt install tree"
    echo "  - Arch Linux: sudo pacman -S tree"
    echo "  - CentOS/RHEL: sudo yum install tree"
    exit 1
fi

# Change to workspace root
cd "$WORKSPACE_ROOT"

# Common exclusions for tree command
EXCLUSIONS="node_modules|.git|.pnpm-store|.turbo|dist|build|coverage|.nyc_output|.DS_Store|*.log|.vercel|.idea|tmp|.serena|.changeset|docs"

echo -e "${YELLOW}📊 Generating structure overview...${NC}"

# Generate the markdown file
cat > "$OUTPUT_FILE" << 'EOF'
# Pulpe Budget - Codebase Structure

> **Auto-generated documentation** - Last updated:
EOF

# Add timestamp
echo "$(date '+%Y-%m-%d %H:%M:%S')" >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'

This document provides a comprehensive overview of the Pulpe Budget project structure.

## 📋 Project Overview

Pulpe Budget is a modern full-stack personal finance application built with:
- **Frontend**: Angular 21 with Material Design 3
- **Backend**: NestJS with Supabase (PostgreSQL)
- **Mobile**: iOS SwiftUI application
- **Architecture**: Monorepo with Turborepo orchestration

---

## 🏗️ High-Level Structure

### Root Directory Overview
EOF

# Generate high-level tree (directories only, 2 levels deep)
echo '```' >> "$OUTPUT_FILE"
tree -d -L 2 -I "$EXCLUSIONS" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'

### Key Directories

#### 🎯 Main Applications
- `frontend/` - Angular 21 web application with Material Design 3
- `backend-nest/` - NestJS API server with Supabase integration
- `mobile/` - iOS SwiftUI native application
- `shared/` - Shared TypeScript types and Zod schemas

#### ⚙️ Configuration & Tooling
- `.cursor/` - Cursor AI editor rules and configurations
- `.github/` - GitHub Actions workflows and templates
- `memory-bank/` - AI assistant context and architectural documentation

---

## 📁 Detailed Structure

### Frontend Application
```
EOF

# Generate detailed frontend structure
tree -L 3 -I "$EXCLUSIONS" frontend/ >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
```

### Backend API
```
EOF

# Generate detailed backend structure
tree -L 3 -I "$EXCLUSIONS" backend-nest/ >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
```

### Mobile Application
```
EOF

# Generate detailed mobile structure
tree -L 3 -I "$EXCLUSIONS" mobile/ >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
```

### Shared Package
```
EOF

# Generate detailed shared structure
tree -L 3 -I "$EXCLUSIONS" shared/ >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
```

---

## 📊 Statistics

EOF

# Generate file statistics
echo "### File Count by Type" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "TypeScript files:   $(find . -name "*.ts" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.turbo/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Angular templates:  $(find . -name "*.html" -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Style files:        $(find . \( -name "*.css" -o -name "*.scss" \) -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "JavaScript files:   $(find . -name "*.js" -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "JSON files:         $(find . -name "*.json" -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Markdown files:     $(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Test files:         $(find . \( -name "*.spec.ts" -o -name "*.test.ts" \) -not -path "./node_modules/*" -not -path "./.git/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'

### Directory Statistics
```
EOF

echo "Total directories:  $(find . -type d -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.turbo/*" | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Frontend dirs:      $(find ./frontend -type d 2>/dev/null | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Backend dirs:       $(find ./backend-nest -type d 2>/dev/null | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Mobile dirs:        $(find ./mobile -type d 2>/dev/null | wc -l | xargs)" >> "$OUTPUT_FILE"
echo "Shared dirs:        $(find ./shared -type d 2>/dev/null | wc -l | xargs)" >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
```

---

## 🔍 Complete Project Tree

<details>
<summary>Click to expand complete structure</summary>

```
EOF

# Generate complete tree with exclusions
tree -a -I "$EXCLUSIONS" >> "$OUTPUT_FILE"

cat >> "$OUTPUT_FILE" << 'EOF'
```

</details>

---

## 🚀 Quick Navigation

### Development Commands
- **Start all services**: `pnpm dev`
- **Frontend only**: `pnpm dev:frontend`
- **Backend only**: `pnpm dev:backend`
- **Run tests**: `pnpm test`
- **Build all**: `pnpm build`

### Key Configuration Files
- `turbo.json` - Turborepo configuration
- `package.json` - Root package configuration
- `pnpm-workspace.yaml` - PNPM workspace configuration
- `CLAUDE.md` - AI assistant instructions

### Documentation
- `README.md` - Project overview and setup
- `CLAUDE.md` - Development guidelines
- `docs/CI.md` - Continuous integration setup
- `supabase-github-ci.md` - Supabase CI/CD guide

---

*Generated automatically by `generate-codebase-structure.sh`*
*To regenerate: `cd memory-bank && ./generate-codebase-structure.sh`*
EOF

echo -e "${GREEN}✅ Successfully generated: $OUTPUT_FILE${NC}"
echo -e "${YELLOW}📄 File location: ${OUTPUT_FILE#$WORKSPACE_ROOT/}${NC}"
echo ""
echo "To view the generated file:"
echo "  cat '$OUTPUT_FILE'"
echo ""
echo "To regenerate in the future:"
echo "  cd memory-bank && ./generate-codebase-structure.sh"