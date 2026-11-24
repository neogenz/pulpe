---
status: pending
---

# Instruction: iOS — ligne d'un élément, feuille « Modifier », fin des propositions

## Architecture projection

```txt
.
└── ios/
    ├── Pulpe/Domain/Models/Asset.swift ✏️
    ├── Pulpe/Domain/Services/AssetService.swift ✏️
    ├── Pulpe/Domain/Store/AssetStore.swift ✏️
    ├── Pulpe/Features/NetWorth/NetWorthView.swift ✏️
    ├── Pulpe/Features/NetWorth/NetWorthSections.swift ✏️
    ├── Pulpe/Features/NetWorth/NetWorthAssetRow.swift ✏️
    ├── Pulpe/Features/NetWorth/NetWorthSuggestionRow.swift ❌
    ├── Pulpe/Features/NetWorth/AssetFormSheet.swift / AssetFormDraft.swift ✏️
    ├── Pulpe/Resources/Localizable.xcstrings ✏️
    └── PulpeTests/Features/NetWorth/… ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Livret `latestValue` 10 500, `recordedValue` 10 000, saisi le 3 novembre | page chargée | system |
| Happy path | Lire la ligne (CA9) | « +500.00 CHF depuis ta saisie du 3 novembre » | system |
| Happy path | Ouvrir « Modifier » (CA10) | champ 10 500 ; rappel 10 000 et sa date | system |
| Edge case  | Rien n'a bougé | ligne inchangée | system |
| Edge case  | Valider sans toucher la valeur | aucune photo envoyée | system |
| Edge case  | Revenir sur l'onglet après un pointage (CA12) | valeur à jour (`.task { forceRefresh }`) | system |

## Tasks to do

### `1)` Modèle

1. `Asset` décode `recordedValue` ; `suggestion` et `AssetSuggestion` disparaissent du modèle (le champ JSON est ignoré).

### `2)` Retirer la proposition

1. Supprimer `NetWorthSuggestionRow`, `visibleSuggestion`, `suggestionDetail`, l'appel `dismissSuggestion` (service, store, endpoint) et leurs chaînes.

### `3)` Ce qui a bougé et feuille « Modifier »

1. La ligne montre `{montant signé} depuis ta saisie du {date}` à la place de « Mis à jour … » quand `latestValue ≠ recordedValue`.
2. La feuille « Modifier » préremplit `latestValue` et rappelle « Ta dernière saisie : {montant}, le {date} » (`recordedValue`, `latestRecordedAt`) ; aucune photo si la valeur est inchangée.
3. Chaînes fr/en/de/it dans le catalogue.

### `4)` Rapprochement (CA13)

1. Sous un compte suivi (`ReconcileAccountsSheet+AccountLink.swift`), l'indication donne la valeur à jour de l'élément (`latestValue`, devise de l'élément) : « Mis à jour dans Mon patrimoine, où il vaut aujourd'hui {montant}. » (voir questions.md Q1).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Un JSON avec `recordedValue` et `suggestion: null` se décode. |
| 2 | CA8 : plus aucune vue ni chaîne de proposition. |
| 3 | CA9, CA10 prouvés par des tests de la logique d'affichage (delta, rappel, absence de photo). |
| 4 | CA13 : l'indication sous un compte suivi affiche 10 500.00 CHF après CA1. |
