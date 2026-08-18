# iOS Developer Memory

## Gotchas

### foregroundStyle with custom Color extensions

When using `foregroundStyle()` with custom `Color` static members (e.g., `.financialSavings`), Swift resolves the type as `ShapeStyle` — not `Color`. The compiler error is `type 'ShapeStyle' has no member 'financialSavings'`. Fix: qualify explicitly as `Color.financialSavings`. The shorthand `.financialSavings` works in contexts where the type is already `Color` (ternary expressions, `Color`-typed properties, `.fill()` on shapes).

## Localization

- [xcstrings probe decides auto-localization](reference_xcstrings_probe_decides_autolocalization.md) — the catalog answers "wrap or leave?"; literal ternaries auto-localize, `"a" + "b"` does not

## UI tests

- [Identifier placement in UI tests](feedback_uitest_identifier_placement.md) — container/Button/tap traps when swapping display literals for identifiers
- [Harness locale split](reference_uitest_harness_locale_split.md) — app copy follows AppLocale, system controls follow the simulator language

## Build / Lint

- [SwiftLint file_length thresholds](reference_swiftlint_file_length_thresholds.md) — global file_length is 500/800, NOT 350; the 350-LOC cap is BudgetDetails-only. Don't over-refactor.
- [Xcode build cache recovery](reference_ios_build_test_env.md) — recognize stale build-graph failures after project regeneration and clear only Pulpe's DerivedData.
