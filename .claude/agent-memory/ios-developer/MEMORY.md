# iOS Developer Memory

## Gotchas

### foregroundStyle with custom Color extensions
When using `foregroundStyle()` with custom `Color` static members (e.g., `.financialSavings`), Swift resolves the type as `ShapeStyle` — not `Color`. The compiler error is `type 'ShapeStyle' has no member 'financialSavings'`. Fix: qualify explicitly as `Color.financialSavings`. The shorthand `.financialSavings` works in contexts where the type is already `Color` (ternary expressions, `Color`-typed properties, `.fill()` on shapes).
