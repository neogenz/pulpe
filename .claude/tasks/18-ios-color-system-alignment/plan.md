# Implementation Plan: Aligner les couleurs iOS avec le frontend Angular

## Overview

Harmoniser les couleurs de l'app iOS avec le frontend Angular tout en respectant les Human Interface Guidelines d'Apple :
- Garder les backgrounds système iOS (pas de #f6fbf1)
- Aligner l'AccentColor avec le vert primaire Pulpe #006E25
- Créer un système de couleurs centralisé pour les couleurs financières
- Harmoniser income/expense/savings avec le frontend

## Dependencies

Aucune dépendance externe. L'ordre des fichiers est important :
1. Créer l'extension Color (base)
2. Mettre à jour AccentColor asset
3. Mettre à jour les fichiers qui utilisent les couleurs

## File Changes

### `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift` (NOUVEAU)

- Créer ce fichier avec une extension Color publique
- Ajouter un initializer `init(hex: UInt)` (déplacer de PulpeLogo.swift)
- Ajouter les couleurs financières comme propriétés statiques :
  - `static var financialIncome: Color` → hex 0x0061A6 (bleu)
  - `static var financialExpense: Color` → hex 0xC26C00 (orange)
  - `static var financialSavings: Color` → hex 0x27AE60 (vert)
- Ajouter la couleur primaire Pulpe :
  - `static var pulpePrimary: Color` → hex 0x006E25 (vert forêt)
- Ajouter les couleurs du gradient pour référence :
  - `static var pulpeGradientColors: [Color]` → array des 4 couleurs du gradient

### `ios/Pulpe/Resources/Assets.xcassets/AccentColor.colorset/Contents.json`

- Changer la couleur universelle de turquoise vers vert Pulpe #006E25
- Convertir hex #006E25 en composants sRGB :
  - red: 0.000 (0x00 = 0)
  - green: 0.431 (0x6E = 110 → 110/255 ≈ 0.431)
  - blue: 0.145 (0x25 = 37 → 37/255 ≈ 0.145)
- Garder "idiom": "universal" (même couleur light/dark - la couleur est assez foncée)

### `ios/Pulpe/Domain/Models/TransactionEnums.swift`

- Modifier la propriété `color` du enum `TransactionKind` (lignes 33-39)
- Remplacer les couleurs système par les couleurs Pulpe :
  - `.income: .green` → `.income: .financialIncome`
  - `.expense: .red` → `.expense: .financialExpense`
  - `.saving: .blue` → `.saving: .financialSavings`

### `ios/Pulpe/Shared/Components/FinancialSummaryCard.swift`

- Modifier le enum `FinancialType` (lignes 17-35)
- Propriété `color` (lignes 17-25) :
  - `.income: .green` → `.income: .financialIncome`
  - `.expense: .red` → `.expense: .financialExpense`
  - `.savings: .blue` → `.savings: .financialSavings`
- Propriété `backgroundColor` (lignes 27-35) :
  - `.income: .green.opacity(0.1)` → `.income: .financialIncome.opacity(0.1)`
  - `.expense: .red.opacity(0.1)` → `.expense: .financialExpense.opacity(0.1)`
  - `.savings: .blue.opacity(0.1)` → `.savings: .financialSavings.opacity(0.1)`

### `ios/Pulpe/Shared/Components/PulpeLogo.swift`

- Supprimer l'extension Color privée (lignes 29-37)
- Mettre à jour le gradient pour utiliser `Color.pulpeGradientColors` ou garder les couleurs hex inline (car elles sont spécifiques au logo et déjà alignées avec le frontend)
- Option retenue : garder les couleurs hex inline car elles sont déjà correctes et le fichier reste auto-contenu

## Testing Strategy

### Tests manuels
- [ ] Vérifier que l'AccentColor apparaît en vert forêt dans l'app
- [ ] Vérifier les badges de type (KindBadge) affichent les bonnes couleurs
- [ ] Vérifier les cartes financières (FinancialSummaryCard) avec les nouvelles couleurs
- [ ] Vérifier le mode sombre - les couleurs doivent rester lisibles
- [ ] Comparer visuellement avec le frontend Angular

### Écrans à tester
- LoginView (AccentColor sur le bouton)
- CurrentMonthView (badges, cartes financières)
- BudgetDetailsView (lignes de budget avec types)
- OnboardingFlow (boutons d'action)

## Documentation

Aucune documentation à mettre à jour.

## Rollout Considerations

- **Pas de breaking change** : les couleurs changent visuellement mais l'API reste identique
- **Pas de migration** : changement purement visuel
- **Feature flag** : non nécessaire, les couleurs sont une amélioration directe
