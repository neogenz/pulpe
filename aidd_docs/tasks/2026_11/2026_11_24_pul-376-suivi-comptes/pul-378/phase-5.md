---
status: pending
---

# Instruction: Web — champ « Compte » dans les formulaires

## Architecture projection

```txt
.
├── android/src/features/current-month/
│   ├── reconciliation.ts ✏️
│   └── reconciliation.spec.ts ✏️
└── frontend/projects/webapp/
    ├── public/i18n/
    │   ├── fr.json ✏️
    │   ├── en.json ✏️
    │   ├── de.json ✏️
    │   └── it.json ✏️
    └── src/app/
        ├── core/user-settings/user-settings-store.ts ✏️
        ├── pattern/account-picker/
        │   ├── account-picker-field.ts ✅
        │   └── account-picker-field.spec.ts ✅
        └── feature/
            ├── current-month/
            │   ├── current-month.ts ✏️
            │   ├── current-month.spec.ts ✏️
            │   └── components/
            │       ├── add-transaction-form.ts ✏️
            │       ├── add-transaction-form.schema.ts ✏️
            │       └── add-transaction-form.spec.ts ✏️
            ├── budget/budget-details/
            │   ├── budget-line/create/dialog.ts ✏️
            │   ├── budget-line/create/dialog.spec.ts ✏️
            │   ├── budget-line/edit/dialog.ts ✏️
            │   ├── budget-line/edit/dialog.spec.ts ✏️
            │   ├── components/edit-transaction-form/edit-transaction-form.ts ✏️
            │   ├── components/edit-transaction-form/edit-transaction-form.schema.ts ✏️
            │   ├── components/edit-transaction-form/edit-transaction-form.spec.ts ✏️
            │   ├── store/budget-details-store.ts ✏️
            │   └── store/budget-details-store.spec.ts ✏️
            └── budget-templates/details/components/
                ├── edit-template-line-dialog.ts ✏️
                └── edit-template-line-dialog.spec.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag `net_worth` allumé, jeu d'essai du ticket, aucun compte par défaut | page budget ouverte | browser |
| Happy path | Ouvrir « Ajouter une prévision », un imprévu, une ligne de modèle (CA1, CA3) | « Compte » sur « Aucun », groupes « ce que j'ai » (3) et dettes (Leasing) | browser |
| Happy path | Compte courant par défaut, nouveau formulaire (CA29) | prérempli Compte courant, modifiable vers un autre ou « Aucun » | browser |
| Edge case  | Flag éteint ou aucun élément actif (CA2) | champ absent, payload `accountId: null` | browser |
| Edge case  | Réel rattaché, création ou modification (CA4) | aucun champ « Compte » | browser |
| Edge case  | Même élément en « Compte » et « Versée sur » (CA25) | message sous le champ, enregistrement bloqué | browser |
| Edge case  | Livret prérempli puis choisi dans « Versée sur » (CA45) | « Compte » repasse à « Aucun » | browser |
| Edge case  | Écart du rapprochement, web et Android (CA44) | payload `accountId: null` | browser |
| Edge case  | Supprimer une prévision avec compte et réels (CA46) | réels libérés affichés avec le compte de la prévision | browser |
| Teardown   | Specs isolées, aucune donnée persistée | état initial | system |

## Wireframe

```txt
┌──────────────────────────────────────────┐
│ (1) Nouvelle prévision                    │
│     Nom · Montant · Type                  │
├──────────────────────────────────────────┤
│ (2) Versée sur / Dette remboursée   [▾]   │
├──────────────────────────────────────────┤
│ (3) Compte                          [▾]   │
│     Aucun                                 │
│     ── Ce que j'ai ──                     │
│     Compte courant · Revolut · Livret     │
│     ── Ce que je dois ──                  │
│     Leasing                               │
│ (4) message d'erreur CA25                 │
├──────────────────────────────────────────┤
│ (5) [Annuler]                 [Ajouter]   │
└──────────────────────────────────────────┘
```

1. Champs existants du formulaire.
2. Lien existant (`asset_id`), présent selon le type.
3. Nouveau champ, « Aucun » puis deux groupes d'éléments actifs, prérempli par le compte par défaut à la création.
4. Message quand « Compte » et le lien désignent le même élément.
5. Actions existantes ; l'enregistrement est bloqué tant que 4 s'affiche.

## Tasks to do

### `1)` Sélecteur de compte

> Un seul composant pour les formulaires et le réglage.

1. `AccountPickerField` : `[value]`, `(valueChanged)`, `labelKey`, `errorKey` ; options via `injectNetWorthResource`, `mat-optgroup` « ce que j'ai » / dettes, « Aucun » en tête, compte archivé déjà lié gardé.
2. Ne rend rien flag éteint ou sans élément actif (CA2).
3. `UserSettingsStore.defaultAccountId` (calculé, `null` si l'élément n'est plus actif).

### `2)` Formulaires

1. Création (imprévu `add-transaction-form`, prévision `create/dialog`, ligne de modèle) : valeur initiale = compte par défaut ; payload `accountId` toujours envoyé (`null` si champ caché).
2. Modification (`edit-transaction-form` si `budgetLineId === null`, `edit/dialog`, ligne de modèle) : `accountId` envoyé seulement si le champ est affiché.
3. Formulaires avec « Versée sur » / « Tiré de » / « Dette remboursée » : erreur CA25 ; à la création, un lien égal au compte prérempli remet le compte à « Aucun » (CA45).
4. `allocated-transactions/create-dialog/form.ts` inchangé (CA4).

### `3)` Rapprochement et état local

1. `current-month.ts` `#recordAdjustment` et Android `buildAdjustmentPayload` : `accountId: null`.
2. `budget-details-store` : à la suppression d'une prévision, les réels libérés reçoivent son `accountId`.
3. Vérifier que créer un imprévu depuis le mois en cours invalide le cache des actifs ; sinon l'invalider.
4. Libellés fr/en/de/it (« Compte », groupes, message CA25).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Spec du sélecteur : CA1 (groupes, ordre), CA2 (absent), « Aucun » émet `null`. |
| 2 | Specs des cinq formulaires : CA3, CA4, CA25, CA26 (payload sans `accountId` champ caché), CA29, CA45. |
| 3 | Specs : CA44 sur le web et Android, CA46 dans le store ; `pnpm quality` vert. |
