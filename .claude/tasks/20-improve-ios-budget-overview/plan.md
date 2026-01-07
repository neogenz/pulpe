# Implementation Plan: Améliorer la vue budget overview iOS

## Overview

Simplifier l'écran "Mois courant" et déplacer les métriques financières dans une bottom sheet:
1. **Retirer** FinancialSummaryRow de la page principale
2. **Rendre** BudgetProgressBar tappable avec affordance visuelle
3. **Créer** une bottom sheet contenant: métriques (4 cartes), progress bar réalisée, message explicatif (style iOS 26 natif)

**Approche**: Modifications incrémentales, chaque fichier testable indépendamment.

## Dependencies

**Ordre d'implémentation:**
1. `BudgetFormulas.swift` - Ajouter totalSavings dans Metrics
2. `RealizedBalanceSheet.swift` - Créer le nouveau composant avec métriques + progress réalisée
3. `BudgetProgressBar.swift` - Ajouter affordance visuelle
4. `CurrentMonthView.swift` - Retirer FinancialSummaryRow, ajouter tap gesture et sheet

---

## File Changes

### `ios/Pulpe/Domain/Formulas/BudgetFormulas.swift`

**Action 1**: Ajouter `totalSavings` dans la struct `Metrics`
- Ligne ~9-28: Ajouter propriété `totalSavings: Decimal` dans Metrics
- Conserver `totalExpenses` comme somme expense + saving (comportement actuel)

**Action 2**: Créer fonction helper `calculateTotalSavings`
- Filtrer budgetLines et transactions où `kind == .saving`
- Pattern: suivre `calculateTotalIncome` (lignes 49-62)

**Action 3**: Modifier `calculateAllMetrics`
- Ligne ~151-169: Calculer totalSavings et l'ajouter au retour Metrics
- Passer totalSavings dans le constructeur Metrics

---

### `ios/Pulpe/Shared/Components/FinancialSummaryCard.swift`

**Aucune modification majeure** - Le composant sera réutilisé tel quel dans la bottom sheet.

**Action optionnelle**: Si besoin, ajouter une 4ème carte "Épargne" dans le composant
- Le type `.savings` existe déjà dans FinancialType (ligne 13)
- Sera utilisé dans RealizedBalanceSheet

---

### `ios/Pulpe/Features/CurrentMonth/Components/RealizedBalanceSheet.swift` (NOUVEAU)

**Action 1**: Créer le fichier avec la structure de base
- Pattern: suivre `LinkedTransactionsSheet.swift:36-68` pour NavigationStack + sheet modifiers
- Titre: "Détails du budget" ou "Vue d'ensemble"

**Action 2**: Section métriques (4 cartes en scroll horizontal)
- Réutiliser `FinancialSummaryCard` existant
- Afficher: Revenus, Dépenses, Épargne, Disponible
- Layout: ScrollView horizontal comme `FinancialSummaryRow` actuel
- Données: `metrics.totalIncome`, `metrics.totalExpenses`, `metrics.totalSavings`, `metrics.remaining`

**Action 3**: Section progress bar "Solde réalisé"
- Header: "Dépenses réalisées CHF" (gauche) + "Solde actuel CHF" (droite)
- Progress bar: value = (checkedItemsCount / totalItemsCount) × 100
- Label: "X/Y éléments exécutés"
- Pattern: suivre `realized-balance-progress-bar.ts:24-62`

**Action 4**: Couleur conditionnelle du solde actuel
- Solde >= 0: `.financialIncome`
- Solde < 0: `.red` (déficit)

**Action 5**: Message explicatif - Style iOS 26 natif
- Utiliser `Section` avec header/footer natif SwiftUI
- Ou utiliser `.footnote` style dans un `GroupBox`
- Texte: "Ce solde est calculé en fonction des dépenses que vous avez cochées comme effectuées. Comparez-le à votre solde bancaire pour vérifier qu'il n'y a pas d'écart."
- Icône: `info.circle` avec couleur `.secondary`
- Style natif iOS: fond système `.secondarySystemGroupedBackground`, coins arrondis automatiques

**Action 6**: Configurer les presentation modifiers
- `.presentationDetents([.medium, .large])`
- `.presentationDragIndicator(.visible)`

**Inputs requis**:
- `metrics: BudgetFormulas.Metrics`
- `realizedMetrics: BudgetFormulas.RealizedMetrics`

---

### `ios/Pulpe/Shared/Components/BudgetProgressBar.swift`

**Action 1**: Ajouter affordance visuelle pour indiquer l'interactivité
- Ligne ~59-68 (headerSection): Ajouter icône `chevron.right` ou `info.circle` à droite
- Style: `.foregroundStyle(.secondary)`, `.font(.caption)`
- Alternative: ajouter léger chevron sous le footer

**Action 2**: Rendre le composant tappable
- Ne PAS ajouter onTapGesture ici directement
- Le tap sera géré par le parent (CurrentMonthView) via un wrapper Button ou onTapGesture
- Raison: garder le composant réutilisable et simple

**Action 3**: Ajouter `.contentShape(Rectangle())` pour étendre la zone tappable
- Appliquer sur le VStack principal (ligne ~43-55)
- Assure que toute la surface est tappable, pas juste les éléments visibles

**Note**: L'affordance visuelle doit être subtile - un petit chevron ou icône info suffit

---

### `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift`

**Action 1**: Ajouter état pour la sheet
- Ligne ~8: Ajouter `@State private var showRealizedBalanceSheet = false`

**Action 2**: RETIRER FinancialSummaryRow de la page
- Ligne ~93: Supprimer `FinancialSummaryRow(metrics: viewModel.metrics)`
- Les métriques seront désormais affichées dans la bottom sheet

**Action 3**: Wrapper BudgetProgressBar avec tap gesture
- Ligne ~88-90: Ajouter `.onTapGesture` et `.sensoryFeedback`
- La progress bar devient le point d'entrée vers les détails financiers

**Action 4**: Ajouter la sheet pour RealizedBalanceSheet
- Après les autres `.sheet()` (ligne ~77): Ajouter sheet avec `$showRealizedBalanceSheet`
- Passer `viewModel.metrics` et `viewModel.realizedMetrics`

**Action 5**: Ajouter computed property `realizedMetrics` dans ViewModel
- Ligne ~198 (après metrics): Utiliser `BudgetFormulas.calculateRealizedMetrics()`

---

## Testing Strategy

### Tests manuels à effectuer

1. **Affichage 4 cartes**
   - Vérifier que les 4 cartes s'affichent en grille 2×2
   - Vérifier les montants corrects pour chaque métrique
   - Tester avec des valeurs négatives (déficit)

2. **BudgetProgressBar tappable**
   - Vérifier l'affordance visuelle (chevron/info visible)
   - Tester le tap ouvre la sheet
   - Vérifier le feedback haptique au tap

3. **RealizedBalanceSheet**
   - Vérifier les 4 métriques affichées
   - Vérifier les dépenses réalisées et solde actuel
   - Vérifier le compteur X/Y éléments exécutés
   - Vérifier la couleur conditionnelle (positif/négatif)
   - Vérifier le message tooltip
   - Tester les detents (.medium et .large)
   - Tester le drag indicator

4. **Cas limites**
   - Budget sans transactions (0/0 éléments)
   - Tous les éléments cochés (100%)
   - Solde réalisé négatif
   - Aucun élément coché (0%)

### Tests unitaires (optionnels)

- `BudgetFormulas.calculateTotalSavings()` - vérifier le calcul correct
- Metrics.totalSavings inclus dans calculateAllMetrics

---

## Rollout Considerations

### Pas de breaking changes
- Les formules existantes restent inchangées
- BudgetProgressBar garde son comportement par défaut (juste ajout affordance)
- FinancialSummaryCard existant reste compatible

### Accessibilité
- Ajouter `.accessibilityLabel()` sur BudgetProgressBar pour VoiceOver
- Exemple: "Barre de progression du budget, appuyez pour voir les détails"
- Ajouter `.accessibilityHint()` sur les cartes de la sheet

### Performance
- RealizedMetrics calculé via computed property (recalculé à chaque accès)
- Si performance issue, envisager de stocker dans @State ou @Observable

---

## Summary

| Fichier | Type | Action |
|---------|------|--------|
| BudgetFormulas.swift | Modifier | Ajouter totalSavings |
| FinancialSummaryCard.swift | Inchangé | Réutilisé dans la sheet |
| RealizedBalanceSheet.swift | Créer | Nouvelle bottom sheet complète |
| BudgetProgressBar.swift | Modifier | Ajouter affordance visuelle |
| CurrentMonthView.swift | Modifier | Retirer FinancialSummaryRow + ajouter sheet |

**Estimation**: 4 fichiers modifiés, 1 fichier créé, ~150-200 lignes de code
