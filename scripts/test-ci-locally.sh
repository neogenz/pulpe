#!/bin/bash

# Test CI Locally - Reproduit les étapes du workflow GitHub Actions
# Usage: ./scripts/test-ci-locally.sh [package]
# package: all, frontend, backend, shared (default: all)

set -e

PACKAGE=${1:-all}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 Testing CI workflows locally"
echo "Package: $PACKAGE"
echo "Project root: $PROJECT_ROOT"
echo "==========================================="

# Always work from project root
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

run_step() {
    local step_name="$1"
    local step_command="$2"
    
    log_info "Running: $step_name"
    echo "Command: $step_command"
    echo "Working directory: $(pwd)"
    
    if eval "$step_command"; then
        log_success "$step_name completed successfully"
    else
        log_error "$step_name failed"
        exit 1
    fi
    echo ""
}

run_step_in_dir() {
    local step_name="$1"
    local target_dir="$2"
    local step_command="$3"
    
    log_info "Running: $step_name"
    echo "Target directory: $target_dir"
    echo "Command: $step_command"
    
    # Verify directory exists
    if [ ! -d "$target_dir" ]; then
        log_error "Directory $target_dir does not exist!"
        echo "Available directories:"
        ls -la "$PROJECT_ROOT"
        exit 1
    fi
    
    # Execute in subshell to avoid changing working directory
    if (cd "$target_dir" && eval "$step_command"); then
        log_success "$step_name completed successfully"
    else
        log_error "$step_name failed"
        exit 1
    fi
    echo ""
}

# Health Check - Environment
log_info "=== Environment Health Check ==="
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"
echo "bun version: $(bun --version 2>/dev/null || echo 'not available')"
echo "Current directory: $(pwd)"
echo ""

# Health Check - Dependencies
log_info "=== Dependencies Health Check ==="
echo "Workspace structure:"
ls -la
echo ""
echo "Package.json files:"
find . -name "package.json" -not -path "./node_modules/*" | head -5
echo ""

# Verify required directories exist
log_info "=== Directory Verification ==="
for dir in frontend backend-nest shared; do
    if [ -d "$dir" ]; then
        log_success "✓ $dir directory exists"
    else
        log_error "✗ $dir directory missing"
        exit 1
    fi
done
echo ""

# Install dependencies
run_step "Install dependencies" "pnpm install --frozen-lockfile"

# Build shared packages
run_step "Build shared packages" "pnpm run build:shared"

# Quality checks
if [ "$PACKAGE" = "all" ] || [ "$PACKAGE" = "frontend" ]; then
    log_info "=== Frontend Quality Checks ==="
    run_step_in_dir "Frontend lint" "frontend" "pnpm run lint"
fi

if [ "$PACKAGE" = "all" ] || [ "$PACKAGE" = "backend" ]; then
    log_info "=== Backend Quality Checks ==="
    run_step_in_dir "Backend lint" "backend-nest" "pnpm run lint"
fi

if [ "$PACKAGE" = "all" ]; then
    log_info "=== Global Quality Checks ==="
    run_step "Format check" "pnpm run format:check"
    run_step "Type check" "pnpm run type-check"
fi

# Tests
if [ "$PACKAGE" = "all" ] || [ "$PACKAGE" = "backend" ]; then
    log_info "=== Backend Tests ==="
    run_step_in_dir "Backend unit tests" "backend-nest" "bun run test:unit"
    run_step_in_dir "Backend integration tests" "backend-nest" "bun run test:integration"
fi

if [ "$PACKAGE" = "all" ] || [ "$PACKAGE" = "frontend" ]; then
    log_info "=== Frontend Tests ==="
    run_step_in_dir "Frontend tests" "frontend" "pnpm run test:vitest:run"
fi

# Build check
if [ "$PACKAGE" = "all" ]; then
    log_info "=== Build Check ==="
    run_step "Full build" "pnpm run build"
fi

log_success "All CI steps completed successfully! 🎉"
echo ""
echo "You can now push your changes with confidence that CI should pass."
echo ""
echo "Available options:"
echo "  ./scripts/test-ci-locally.sh all       # Test everything"
echo "  ./scripts/test-ci-locally.sh frontend  # Test only frontend"
echo "  ./scripts/test-ci-locally.sh backend   # Test only backend"
echo "  ./scripts/test-ci-locally.sh shared    # Test only shared" 