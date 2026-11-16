---
status: done
---

# Instruction: Contrat analytics partagé

## Architecture projection

```txt
.
├── shared/
│   └── src/
│       └── feature-flags.ts ✏️
└── ios/
    ├── Pulpe/
    │   └── Core/
    │       └── Analytics/
    │           └── AnalyticsEvent.swift ✏️
    └── PulpeTests/
        └── Core/
            └── Analytics/
                └── AnalyticsServiceTests.swift ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `pnpm build:shared` | `ANALYTICS_EVENTS` exporte les trois nouveaux noms | cli |
| Happy path | Grep `net_worth_intro_` dans `shared/` et `ios/` | Les trois noms identiques des deux côtés | cli |
| Edge case | Test de parité iOS `AnalyticsServiceTests` (ensemble exact des raw values) | Passe avec les trois nouvelles valeurs | cli |

## Tasks to do

### `1)` Déclarer les événements dans `ANALYTICS_EVENTS`

> Contrat unique, lu par le web et Android.

1. Ajouter, après `SAVINGS_GOALS_INTRO_SKIPPED`, `NET_WORTH_INTRO_VIEWED: 'net_worth_intro_viewed'`, `NET_WORTH_INTRO_COMPLETED: 'net_worth_intro_completed'`, `NET_WORTH_INTRO_SKIPPED: 'net_worth_intro_skipped'`.
2. JSDoc : `viewed` à l'ouverture, puis exactement un `completed` (bouton final) ou `skipped` (fermeture avant la fin). Propriétés : `source` (`auto` | `help`) sur les trois ; `step` (0, 1, 2) sur `skipped` ; `action` (`add_asset` | `close`) sur `completed`.

### `2)` Miroir iOS

> iOS n'importe pas le TS.

1. Ajouter `netWorthIntroViewed`, `netWorthIntroCompleted`, `netWorthIntroSkipped` dans `AnalyticsEvent.swift`, à côté des cas `savingsGoalsIntro*`, avec la même doc courte.
2. Ajouter les trois raw values à l'ensemble attendu de `AnalyticsServiceTests.swift` (lignes 35-71, à côté de `savings_goals_intro_*`).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED` compile côté web et Android après `pnpm build:shared` |
| 2 | Les raw values Swift sont égales aux chaînes TS et `AnalyticsServiceTests` passe |
