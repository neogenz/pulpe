---
status: pending
---

# Instruction: Web — réglage « Compte par défaut », menu et badge

## Architecture projection

```txt
.
└── frontend/projects/webapp/
    ├── public/i18n/
    │   ├── fr.json ✏️
    │   ├── en.json ✏️
    │   ├── de.json ✏️
    │   └── it.json ✏️
    └── src/app/
        ├── core/user-settings/user-settings-store.ts ✏️
        └── feature/
            ├── settings/
            │   ├── settings-page.ts ✏️
            │   └── settings-page.spec.ts ✏️
            └── net-worth/
                ├── net-worth-page.ts ✏️
                ├── net-worth-page.spec.ts ✏️
                └── components/
                    ├── net-worth-asset-row.ts ✏️
                    └── net-worth-asset-row.spec.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag allumé, jeu d'essai, Compte courant par défaut | badge « Par défaut » sur Compte courant | browser |
| Happy path | Menu de Revolut → « Utiliser par défaut dans le budget » (CA47) | badge sur Revolut, Réglages affichent Revolut sans recharger, nouveaux formulaires préremplis Revolut | browser |
| Happy path | Réglages → « Compte par défaut » sur Livret puis « Aucun » (CA28, CA34) | badge suit ; formulaires sur « Aucun » | browser |
| Edge case  | Menu de l'élément par défaut → « Ne plus utiliser par défaut » (CA47) | réglage « Aucun », badge retiré | browser |
| Edge case  | Archiver ou supprimer le compte par défaut (CA35) | réglage et badge à « Aucun » | browser |
| Edge case  | Flag éteint ou aucun élément actif (CA28) | réglage absent des Réglages, menu sans l'entrée | browser |
| Edge case  | Élément archivé | menu sans « Utiliser par défaut » | browser |
| Teardown   | Specs isolées | état initial | system |

## Wireframe

```txt
┌─────────────────────────────────────────────┐
│ (1) Réglages · Budget                        │
│     Compte par défaut              [Aucun ▾] │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ (2) Compte courant  [Par défaut]  5 000  [⋮] │
│ (3) Menu : Modifier                          │
│            Utiliser par défaut dans le budget│
│            Archiver · Supprimer              │
└─────────────────────────────────────────────┘
```

1. Section des Réglages : le sélecteur de compte avec le libellé « Compte par défaut », absent flag éteint ou sans élément actif.
2. Ligne d'un élément de « Mon patrimoine » avec le badge du compte par défaut.
3. Menu de la ligne : « Utiliser par défaut dans le budget », ou « Ne plus utiliser par défaut » sur le compte par défaut.

## Tasks to do

### `1)` Store

1. `UserSettingsStore.setDefaultAccount(id | null)` via `updateSettings({ defaultAccountId })`.

### `2)` Réglages

1. Section « Compte par défaut » avec `AccountPickerField` (`labelKey`), visible si flag allumé et au moins un élément actif.

### `3)` Mon patrimoine

1. `NetWorthAssetRow` : input `isDefault`, badge « Par défaut », actions `setDefault` / `unsetDefault` (élément actif seulement).
2. `NetWorthPage` : `isDefault` depuis le store ; actions vers `setDefaultAccount` ; après archivage ou suppression, `UserSettingsStore.reload()`.
3. Libellés fr/en/de/it.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le store écrit `defaultAccountId` et expose la réponse aux deux écrans. |
| 2 | Spec : CA28 (visible, absent), choix écrit le réglage, CA34. |
| 3 | Specs : CA47 (badge, menu, préremplissage), CA33, CA35 ; `pnpm quality` vert. |
