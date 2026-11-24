---
status: pending
---

# Instruction: Web — ligne d'un élément, feuille « Modifier », fin des propositions

## Architecture projection

```txt
.
└── frontend/projects/webapp/
    ├── public/i18n/{fr,en,de,it}.json ✏️
    └── src/app/
        ├── core/asset/asset-api.ts ✏️ (+ spec)
        └── feature/net-worth/
            ├── net-worth-page.ts ✏️ (+ spec)
            ├── services/net-worth-store.ts ✏️ (+ spec)
            └── components/
                ├── net-worth-asset-row.ts ✏️ (+ spec)
                ├── asset-form-dialog.ts ✏️ (+ spec)
                └── asset-form-dialog.schema.ts ✏️ (+ spec)
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Livret `latestValue` 10 500, `recordedValue` 10 000, saisi le 3 novembre | page chargée | browser |
| Happy path | Lire la ligne du Livret (CA9) | « +500.00 CHF depuis ta saisie du 3 novembre » sous le nom | browser |
| Happy path | Ouvrir « Modifier » (CA10) | champ à 10 500 ; « Ta dernière saisie : 10 000.00 CHF, le 3 novembre 2026 » | browser |
| Edge case  | `latestValue` = `recordedValue` (CA9) | « Mis à jour … » comme aujourd'hui, aucune mention de delta | browser |
| Edge case  | Valider « Modifier » sans toucher la valeur | aucune photo envoyée | browser |
| Edge case  | N'importe quel état (CA8) | ni « Je propose », ni « Appliquer », ni « Écarter » | browser |
| Edge case  | Pointer depuis le budget puis ouvrir la page (CA12) | valeur à jour sans recharger | browser |

## Tasks to do

### `1)` Retirer la proposition

1. Supprimer le bloc `asset-suggestion`, les actions `applySuggestion` / `dismissSuggestion` (ligne, page, store, `AssetApi.dismissSuggestion$`) et les clés `netWorth.suggestion.*` des 4 langues.

### `2)` Ce qui a bougé depuis la dernière saisie

1. La ligne lit `latestValue − recordedValue` en centimes ; non nul → la mention remplace « Mis à jour … » : `{{amount}} depuis ta saisie du {{date}}` (montant signé, devise de l'élément), avec le préfixe de type pour une dette comme `updatedDebt`.
2. Nul → la ligne reste comme aujourd'hui.

### `3)` Feuille « Modifier »

1. Champ prérempli avec `latestValue` (déjà le cas) ; l'indication lit `recordedValue` et `latestRecordedAt` : « Ta dernière saisie : {{amount}}, le {{date}} ».
2. Une photo ne part que si la valeur tapée diffère de `latestValue` (déjà le cas, à couvrir par un test CA10).

### `4)` Fraîcheur (CA12)

1. Vérifier par un test que l'invalidation `['assets']` sur une mutation du budget (déjà dans `AssetApi`) reste en place.

### `5)` Rapprochement (CA13)

1. Sous un compte suivi (`reconcile-accounts-step.ts`), l'indication donne la valeur à jour de l'élément (`latestValue`, devise de l'élément) : « Mis à jour dans Mon patrimoine, où il vaut aujourd'hui {montant}. » (voir questions.md Q1).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | CA8 : aucun texte de proposition rendu, même si un payload portait encore `suggestion`. |
| 2 | CA9 : +500.00 et la date de la saisie rendus ; absents quand rien n'a bougé. |
| 3 | CA10 : champ à 10 500, rappel 10 000 et sa date. |
| 4 | CA12 : test de l'invalidation vert. |
| 5 | CA13 : l'indication sous un compte suivi affiche 10 500.00 CHF après CA1. |
