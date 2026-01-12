# CLAUDE.md - Pulpe iOS

## Commands

```bash
# Generate Xcode project (required after modifying project.yml)
xcodegen generate

# Build
xcodebuild -scheme Pulpe -sdk iphonesimulator build

# Run backend (from ios/ parent directory)
cd .. && pnpm dev:backend
```

## Architecture Rules

| Layer | Location | Rule |
|-------|----------|------|
| App | `App/` | Entry point, AppState only - NO business logic |
| Core | `Core/` | Services are **actors** (thread-safe), infrastructure only |
| Domain | `Domain/` | Models are `Sendable`, services wrap APIClient |
| Features | `Features/` | Views + ViewModels, use sheets for forms |
| Shared | `Shared/` | Reusable components, extensions, formatters |

## Key Patterns

| Pattern | Implementation |
|---------|----------------|
| State | `@Observable` + `.environment()` - no 3rd party |
| Navigation | `NavigationStack(path:)` with typed destinations |
| Concurrency | **Actors** for services, all models are `Sendable` |
| Forms | Sheet-based with completion callback |
| Dependency | Constructor injection with `.shared` defaults |

## Forbidden

| Action | Reason |
|--------|--------|
| Add external dependencies | SPM only (Supabase + Lottie already added) |
| Use `ObservableObject` | iOS 17+ uses `@Observable` only |
| Store data locally | Keychain for tokens only, API is source of truth |
| Mix UI in Domain layer | Keep Domain pure (models, services, formulas) |

## Business Vocabulary

| Code | French UI |
|------|-----------|
| `expense` | Dépense |
| `income` | Revenu |
| `saving` | Épargne |
| `BudgetLine` | Catégorie / Ligne budgétaire |
| `Transaction` (allocated) | Transaction liée à une catégorie |
| `Transaction` (free) | Transaction libre |
| `checkedAt != nil` | Transaction comptabilisée |

## Critical Files

| Purpose | Path |
|---------|------|
| Global state machine | `App/AppState.swift` |
| API contract | `Core/Network/Endpoints.swift` |
| Business logic | `Domain/Formulas/BudgetFormulas.swift` |
| Auth + biometric | `Core/Auth/AuthService.swift` |
| Runtime config | `Core/Config/AppConfiguration.swift` |

## Currency & Formatting

All amounts are `Decimal`. Use extensions:

```swift
amount.asCHF        // "CHF 1'234.56"
amount.asCompactCHF // "CHF 1'235" (whole numbers only)
```

## API Configuration

| Build | API Base URL |
|-------|--------------|
| Debug | `http://localhost:3000/api/v1` |
| Release | Production Railway URL |

Backend must be running for the app to work (no offline mode).
