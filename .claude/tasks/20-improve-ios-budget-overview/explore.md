# Task: Améliorer la vue budget overview iOS

## Objectif
Refondre visuellement la section Revenus/Dépenses/Disponible de l'écran "Mois courant" iOS en s'inspirant du style Angular (`pulpe-budget-financial-overview`), ajouter une progress bar interactive avec bottom sheet informative au tap.

---

## Codebase Context - iOS

### Composants actuels identifiés

| Fichier | Rôle | Lignes clés |
|---------|------|-------------|
| `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift` | Vue principale mois courant | 88-90: BudgetProgressBar, 93: FinancialSummaryRow |
| `ios/Pulpe/Shared/Components/FinancialSummaryCard.swift` | **Composant à modifier** - 3 cartes horizontales | 68-101: FinancialSummaryRow |
| `ios/Pulpe/Shared/Components/BudgetProgressBar.swift` | Barre de progression existante | 107-119: progressBar avec GeometryReader |
| `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift` | Système de couleurs | 12-14: .financialIncome, .financialExpense, .financialSavings |
| `ios/Pulpe/Features/CurrentMonth/Components/LinkedTransactionsSheet.swift` | Pattern bottom sheet | 66-67: presentationDetents, dragIndicator |

### Architecture des données
```
BudgetFormulas.calculateAllMetrics()
    → BudgetFormulas.Metrics (totalIncome, totalExpenses, available, remaining)
        → FinancialSummaryRow
            → FinancialSummaryCard × 3
```

### Patterns existants à réutiliser

**Bottom sheet pattern** (`LinkedTransactionsSheet.swift:36-68`):
```swift
NavigationStack {
    ScrollView { ... }
}
.presentationDetents([.medium, .large])
.presentationDragIndicator(.visible)
```

**Card styling** (`View+Extensions.swift:42-48`):
```swift
.cardStyle() // padding + background + cornerRadius(12) + shadow
```

**Semantic colors** (`Color+Pulpe.swift`):
- `.financialIncome` - revenus (bleu)
- `.financialExpense` - dépenses (orange)
- `.financialSavings` - épargne (vert)
- `.pulpePrimary` - accent (#006E25)

**Tap interactions** (`RecurringExpensesList.swift:158-171`):
```swift
.onTapGesture { action() }
.sensoryFeedback(.impact, trigger: state)
```

---

## Documentation Insights - Angular Reference

### Composants de référence analysés

**1. `budget-financial-overview.ts` (lignes 26-103)**
- Grille 2×2 (mobile) / 1×4 (desktop) avec 4 métriques
- Structure par métrique: icône + label + montant
- Couleurs conditionnelles selon le signe

**2. `realized-balance-progress-bar.ts` (lignes 24-62)**
- Header: "Dépenses réalisées" (gauche) + "Solde actuel" (droite)
- Progress bar: `mat-progress-bar` avec value = (checkedCount / totalCount) × 100
- Label: "X/Y éléments exécutés"
- Slot `<ng-content select="[slot=title-info]">` pour tooltip

**3. `realized-balance-tooltip.ts` (lignes 9-19)**
- Icône `info` avec tooltip
- **Message**: "Ce solde est calculé en fonction des dépenses que vous avez cochées comme effectuées. Comparez-le à votre solde bancaire pour vérifier qu'il n'y a pas d'écart."
- Position: above, touch gestures auto

### Formules métier partagées (`budget-formulas.ts`)
```typescript
// Revenus réalisés = items cochés avec kind='income'
calculateRealizedIncome(budgetLines, transactions)

// Dépenses réalisées = items cochés avec kind='expense' ou 'saving'
calculateRealizedExpenses(budgetLines, transactions)

// Solde réalisé = realizedIncome - realizedExpenses
calculateRealizedBalance(budgetLines, transactions)
```

### Palette de couleurs (`_financial-colors.scss`)
| Variable | Hex | Usage |
|----------|-----|-------|
| `--pulpe-financial-income` | #0061a6 | Revenus |
| `--pulpe-financial-expense` | #c26c00 | Dépenses |
| `--pulpe-financial-savings` | #27ae60 | Épargne |
| `--pulpe-financial-negative` | mat-sys-error | Déficit |

---

## Research Findings - iOS UX Best Practices

### Touch targets
- **Minimum 44×44 pt** - Standard Apple obligatoire
- Zone tactile peut s'étendre au-delà du visuel

### Affordances pour éléments tappables
1. **Couleur distinctive** - accent color pour interactif
2. **Feedback visuel immédiat** - < 100ms au tap
3. **Feedback haptique** - `UIImpactFeedbackGenerator`
4. **Chevrons/icônes** - > pour navigation, info pour détails

### Bottom sheets SwiftUI (iOS 16+)
```swift
.sheet(isPresented: $show) {
    Content()
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .medium))
}
```

**Detents recommandés:**
- `.medium` - 50% hauteur (preview)
- `.large` - pleine hauteur
- `.fraction(0.3)` - custom peek

### Progress bar interactive
- Wrapper avec `GeometryReader` pour capturer position du tap
- `.contentShape(Rectangle())` pour élargir zone tappable
- `.sensoryFeedback(.impact)` au tap

### Info displays
- **Préférer bottom sheet** aux tooltips sur mobile
- Icône `info` comme trigger avec tap gesture
- Long-press gesture pour info contextuelle

---

## Key Files

### À modifier
| Fichier | Action |
|---------|--------|
| `ios/Pulpe/Shared/Components/FinancialSummaryCard.swift:68-101` | Refondre FinancialSummaryRow avec nouveau design |
| `ios/Pulpe/Shared/Components/BudgetProgressBar.swift` | Ajouter tap gesture + affordance visuelle |
| `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:88-93` | Intégrer nouvelle progress bar + sheet |

### À créer
| Fichier | Rôle |
|---------|------|
| `ios/Pulpe/Features/CurrentMonth/Components/RealizedBalanceSheet.swift` | Bottom sheet avec tooltip informatif |

### Références (lecture seule)
| Fichier | Utilité |
|---------|---------|
| `ios/Pulpe/Features/CurrentMonth/Components/LinkedTransactionsSheet.swift` | Pattern bottom sheet |
| `ios/Pulpe/Domain/Formulas/BudgetFormulas.swift` | Ajouter calculateRealizedBalance |
| `frontend/.../budget-financial-overview.ts` | Design de référence |
| `frontend/.../realized-balance-progress-bar.ts` | UX de référence |

---

## Patterns to Follow

### 1. Design System cohérent
- Utiliser `Color+Pulpe` pour toutes les couleurs
- Respecter les semantic colors (income/expense/savings)
- Appliquer `.cardStyle()` pour les cartes

### 2. Interactions iOS natives
- `.sensoryFeedback(.impact)` pour tous les taps
- `.presentationDetents([.medium, .large])` pour sheets
- Minimum 44pt touch targets

### 3. Architecture données
- Étendre `BudgetFormulas.Metrics` si nécessaire
- Calculer `realizedBalance` et `realizedExpenses`
- Compter `checkedCount` / `totalCount` pour progress

### 4. Accessibilité
- Labels descriptifs pour VoiceOver
- Contraste suffisant sur couleurs
- `.accessibilityHint()` sur éléments tappables

---

## Dependencies

### Pré-requis
1. **Formules réalisées**: Ajouter `calculateRealizedBalance`, `calculateRealizedExpenses` dans `BudgetFormulas.swift`
2. **Comptage cochés**: Ajouter `checkedCount`, `totalCount` dans `Metrics`

### Données disponibles
- `BudgetFormulas.Metrics` contient déjà: totalIncome, totalExpenses, available, remaining
- `budgetLines` et `transactions` disponibles dans `AppState`
- `checkedAt` existe sur BudgetLine et Transaction

---

## Propositions d'implémentation

### Option A: Refonte minimale
- Améliorer visuellement FinancialSummaryRow existant
- Ajouter tap sur BudgetProgressBar → sheet simple avec message tooltip
- ~2-3 fichiers modifiés

### Option B: Refonte complète (recommandée)
- Nouveau design FinancialSummaryRow inspiré Angular
- Progress bar avec "Solde réalisé" comme Angular
- Bottom sheet avec métriques détaillées + message explicatif
- ~4-5 fichiers modifiés

### Éléments UX à valider
1. La progress bar doit-elle montrer checkedCount/totalCount ou dépenses/budget?
2. Le tap ouvre une sheet ou un popover?
3. Faut-il garder les 3 cartes horizontales ou passer à une grille 2×2?
