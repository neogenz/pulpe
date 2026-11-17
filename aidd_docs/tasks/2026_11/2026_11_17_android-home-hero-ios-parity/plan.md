---
objective: "The Android Accueil hero card draws the iOS burn-down trajectory, reads it under the finger like iOS, and prints the iOS verdict copy and adaptive decimals."
status: implemented
---

# Plan: Android home hero parity with iOS

Source: task brief « Make the Android Accueil hero card match the iOS one » (session hand-over, 2026-11-17), reference `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard*.swift`

## Phases

| #   | Phase                                   | File                         | Depends on |
| --- | --------------------------------------- | ---------------------------- | ---------- |
| 1   | Hero figure and verdict copy            | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Burn-down chart, scrub, spoken trajectory | [`phase-2.md`](./phase-2.md) | 1          |

## External sources

| URL  | What it settled |
| ---- | --------------- |
| none | none            |

## Impact

| Category      | Verdict and evidence | Handled in |
| ------------- | -------------------- | ---------- |
| runtime       | observed: the trajectory is computed on the device by `shared/src/calculators/balance-trajectory.ts` (`real`, `plannedAvailable`, `trendBalance` already exported); the drift history the iOS trend reads is already in the budget details response (`history`, `shared/schemas.ts` `budgetDetailsResponseSchema`) and is dropped by `current-month-view-model.ts` today; no API or schema change | 2 |
| regression    | medium: existing specs cover the pure parts (`balance-chart-scale.spec.ts`, `balance-scrub.spec.ts`, `home-hero-presentation.spec.ts`, `home-hero-card.spec.tsx`, `balance-trajectory-chart.spec.tsx`, `amount-format.spec.ts`, `phase4-home-hero-i18n.spec.ts`) but Skia and victory-native are mocked to `null` in Jest, so the drawing itself is unverified by tests; the device check is run by the orchestrating session after phase 2, outside this plan; no safety-net phase, the specs lock a behavior this plan replaces on purpose | 1, 2 |
| architecture  | low: the view model, the only layer that holds the server's drift history, now hands the hero a trajectory that carries its trend; helpers and components read it, none recomputes it | 2 |
| documentation | none: `android/DESIGN.md`, `DESIGN.md` and `docs/adr/` do not describe the hero chart model (grep `chart`, `trajector`, `burn-down`); the two « Unlike the iOS twin » code comments only cover where labels are printed; the one in `balance-chart-scale.ts` is rewritten with the port | 2 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `CLAUDE.md` Vocabulary: product copy is French, the word « transaction » never shows on screen (`pnpm test:lexicon`) | new and changed catalog strings |
| `CLAUDE.md` formula mirror: Android imports `shared/src/calculators/` directly | the trend comes from `trendBalance` in `pulpe-shared`, never a local copy |
| `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md` case 4: a balance that carries a verdict is adaptive, 0 or 2 decimals, never one | hero figure |
| Translations come from `ios/Pulpe/Resources/Localizable.xcstrings`, never invented | en, de, it strings must read as on iOS |
| Scope discipline (`CLAUDE.md`): hero card only, no follow-up list in code or docs | other Accueil gaps are reported, not fixed |
