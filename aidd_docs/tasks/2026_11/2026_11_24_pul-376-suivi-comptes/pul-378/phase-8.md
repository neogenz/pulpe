---
status: pending
---

# Instruction: iOS — réglage « Compte par défaut », menu et badge

## Architecture projection

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Domain/Models/UserSettings.swift ✏️
    │   ├── Domain/Store/UserSettingsStore.swift ✏️
    │   ├── Features/Account/PreferencesView.swift ✏️
    │   ├── Features/NetWorth/NetWorthAssetRow.swift ✏️
    │   ├── Features/NetWorth/NetWorthView.swift ✏️
    │   └── Resources/Localizable.xcstrings ✏️
    └── PulpeTests/
        ├── Domain/Store/UserSettingsStoreTests.swift ✏️
        └── Features/NetWorth/NetWorthDefaultAccountTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Simulateur, flag allumé, Compte courant par défaut | badge « Par défaut » sur Compte courant | system |
| Happy path | Menu de Revolut → « Utiliser par défaut dans le budget » (CA47) | badge sur Revolut, Préférences affichent Revolut, nouvelles saisies préremplies | system |
| Happy path | Compte → Préférences → « Compte par défaut » Livret puis « Aucun » (CA28, CA34) | badge suit, saisies sur « Aucun » | system |
| Edge case  | « Ne plus utiliser par défaut » sur le compte par défaut | réglage « Aucun » | system |
| Edge case  | Archiver ou supprimer le compte par défaut (CA35) | réglage à « Aucun » après rechargement | system |
| Edge case  | Flag éteint ou aucun élément actif | ligne de préférence et entrée de menu absentes | system |
| Teardown   | Tests unitaires sans état partagé | état initial | system |

## Wireframe

```txt
┌────────────────────────────────────────┐
│ (1) Préférences · Mon budget            │
│     Compte par défaut          Aucun ›  │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ (2) Revolut  [Par défaut]     400  (⋯)  │
│ (3) Menu : Modifier                     │
│            Utiliser par défaut          │
│            Archiver · Supprimer         │
└────────────────────────────────────────┘
```

1. Ligne de `PreferencesView` avec `AccountPickerField` titré « Compte par défaut ».
2. `NetWorthAssetRow` avec la puce « Par défaut ».
3. Menu de la ligne, entrée inversée sur le compte par défaut.

## Tasks to do

### `1)` Réglage

1. `UpdateUserSettings.defaultAccountId: String??` ; `UserSettingsStore.setDefaultAccount(_:)`.
2. `PreferencesView` : ligne « Compte par défaut », absente flag éteint ou sans élément actif.

### `2)` Mon patrimoine

1. `NetWorthAssetActions` : `setDefault`, `unsetDefault` ; puce « Par défaut » ; entrée réservée aux éléments actifs.
2. `NetWorthView` : relie au store ; recharge les réglages après archivage ou suppression (CA35).
3. Chaînes FR et traductions.

### `3)` Contrôles avant la pull request

1. Racine : `pnpm quality`, `pnpm test`.
2. `backend-nest` : `bun run quality`, `bun test`, boucle `psql` des suites SQL (`supabase/tests/README.md`).
3. `android` : `pnpm quality`.
4. `ios` : `xcodegen generate --use-cache`, `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=Pulpe Tests' CODE_SIGNING_ALLOWED=NO`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `UserSettingsStoreTests` : écrire, retirer, lire le même réglage. |
| 2 | `NetWorthDefaultAccountTests` : CA47 (badge, libellé du menu), CA35, CA28 (absent flag éteint). |
| 3 | Toutes les commandes passent. |
