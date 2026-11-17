---
status: done
---

# Instruction: Hero figure and verdict copy

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── core/
        │   ├── i18n/
        │   │   └── catalogs/
        │   │       ├── fr.json ✏️
        │   │       ├── en.json ✏️
        │   │       ├── de.json ✏️
        │   │       └── it.json ✏️
        │   └── ui/
        │       ├── amount-format.ts ✏️
        │       ├── amount-format.spec.ts ✏️
        │       └── hero.tsx ✏️
        └── features/
            └── current-month/
                ├── home-hero-presentation.spec.ts ✏️
                └── components/
                    ├── home-hero-card.tsx ✏️
                    └── home-hero-card.spec.tsx ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | run from `android/`, Jest with the real i18n catalogs | suites load | cli |
| Happy path | format 4414.34 CHF for the hero | `4’414.34` | cli |
| Happy path | dated gain verdict in fr, en, de, it | the iOS sentence of each locale | cli |
| Edge case  | whole value 1960 and one-decimal value 1960.5 | `1’960` and `1’960.50`, never one decimal | cli |
| Edge case  | amounts hidden | mask `•••`, no figure in the a11y label | cli |
| Edge case  | no drift date | undated sentence unchanged | cli |

## Tasks to do

### `1)` Adaptive amount formatters

> The hero figure shows centimes only when the value has some.

1. In `android/src/core/ui/amount-format.ts` add `formatAdaptiveAmount(value, currency)` (no symbol) and `formatAdaptiveCurrency(value, currency)` (with symbol): `hasCents(value)` picks `FULL_DIGITS`, else `WHOLE_DIGITS`; both return the mask when amounts are hidden.
2. Make `formatSignedAdaptiveCurrency` reuse `formatAdaptiveCurrency` instead of repeating the digits choice.
3. Cover both in `amount-format.spec.ts`: whole, two decimals, one decimal padded to two, masked.

### `2)` Verdict copy from iOS

> The dated verdict says what the user does, as on iOS.

1. In the four catalogs, `home.hero.verdict`: `gainDated` and `overrunDated` take the iOS strings (`Tu dépenses moins que prévu depuis le %{date}.`, `Tu dépenses plus que prévu depuis le %{date}.`, and the en, de, it values of the same keys in `ios/Pulpe/Resources/Localizable.xcstrings`); `onPlan` in en, de, it takes the iOS value of `Tu es pile sur ton plan.`.
2. Update the expected sentences in `home-hero-presentation.spec.ts` (the `dates the drift in %s` table).

### `3)` Verdict in the accent, pace in the support ink

> Only the verdict carries the accent; the pace sentence after it is quieter.

1. In `android/src/core/ui/hero.tsx`, give `HeroVerdict` two optional props: `strong?: boolean` renders the sentence semibold (weight 600), `tail?: string` follows it after a space as a nested `Text` in `hero.support` at regular weight. With neither, the output is unchanged (two other callers: `budgets.tsx`, `net-worth-hero.tsx`).
2. In `home-hero-card.tsx`, pass the verdict as `sentence` with `strong` always set (iOS keeps it semibold with or without a pace sentence), and the pace sentence (or the fresh-start tail) as `tail` instead of joining them.

### `4)` Adaptive hero figure

> The figure and its a11y label print `4’414.34`, not `4’414`.

1. In `home-hero-card.tsx`, replace `formatCompactAmount` with `formatAdaptiveAmount` for the figure and its `accessibilityLabel`.
2. Update `home-hero-card.spec.tsx`: the figure keeps its centimes, verdict and tail are asserted apart.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `formatAdaptiveAmount(4414.34, "CHF")` is `4’414.34`, `formatAdaptiveAmount(1960, "CHF")` is `1’960`, `formatAdaptiveAmount(1960.5, "CHF")` is `1’960.50`, masked values return `•••` |
| 2 | `verdictSentence` returns the iOS dated sentence in fr, en, de and it; the undated and on-plan fr sentences are unchanged |
| 3 | The hero renders the verdict and the tail as two runs, the verdict semibold in the accent (also when there is no tail), the tail in the support ink; `HeroVerdict` with neither prop renders as before |
| 4 | With an estimate of 1240.5 the hero prints `1’240.50`; masked, no figure is printed |
