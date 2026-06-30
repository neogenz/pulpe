# iOS Developer Memory

## Gotchas

### foregroundStyle with custom Color extensions
When using `foregroundStyle()` with custom `Color` static members (e.g., `.financialSavings`), Swift resolves the type as `ShapeStyle` — not `Color`. The compiler error is `type 'ShapeStyle' has no member 'financialSavings'`. Fix: qualify explicitly as `Color.financialSavings`. The shorthand `.financialSavings` works in contexts where the type is already `Color` (ternary expressions, `Color`-typed properties, `.fill()` on shapes).

## Build / Lint / Env

- [SwiftLint file_length thresholds](reference_swiftlint_file_length_thresholds.md) — global file_length is 500/800, NOT 350; the 350-LOC cap is BudgetDetails-only. Don't over-refactor.
- [iOS build/test env](reference_ios_build_test_env.md) — sim runtime is iOS 26.5 not 26.2; xcodegen regen can corrupt DerivedData → trash it to fix phantom build errors.
