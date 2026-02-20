# CLAUDE.md - Pulpe iOS

## Project Configuration (XcodeGen)

**`project.yml` is the single source of truth.** The `.xcodeproj` is generated and gitignored.

| File | Role | Versioned |
|------|------|-----------|
| `project.yml` | Project configuration (targets, settings, dependencies) | Yes |
| `Pulpe.xcodeproj/` | Generated Xcode project | No (gitignored) |

### Workflow

```bash
# After git pull or clone
xcodegen generate                        # Regenerate .xcodeproj
open Pulpe.xcodeproj                     # Open in Xcode
```

### Modifying Project Settings

**Never edit settings in Xcode UI** - changes will be lost on next `xcodegen generate`.

| To change... | Edit in `project.yml` |
|--------------|----------------------|
| Deployment target | `options.deploymentTarget.iOS` |
| Swift version | `settings.base.SWIFT_VERSION` |
| Bundle ID | `targets.Pulpe.settings.base.PRODUCT_BUNDLE_IDENTIFIER` |
| Info.plist values | `targets.Pulpe.info.properties` |
| Environment values | `targets.Pulpe.configFiles` + `Config/*.xcconfig` |
| Add SPM dependency | `packages` + `targets.Pulpe.dependencies` |
| Build settings | `settings.base` or `targets.X.settings.base` |

### Adding New Files

1. Create the `.swift` file in the correct folder
2. Run `xcodegen generate` - file is auto-detected
3. No manual "Add to target" needed

## Commands

```bash
xcodegen generate                        # Regenerate Xcode project (required after git pull)
xcodebuild build -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO
xcodebuild build -scheme PulpePreview -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO
xcodebuild build -scheme PulpeProd -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO
cd .. && pnpm dev:backend                # Run backend
```

## Versioning

| Variable                  | Usage              | Quand incrémenter            |
| ------------------------- | ------------------ | ---------------------------- |
| `MARKETING_VERSION`       | App Store (1.0.0)  | Nouvelle release utilisateur |
| `CURRENT_PROJECT_VERSION` | Build (1, 2, 3...) | Chaque upload TestFlight     |

```bash
./scripts/bump-version.sh patch     # 1.0.0 → 1.0.1 (reset build to 1)
./scripts/bump-version.sh build     # build 1 → 2
```

## Architecture

| Layer    | Location    | Purpose                           |
| -------- | ----------- | --------------------------------- |
| App      | `App/`      | Entry point, AppState             |
| Core     | `Core/`     | Services (actors), infrastructure |
| Domain   | `Domain/`   | Models, business logic            |
| Features | `Features/` | Views + ViewModels                |
| Shared   | `Shared/`   | Reusable components               |

## Key Patterns

| Pattern     | Implementation                                     |
| ----------- | -------------------------------------------------- |
| State       | `@Observable` + `.environment()` - no 3rd party    |
| Navigation  | `NavigationStack(path:)` with typed destinations   |
| Concurrency | **Actors** for services, all models are `Sendable` |
| Forms       | Sheet-based with completion callback               |

## Forbidden

| Action                    | Reason                                           |
| ------------------------- | ------------------------------------------------ |
| Add external dependencies | SPM only (Supabase + Lottie already added)       |
| Use `ObservableObject`    | iOS 17+ uses `@Observable` only                  |
| Store data locally        | Keychain for tokens only, API is source of truth |

## Business Vocabulary

| Code                      | French UI                        |
| ------------------------- | -------------------------------- |
| `expense`                 | Dépense                          |
| `income`                  | Revenu                           |
| `saving`                  | Épargne                          |
| `BudgetLine`              | Catégorie / Ligne budgétaire     |
| `Transaction` (allocated) | Transaction liée à une catégorie |

## Currency

```swift
amount.asCHF        // "CHF 1'234.56"
amount.asCompactCHF // "CHF 1'235"
```
