# Implementation Plan: Long Press sur Transaction pour voir les dépenses liées

## Overview

Ajouter un long press sur les budget lines dans `RecurringExpensesList` pour afficher une sheet modale avec effet **Liquid Glass iOS 26** contenant toutes les transactions liées. La sheet permettra de check/uncheck et supprimer les transactions.

**Approche** : Sheet Modal avec Liquid Glass natif iOS 26
- `GlassEffectContainer` + `.glassEffect()` pour le glassmorphism natif
- `withAnimation(.bouncy)` pour les animations natives
- `.sensoryFeedback()` pour le retour haptique

**Scope** :
- Long press sur `BudgetLineRow` (pas `TransactionRow` qui affiche les transactions "free")
- Haptic feedback avec `.sensoryFeedback()` iOS 17+
- Animation native `.bouncy` pendant le press

---

## Dependencies

1. `RecurringExpensesList.swift` doit être modifié en premier (contient BudgetLineRow)
2. Nouvelle sheet `LinkedTransactionsSheet.swift` doit être créée
3. `CurrentMonthView.swift` doit être mis à jour pour gérer la sheet et les actions

---

## File Changes

### 1. `Pulpe/Features/CurrentMonth/Components/LinkedTransactionsSheet.swift` (NOUVEAU)

**Purpose**: Sheet modale avec Liquid Glass affichant les transactions liées

- Créer struct `LinkedTransactionsSheet` avec:
  - Paramètres: `budgetLine: BudgetLine`, `transactions: [Transaction]`, `onToggle: (Transaction) -> Void`, `onDelete: (Transaction) -> Void`
  - Header: nom du budget line + consommation totale (format: "X CHF / Y CHF")
  - Liste des transactions avec design similaire à `TransactionRow`
  - Actions: check button + swipe delete avec confirmation

- **iOS 26 Liquid Glass** :
  - Wrapper le contenu dans `GlassEffectContainer`
  - Appliquer `.glassEffect()` sur le header
  - Utiliser `.presentationBackground(.ultraThinMaterial)` sur la sheet
  - Animations avec `withAnimation(.bouncy)`

- Suivre le pattern de `AddAllocatedTransactionSheet`:
  - `NavigationStack` avec toolbar (bouton Fermer avec `.buttonStyle(.glass)`)
  - `@Environment(\.dismiss)` pour fermeture
  - `.navigationBarTitleDisplayMode(.inline)`

- Afficher message vide si aucune transaction

- Preview avec données de test

### 2. `Pulpe/Features/CurrentMonth/Components/RecurringExpensesList.swift`

**Purpose**: Ajouter long press gesture sur BudgetLineRow

#### Modifications sur `RecurringExpensesList`:
- Ajouter paramètre `onLongPress: (BudgetLine, [Transaction]) -> Void`
- Passer ce callback à `BudgetLineRow` avec les transactions filtrées

#### Modifications sur `BudgetLineRow`:
- Ajouter paramètre `allTransactions: [Transaction]`
- Ajouter paramètre `onLongPress: ([Transaction]) -> Void`
- Ajouter `@State private var isPressed = false`
- Ajouter `@State private var showNoLinkedFeedback = false`

- **iOS 26 Native Long Press** avec `.onLongPressGesture()`:
  - `minimumDuration: 0.5`
  - `maximumDistance: 10` (évite déclenchement pendant scroll)
  - `pressing:` → `withAnimation(.bouncy) { isPressed = pressing }`
  - `perform:` → calculer transactions liées, appeler callback ou trigger warning

- **Animation native iOS 26** :
  - Ajouter `.scaleEffect(isPressed ? 0.96 : 1.0)` sur le contenu
  - L'animation `.bouncy` gère automatiquement le retour élastique

- Ajouter haptic feedback:
  - `.sensoryFeedback(.success, trigger: ...)` quand transactions trouvées
  - `.sensoryFeedback(.warning, trigger: showNoLinkedFeedback)` quand aucune

- Logique dans `perform`:
  ```
  let linked = allTransactions.filter { $0.budgetLineId == line.id }
  if linked.count > 0 {
      onLongPress(linked)
  } else {
      showNoLinkedFeedback.toggle()
  }
  ```

- Mettre à jour la Preview avec les nouveaux paramètres

### 3. `Pulpe/Features/CurrentMonth/CurrentMonthView.swift`

**Purpose**: Gérer l'état de la sheet et les callbacks

#### Modifications sur `CurrentMonthView`:
- Ajouter `@State private var linkedTransactionsContext: (BudgetLine, [Transaction])?`
- Ajouter `.sheet(item:)` binding pour `LinkedTransactionsSheet`

- Créer un wrapper struct pour le binding (car tuple pas `Identifiable`):
  ```swift
  private struct LinkedTransactionsContext: Identifiable {
      let id = UUID()
      let budgetLine: BudgetLine
      let transactions: [Transaction]
  }
  ```

- Modifier les appels à `RecurringExpensesList` pour passer `onLongPress`:
  - Callback: créer `LinkedTransactionsContext` et l'assigner à `@State`

- Dans la sheet:
  - `onToggle`: appeler `viewModel.toggleTransaction()`
  - `onDelete`: appeler `viewModel.deleteTransaction()`
  - Fermer la sheet après action si besoin (ou laisser ouverte pour multi-actions)

#### Modifications sur `CurrentMonthViewModel`:
- Aucune modification nécessaire, les méthodes `toggleTransaction` et `deleteTransaction` existent déjà

### 4. `Pulpe/Features/CurrentMonth/Components/OneTimeExpensesList.swift`

**Purpose**: PAS DE MODIFICATION - les transactions "free" n'ont pas de long press

(Confirmé par la décision utilisateur: ignorer les transactions sans `budgetLineId`)

---

## Testing Strategy

### Tests manuels

1. **Long press sur BudgetLineRow avec transactions liées**:
   - Vérifier animation scale pendant le press
   - Vérifier haptic success à la fin
   - Vérifier ouverture de la sheet avec les bonnes transactions

2. **Long press sur BudgetLineRow sans transactions**:
   - Vérifier animation scale pendant le press
   - Vérifier haptic warning à la fin
   - Vérifier que la sheet ne s'ouvre pas

3. **Actions dans la sheet**:
   - Vérifier toggle check fonctionne et met à jour la liste
   - Vérifier swipe delete avec confirmation
   - Vérifier que les données parent sont mises à jour après fermeture

4. **Edge cases**:
   - Long press pendant scroll (ne doit pas déclencher grâce à `maximumDistance`)
   - Long press sur rollover line virtuel (doit être ignoré)
   - Plusieurs long press consécutifs

### Build verification

- Exécuter `xcodebuild` pour vérifier la compilation
- Tester sur simulateur iOS 17+

---

## Documentation

Aucune documentation externe requise.

---

## Rollout Considerations

- **iOS 26 requis** pour `GlassEffectContainer`, `.glassEffect()`, `.bouncy` animation
- **Fallback iOS 17-25** : Si besoin de supporter versions antérieures, utiliser `@available(iOS 26, *)` avec fallback `.ultraThinMaterial`
- **Pas de migration de données** - feature purement UI
- **Pas de breaking changes** - nouveaux paramètres avec valeurs par défaut possibles si preview échoue

---

## File Creation Order

1. `LinkedTransactionsSheet.swift` (nouveau fichier, pas de dépendance)
2. `RecurringExpensesList.swift` (ajout long press)
3. `CurrentMonthView.swift` (intégration sheet)
4. Build & Test
