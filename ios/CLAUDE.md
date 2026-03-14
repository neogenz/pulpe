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
xcode-build-server config -scheme PulpeLocal -project Pulpe.xcodeproj  # SourceKit LSP (once)

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

## Shared Components — Check Before Building

**BEFORE creating or editing any sheet/form/view, you MUST check `Shared/Components/` and `Shared/Extensions/` for existing reusable components.** Never hand-roll UI that a shared component already provides.

| Need | Use this | NOT this |
|------|----------|----------|
| Sheet form wrapper | `SheetFormContainer` | Manual `NavigationStack > ScrollView > VStack` |
| Amount input | `HeroAmountField` | Custom TextField + display amount logic |
| Preset amounts | `QuickAmountChips` | Custom chip buttons |
| Kind picker | `KindToggle` | Custom HStack of buttons for expense/income/saving |
| Checked toggle | `CheckedToggle` | Custom Toggle |
| Error display | `ErrorBanner` | Custom error HStack |
| Currency formatting | `Decimal.asCHF` / `.asCompactCHF` | Manual string concatenation |
| Sheet presentation | `.standardSheetPresentation()` | Manual `.presentationDetents` + `.presentationBackground` |
| List row styling | `.listRowCustomStyled()` | `.listRowBackground` + `.listRowInsets` + `.listRowSeparator` |
| Background | `.pulpeBackground()` / `.pulpeCardBackground()` | Manual `.background(Color.surface)` |

**Consistency checklist for form sheets:**
- [ ] Uses `SheetFormContainer` (provides: nav title, close button, keyboard toolbar, auto-focus, loading overlay, sheet presentation)
- [ ] Description field has label ("Description") + overlay border + accessibility label
- [ ] Submit button uses `.primaryButtonStyle(isEnabled:)`
- [ ] Success path: `submitSuccessTrigger.toggle()` + `toastManager.show(...)` + `dismiss()`
- [ ] `.sensoryFeedback(.success, trigger: submitSuccessTrigger)` on the form

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
