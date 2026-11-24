---
status: pending
---

# Instruction: iOS — champ « Compte » dans les formulaires

## Architecture projection

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Domain/Models/Transaction.swift ✏️
    │   ├── Domain/Models/BudgetLine.swift ✏️
    │   ├── Domain/Models/BudgetLineSpread.swift ✏️
    │   ├── Domain/Models/BudgetTemplate.swift ✏️
    │   ├── Domain/Models/UserSettings.swift ✏️
    │   ├── Domain/Store/UserSettingsStore.swift ✏️
    │   ├── Shared/Components/AccountPickerField.swift ✅
    │   ├── Shared/Components/EditBudgetLineSheet.swift ✏️
    │   ├── Shared/Components/MovementSheet/MovementSheet.swift ✏️
    │   ├── Shared/Components/MovementSheet/MovementSheet+Submit.swift ✏️
    │   ├── Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift ✏️
    │   ├── Features/Budgets/BudgetDetails/AddBudgetLineSheet+Submit.swift ✏️
    │   ├── Features/Budgets/BudgetDetails/Spread/AddBudgetLineSpreadLogic.swift ✏️
    │   ├── Features/Templates/TemplateDetails/EditTemplateLineSheet.swift ✏️
    │   ├── Features/Templates/TemplateList/CreateTemplateView.swift ✏️
    │   ├── Features/CurrentMonth/Reconciliation/AccountReconciliation.swift ✏️
    │   └── Resources/Localizable.xcstrings ✏️
    └── PulpeTests/
        ├── Domain/Models/TransactionTests.swift ✏️
        ├── Domain/Models/AssetLinkTests.swift ✏️
        ├── Shared/Components/AccountPickerFieldTests.swift ✅
        ├── Shared/Components/EditBudgetLineSheetTests.swift ✏️
        ├── Features/CurrentMonth/MovementSheetTests.swift ✏️
        ├── Features/CurrentMonth/AccountReconciliationTests.swift ✏️
        ├── Features/Budgets/BudgetDetails/AddBudgetLineSheetTests.swift ✏️
        └── Features/Templates/EditTemplateLineSheetTests.swift ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Simulateur, flag allumé, jeu d'essai, aucun compte par défaut | budget ouvert | system |
| Happy path | Ouvrir `MovementSheet`, `AddBudgetLineSheet`, `AddTemplateLineSheet` (CA1, CA3) | « Compte » sur « Aucun », deux sections | system |
| Happy path | Compte courant par défaut, nouvelle saisie (CA29) | prérempli, modifiable | system |
| Edge case  | Flag éteint ou aucun élément actif (CA2) | champ absent, `accountId` envoyé `null` | system |
| Edge case  | Modifier un réel rattaché (CA4) | aucun champ | system |
| Edge case  | Même élément en « Compte » et « Versée sur » (CA25) ; lien égal au compte prérempli (CA45) | message, enregistrement bloqué ; compte remis à « Aucun » | system |
| Edge case  | Écart de rapprochement (CA44) | corps JSON avec `"accountId": null` | system |
| Edge case  | Modification sans toucher au champ (CA26) | clé `accountId` absente du PATCH | system |
| Teardown   | Tests unitaires sans état partagé | état initial | system |

## Wireframe

```txt
┌──────────────────────────────────────┐
│ (1) Nouvelle dépense                  │
│     Montant · Nom · Date              │
├──────────────────────────────────────┤
│ (2) Versée sur / Dette remboursée  ›  │
│ (3) Compte              Compte courant›│
│     Menu : Aucun                      │
│            Ce que j'ai : 3 éléments   │
│            Ce que je dois : Leasing   │
│ (4) message CA25                      │
├──────────────────────────────────────┤
│ (5) [Ajouter]                         │
└──────────────────────────────────────┘
```

1. Champs existants de la feuille.
2. `AssetPickerField` existant, selon le type.
3. `AccountPickerField` : menu « Aucun » puis deux sections, prérempli à la création.
4. Message quand le compte et le lien désignent le même élément.
5. Bouton désactivé tant que 4 s'affiche.

## Tasks to do

### `1)` Modèles

1. `accountId: String?` en lecture (`decodeIfPresent`) sur `Transaction`, `BudgetLine`, `TemplateLine` ; `UserSettings.defaultAccountId`.
2. `accountId: String??` sur `TransactionCreate`, `TransactionUpdate`, `BudgetLineCreate`, `BudgetLineUpdate`, lignes de modèle, lissage (`.some(nil)` envoie `null`, `.none` omet).
3. `UserSettingsStore.defaultAccountId` (`nil` si l'élément n'est plus actif).

### `2)` Sélecteur et feuilles

1. `AccountPickerField` calqué sur `AssetPickerField` : flag, `AssetStore.activeAssets(direction:)` pour les deux sections, `title` paramétrable.
2. Feuilles : `MovementSheet` (libre seulement), `AddBudgetLineSheet` (lissage compris), `EditBudgetLineSheet`, `EditTemplateLineSheet`, `AddTemplateLineSheet`. Création : prérempli, toujours envoyé ; modification : envoyé si le champ est affiché.
3. CA25 et CA45 comme sur le web.
4. `AccountReconciliation` : `accountId: .some(nil)`.
5. Vérifier que `AssetStore` se rafraîchit après un pointage depuis le budget.
6. Chaînes FR et traductions ; `xcodegen generate --use-cache`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `TransactionTests`, `AssetLinkTests` : décodage sans clé, encodage à trois états. |
| 2 | Tests des feuilles et du sélecteur : CA1–CA4, CA25, CA26, CA29, CA44, CA45 ; `xcodebuild test` vert. |
