#!/bin/bash
# iOS Version Bump Script
# Usage: ./bump-version.sh [major|minor|patch|build|set X.Y.Z]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_FILE="$SCRIPT_DIR/../project.yml"

if [[ ! -f "$PROJECT_FILE" ]]; then
    echo "Error: project.yml not found at $PROJECT_FILE"
    exit 1
fi

# Extract current versions
CURRENT_VERSION=$(grep -E "^\s+MARKETING_VERSION:" "$PROJECT_FILE" | head -1 | sed 's/.*: *"\(.*\)"/\1/')
CURRENT_BUILD=$(grep -E "^\s+CURRENT_PROJECT_VERSION:" "$PROJECT_FILE" | head -1 | sed 's/.*: *"\(.*\)"/\1/')

if [[ -z "$CURRENT_VERSION" || -z "$CURRENT_BUILD" ]]; then
    echo "Error: Could not parse version from project.yml"
    exit 1
fi

# Parse semantic version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$1" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        NEW_BUILD=1
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        NEW_BUILD=1
        ;;
    patch)
        PATCH=$((PATCH + 1))
        NEW_BUILD=1
        ;;
    build)
        NEW_BUILD=$((CURRENT_BUILD + 1))
        ;;
    set)
        if [[ -z "$2" ]]; then
            echo "Error: 'set' requires a version argument (e.g. set 1.7.0)"
            exit 1
        fi
        if [[ ! "$2" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Error: Invalid version format '$2' (expected X.Y.Z)"
            exit 1
        fi
        IFS='.' read -r MAJOR MINOR PATCH <<< "$2"
        NEW_BUILD=1
        ;;
    "")
        echo "Current: $CURRENT_VERSION (build $CURRENT_BUILD)"
        echo ""
        echo "Usage: $0 [major|minor|patch|build]"
        echo "  major  - $CURRENT_VERSION → $((MAJOR + 1)).0.0 (reset build)"
        echo "  minor  - $CURRENT_VERSION → $MAJOR.$((MINOR + 1)).0 (reset build)"
        echo "  patch  - $CURRENT_VERSION → $MAJOR.$MINOR.$((PATCH + 1)) (reset build)"
        echo "  build  - build $CURRENT_BUILD → $((CURRENT_BUILD + 1))"
        echo "  set    - set to specific version (e.g. set 1.7.0, reset build)"
        exit 0
        ;;
    *)
        echo "Error: Unknown command '$1'"
        echo "Usage: $0 [major|minor|patch|build]"
        exit 1
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Update project.yml
sed -i '' "s/MARKETING_VERSION: \"$CURRENT_VERSION\"/MARKETING_VERSION: \"$NEW_VERSION\"/" "$PROJECT_FILE"
sed -i '' "s/CURRENT_PROJECT_VERSION: \"$CURRENT_BUILD\"/CURRENT_PROJECT_VERSION: \"$NEW_BUILD\"/" "$PROJECT_FILE"

echo "Updated: $CURRENT_VERSION (build $CURRENT_BUILD) → $NEW_VERSION (build $NEW_BUILD)"
echo ""
echo "Next: run 'xcodegen generate' to update Xcode project"
