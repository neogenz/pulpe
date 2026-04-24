# CLAUDE.md - Pulpe iOS

## XcodeGen

**`project.yml` single source of truth.** `.xcodeproj` generated, gitignored.
**NEVER edit settings in Xcode UI** — changes lost on next `xcodegen generate`.

## Commands

```bash
# After git pull / clone
xcodegen generate
xcode-build-server config -scheme PulpeLocal -project Pulpe.xcodeproj  # SourceKit LSP (once)

# Build (replace scheme: PulpeLocal | PulpePreview | PulpeProd)
xcodebuild build -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO

# Unit tests → PulpeLocal scheme, target PulpeTests
xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' -only-testing:PulpeTests/SomeTest CODE_SIGNING_ALLOWED=NO
# UI tests → PulpeUITests scheme (NEVER use PulpeLocal for UI tests)
xcodebuild test -scheme PulpeUITests -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' -only-testing:PulpeUITests/SomeTest CODE_SIGNING_ALLOWED=NO

# Versioning
./scripts/bump-version.sh patch   # 1.0.0 → 1.0.1 (resets build to 1)
./scripts/bump-version.sh build   # build 1 → 2
```

## Shared Components — Check Before Building

**BEFORE creating/editing any sheet/form/view, MUST check `Shared/Components/` and `Shared/Extensions/`.** Never hand-roll UI shared component provide. Pattern repeat 2+ places → enrich shared component, never copy-paste.

| Need | Use this | NOT this |
|------|----------|----------|
| Sheet form wrapper | `SheetFormContainer` | Manual `NavigationStack > ScrollView > VStack` |
| Amount input | `HeroAmountField` | Custom TextField + display amount logic |
| Preset amounts | `QuickAmountChips` | Custom chip buttons |
| Kind picker | `KindToggle` | Custom HStack of buttons for expense/income/saving |
| Description field | `FormTextField(hint:text:label:accessibilityLabel:)` | Manual VStack + Text + FormTextField + overlay |
| Checked toggle | `CheckedToggle` | Custom Toggle |
| Error display | `ErrorBanner` | Custom error HStack |
| Currency formatting | `Decimal.asCHF` / `.asCompactCHF` | Manual string concatenation |
| Sheet presentation | `.standardSheetPresentation()` | Manual `.presentationDetents` + `.presentationBackground` |
| List row styling | `.listRowCustomStyled()` | `.listRowBackground` + `.listRowInsets` + `.listRowSeparator` |
| Background | `.pulpeBackground()` / `.pulpeCardBackground()` | Manual `.background(Color.surface)` |

**Form sheet checklist:**
- [ ] Use `SheetFormContainer`
- [ ] Description field use `FormTextField(label:accessibilityLabel:)` — never manual VStack wrapper
- [ ] Submit button use `.primaryButtonStyle(isEnabled:)`
- [ ] Success path: `submitSuccessTrigger.toggle()` + `toastManager.show(...)` + `dismiss()`
- [ ] `.sensoryFeedback(.success, trigger: submitSuccessTrigger)` on form

## iOS-Specific Vocabulary

| Code | French UI |
|---|---|
| `BudgetLine` | Catégorie / Ligne budgétaire |
| `Transaction` (allocated) | Transaction liée à une catégorie |

*(General vocab — expense/income/saving — in root CLAUDE.md)*