# CLAUDE.md - Pulpe iOS

## XcodeGen

`project.yml` is the single source of truth; `.xcodeproj` is generated and gitignored.
**NEVER edit build settings in the Xcode UI** — lost on the next generate.
**ALWAYS `xcodegen generate --use-cache`.** Without the flag every run rewrites `project.pbxproj`, invalidates Xcode's incremental cache, and the next build is a full rebuild (~3-5 min here).

## Commands

```bash
# After git pull / clone (idempotent)
xcodegen generate --use-cache
xcode-build-server config -scheme PulpeLocal -project Pulpe.xcodeproj  # SourceKit LSP (once)

# Build — schemes: PulpeLocal | PulpePreview | PulpeProd
xcodebuild build -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' CODE_SIGNING_ALLOWED=NO

# Tests — always the dedicated 'Pulpe Tests' simulator, never the booted one (a run steals
# the device). No ,OS= pin, so the destination resolves against the installed runtime.
xcodebuild test -scheme PulpeLocal   -destination 'platform=iOS Simulator,name=Pulpe Tests' -only-testing:PulpeTests/SomeTest   CODE_SIGNING_ALLOWED=NO
xcodebuild test -scheme PulpeUITests -destination 'platform=iOS Simulator,name=Pulpe Tests' -only-testing:PulpeUITests/SomeTest CODE_SIGNING_ALLOWED=NO
# UI tests need the PulpeUITests scheme — never PulpeLocal.
# `-only-testing:` on a Swift Testing suite can select zero tests and still print
# TEST SUCCEEDED. Read the executed count before believing a green run.

# Versioning
./scripts/bump-version.sh patch   # 1.0.0 → 1.0.1 (resets build to 1)
./scripts/bump-version.sh build   # build 1 → 2
```

## Shared Components — Check Before Building

**BEFORE creating/editing any sheet/form/view, check `Shared/Components/` and `Shared/Extensions/`.** Never hand-roll what a shared component already provides. Third identical use → enrich the shared component, never copy-paste.

| Need | Use this | NOT this |
|------|----------|----------|
| Sheet form wrapper | `SheetFormContainer` | Manual `NavigationStack > ScrollView > VStack` |
| Amount input | `HeroAmountField` | Custom TextField + display amount logic |
| Preset amounts | `QuickAmountChips` | Custom chip buttons |
| Kind picker | `KindToggle` | Custom HStack of buttons for expense/income/saving |
| Description field | `FormTextField(hint:text:label:accessibilityLabel:focusBinding:field:)` — the last two are required | Manual VStack + Text + FormTextField + overlay |
| Checked toggle | `CheckedToggle` | Custom Toggle |
| Error display | `ErrorBanner` | Custom error HStack |
| Currency formatting | `Decimal.asCurrency(_:)` / `.asCompactCurrency(_:)` | Manual string concatenation, or the `asCHF` shims — the app is multi-currency |
| Sheet presentation | `.standardSheetPresentation()` | Manual `.presentationDetents` + `.presentationBackground` |
| List row styling | `.listRowCustomStyled()` | `.listRowBackground` + `.listRowInsets` + `.listRowSeparator` |
| Background | `.pulpeBackground()` / `.pulpeCardBackground()` | Manual `.background(Color.surface)` |

**Form sheet checklist:**
- [ ] Submit button uses `.primaryButtonStyle(isEnabled:)`
- [ ] Success path: `submitSuccessTrigger.toggle()` + `toastManager.show(...)` + `dismiss()`
- [ ] `.sensoryFeedback(.success, trigger: submitSuccessTrigger)` on the form

## Vocabulary

Root `CLAUDE.md § Vocabulary` is the only list. `BudgetLine` reads "prévision" in the UI, never "catégorie" — that word appears nowhere in the Swift sources.
