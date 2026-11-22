---
status: pending
---

# Instruction: Android: step 1 and entry points

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── android/
    ├── .env.example ✏️
    └── src/
        ├── core/auth/
        │   └── session-store.ts ✏️
        ├── core/config/
        │   └── env.ts ✏️
        ├── core/observability/
        │   ├── feature-flags.ts ✏️
        │   └── feature-flags.spec.ts ✏️
        ├── core/i18n/catalogs/
        │   ├── fr.json ✏️
        │   ├── en.json ✏️
        │   ├── de.json ✏️
        │   └── it.json ✏️
        ├── features/budget-details/components/
        │   ├── budget-detail-overlays.tsx ✏️
        │   └── budget-detail-overlays.spec.tsx ✏️
        └── features/current-month/
            ├── reconcile-account-links.ts ✏️
            ├── reconcile-account-links.spec.ts ✏️
            ├── reconcile-linked-accounts.ts ✏️
            ├── reconcile-free-accounts.ts ✅
            ├── reconcile-free-accounts.spec.ts ✅
            ├── reconcile-draft-store.ts ✅
            ├── reconcile-draft-store.spec.ts ✅
            └── components/
                ├── reconcile-accounts-step.tsx ✅
                ├── reconcile-accounts-step.spec.tsx ✅
                ├── reconcile-add-account-sheet.tsx ✅
                ├── reconcile-add-account-sheet.spec.tsx ✅
                ├── reconcile-linked-account-row.tsx ✏️
                ├── reconcile-accounts-sheet.tsx ✏️
                ├── reconcile-accounts-sheet.spec.tsx ✏️
                └── to-point-page.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Demo user, guide seen, `EXPO_PUBLIC_DEV_FEATURE_FLAGS=net_worth` in `android/.env` (Metro restarted with `--clear`), one own account and one card debt in Mon patrimoine | Step 1 shows the followed accounts | system |
| Happy path | 3 000 on « Compte courant », new « Revolut » « J'ai » 1 000, card from Mon patrimoine 800 | « En tout 3 200.00 », « 4 000 − 800 que tu dois » | system |
| Happy path | App to background, vault auto-lock, unlock | Same rows and amounts | system |
| Happy path | Finish, open again | « Revolut » « J'ai » back, empty amount; not in Mon patrimoine | system |
| Edge case | No « Je dois » row | Card help and its button | system |
| Edge case | Account fed by a saving budget line this month | Absent from the add sheet | system |
| Edge case | Budget detail of a past and a future month | No comparison button | system |
| Edge case | `net_worth` off (variable removed, Metro restarted) | No Mon patrimoine block | system |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) ×  Comparer avec mes comptes ? │
│ (2) Étape 1 sur 2                │
│     Combien as-tu aujourd'hui ?  │
│ ┌──────────────────────────────┐ │
│ │ (3) Compte courant  J'ai   × │ │
│ │     CHF [ 3 000.00 ]         │ │
│ ├──────────────────────────────┤ │
│ │ (4) Revolut                × │ │
│ │     [ J'ai  |  Je dois ]     │ │
│ │     CHF [ 1 000.00 ]         │ │
│ └──────────────────────────────┘ │
│ (5) + Ajouter un compte          │
│ (6) card help + button           │
│ (7) En tout            4 000.00  │
│ (8) [          Comparer        ] │
└──────────────────────────────────┘
```

1. Close, title, « ? ».
2. Step label, title, sentence.
3. Mon patrimoine row: fixed side, amount, caption, remove.
4. Free row: `SegmentedButtons` for the side (44dp), amount, remove.
5. Opens the add sheet.
6. Card help while no « Je dois » row exists.
7. Total with the « que tu dois » line.
8. Goes to step 2.

## Tasks to do

### `1)` Accounts step

> Step 1 of spec.md §3 in its own component; the 786-line sheet keeps navigation only.

1. `reconcile-accounts-step.tsx`: rows, side control replacing « Solde négatif (découvert) », totals, card help; `reconcile-account-links.ts` stops planning creates.
2. Amounts with `fontVariant: ["tabular-nums"]` and `numberOfLines={1}`, spec.md §5.

### `2)` Add an account

> One sheet for new, owed and Mon patrimoine accounts.

1. `reconcile-add-account-sheet.tsx` with the sections and filters of spec.md §3; `reconcile-linked-accounts.ts` returns own and owe items.

### `3)` Device memory and draft

> Names come back next time; amounts survive background and auto-lock.

1. `reconcile-free-accounts.ts` on MMKV (names and sides only), cleared on sign-out through a step in `session-store.ts` cleanup.
2. `reconcile-draft-store.ts`: in-memory store keyed by budget, read back when the sheet remounts after the lock.

### `4)` Current month only, one name

> No button on past or future months; the feature has its new name.

1. `budget-detail-overlays.tsx` offers the comparison only when the budget is `useCurrentMonth().budgetId`.
2. Title « Comparer avec mes comptes » in the sheet; `home.toPoint.compare` label updated; 4 catalogs.

### `5)` Local flag override

> A local build can show the Mon patrimoine rows, as the web can with its dev override.

1. `env.ts` reads `EXPO_PUBLIC_DEV_FEATURE_FLAGS` (comma-separated keys), kept only when the environment is `local`; `useFeatureFlag` returns true for a listed key; `.env.example` documents it.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Step spec: totals with « Je dois », remove leaves Mon patrimoine untouched, no create planned |
| 2 | Add sheet spec: filters with `useFeatureFlag` mocked on, block absent with it off |
| 3 | Free accounts and draft specs: names restored without amounts; draft restored after remount |
| 4 | Overlays spec: button only for the current budget; `pnpm quality` and `pnpm test` pass in `android/` |
| 5 | Feature flags spec: a listed key is on in `local`, ignored in `preview` and `production` |
