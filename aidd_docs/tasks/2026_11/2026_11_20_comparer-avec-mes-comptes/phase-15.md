---
status: pending
---

# Instruction: Android: step 2, suggestions, gaps below and matched

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── android/src/
    ├── core/api/
    │   └── endpoints.ts ✏️
    ├── core/i18n/catalogs/
    │   ├── fr.json ✏️
    │   ├── en.json ✏️
    │   ├── de.json ✏️
    │   └── it.json ✏️
    └── features/current-month/
        ├── reconciliation.ts ✏️
        ├── reconciliation.spec.ts ✏️
        ├── reconciliation-api.ts ✅
        ├── reconciliation-queries.ts ✅
        ├── reconciliation-queries.spec.ts ✅
        └── components/
            ├── reconcile-compare-step.tsx ✅
            ├── reconcile-compare-step.spec.tsx ✅
            ├── reconcile-accounts-sheet.tsx ✏️
            └── reconcile-accounts-sheet.spec.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Same data as phase 7, backend phases 3-4 reachable from the device | Step 1 ready | system |
| Happy path | Type 950, « Comparer » | Verdict title; Assurance « Prévue ce mois », Essence, Pharmacie « Mois dernier » | system |
| Happy path | Check Essence then Pharmacie | Partial bar, then matched; completion sent once | system |
| Edge case | 2.40 left after « Aucune dépense ne correspond » | Small gap, « Disponible : 900.00 → 897.60 » | system |
| Edge case | 120.00 left | Large gap; one « Écart avec mes comptes » entry with the same id on retry | system |
| Edge case | Context request fails | Error with [Réessayer], nothing written; back keeps the typed amounts | system |
| Teardown | Delete the entry, uncheck the items | Demo month back to setup | system |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) ←  Comparer avec mes comptes ? │
│ (2) Étape 2 sur 2                │
│     Tes comptes ont 100.00 de    │
│     moins que Pulpe              │
│ ┌──────────────────────────────┐ │
│ │ (3) Sur tes comptes   950.00 │ │
│ │ Dans Pulpe, déjà coché 1 050.00│
│ │ (4) ▓▓▓▓░░ 60.00 trouvés     │ │
│ └──────────────────────────────┘ │
│ (5) Coche les dépenses que tu…   │
│ ┌──────────────────────────────┐ │
│ │ (6) ☐ Assurance       100.00 │ │
│ │       Prévue ce mois         │ │
│ └──────────────────────────────┘ │
│ (7) Voir les 42 autres à cocher  │
│ (8) [ Aucune dépense ne corr. ]  │
│     Laisser comme ça             │
└──────────────────────────────────┘
```

1. Back to step 1, title, « ? ».
2. Step label and verdict title.
3. The two figures, old Pulpe figure struck through after a check.
4. Progress bar after a check.
5. Lead sentence, card wording with a « Je dois » row.
6. Up to 3 suggestions, 64dp rows.
7. Opens the to-point page.
8. Dismiss, then leave as is.

## Tasks to do

### `1)` Context query

> Android reads the server context and records completion.

1. Endpoints in `endpoints.ts`, `reconciliation-api.ts` validated by the shared schemas, `reconciliation-queries.ts` (TanStack Query, invalidated after a check).

### `2)` Compare step

> Step 2 of spec.md §4.1-4.3 with suggestions from every source.

1. `reconcile-compare-step.tsx` driven by `comparisonScreen`, `comparedFigure` and `rankedPointingCandidates` with prior items; checks movements and budget lines of any of the three months.
2. Step 2 waits for the context query; a failure shows the error of spec.md §4.1 with [Réessayer] and offers no write.
3. Amounts with `fontVariant: ["tabular-nums"]` and `numberOfLines={1}`, spec.md §5.

### `3)` Gaps below, matched, completion

> One entry or nothing; the matched screen explains the rest.

1. Small and large gap screens; `reconciliation.ts` names the entry « Écart avec mes comptes » (`verdict.defaultLabel` replaced).
2. Matched screen with `matchedBreakdown`; completion sent once per comparison; old step 2 « realized » and step 3 removed from the sheet.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Queries spec: parses a context, invalidates after a check |
| 2 | Compare step spec: candidate order and partial numbers of the happy path; a failed context shows the error and no write button |
| 3 | Sheet spec: one write with a stable id, completion once; `pnpm quality` and `pnpm test` pass in `android/` |
