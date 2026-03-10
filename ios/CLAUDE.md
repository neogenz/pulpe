# CLAUDE.md - Pulpe iOS

## Project Configuration (XcodeGen)

**`project.yml` is the single source of truth.** The `.xcodeproj` is generated and gitignored.

| File | Role | Versioned |
|------|------|-----------|
| `project.yml` | Project configuration (targets, settings, dependencies) | Yes |
| `Pulpe.xcodeproj/` | Generated Xcode project | No (gitignored) |

**Never edit settings in Xcode UI** — changes are lost on next `xcodegen generate`.

| To change... | Edit in `project.yml` |
|---|---|
| Deployment target | `options.deploymentTarget.iOS` |
| Swift version | `settings.base.SWIFT_VERSION` |
| Bundle ID | `targets.Pulpe.settings.base.PRODUCT_BUNDLE_IDENTIFIER` |
| Info.plist values | `targets.Pulpe.info.properties` |
| Environment values | `targets.Pulpe.configFiles` + `Config/*.xcconfig` |
| SPM dependency | `packages` + `targets.Pulpe.dependencies` |
| Build settings | `settings.base` or `targets.X.settings.base` |

### Adding New Files

1. Create the `.swift` file in the correct folder
2. Run `xcodegen generate` — auto-detected, no manual "Add to target"

## Commands

```bash
# After git pull / clone
xcodegen generate

# Build (pick scheme)
xcodebuild build -scheme PulpeLocal   -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO
xcodebuild build -scheme PulpePreview -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO
xcodebuild build -scheme PulpeProd    -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO

# Tests (scheme matters!)
# Unit tests → PulpeLocal → target PulpeTests
xcodebuild test -scheme PulpeLocal   -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' -only-testing:PulpeTests/SomeTest CODE_SIGNING_ALLOWED=NO
# UI tests  → PulpeUITests → NEVER use PulpeLocal
xcodebuild test -scheme PulpeUITests -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' -only-testing:PulpeUITests/SomeTest CODE_SIGNING_ALLOWED=NO

# Backend (from repo root)
cd .. && pnpm dev:backend
```

## Versioning

| Variable | Usage | When to increment |
|---|---|---|
| `MARKETING_VERSION` | App Store (1.0.0) | New user-facing release |
| `CURRENT_PROJECT_VERSION` | Build number (1, 2…) | Every TestFlight upload |

```bash
./scripts/bump-version.sh patch   # 1.0.0 → 1.0.1 (resets build to 1)
./scripts/bump-version.sh build   # build 1 → 2
```

## Currency

```swift
amount.asCHF        // "1'234.56 CHF"
amount.asCompactCHF // "1'235 CHF"
```

## iOS-Specific Vocabulary

| Code | French UI |
|---|---|
| `BudgetLine` | Catégorie / Ligne budgétaire |
| `Transaction` (allocated) | Transaction liée à une catégorie |

*(General vocabulary — expense/income/saving — is in root CLAUDE.md)*
