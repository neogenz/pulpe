# Task: Long Press sur Transaction pour voir les dépenses liées

## Résumé

Implémenter un long press sur les lignes de transaction dans la liste du mois courant. Si la transaction est liée à un budget line (via `budgetLineId`), afficher les autres transactions liées avec une animation et un retour haptique. Sinon, faire un retour haptique différent pour indiquer qu'il n'y a rien.

---

## Codebase Context

### Transaction Model

**Fichier**: `Pulpe/Domain/Models/Transaction.swift:4-29`

```swift
struct Transaction {
    let id: String
    let budgetId: String
    let budgetLineId: String?  // <- Clé de liaison
    let name: String
    let amount: Decimal
    // ...

    var isAllocated: Bool { budgetLineId != nil }  // A des dépenses liées
    var isFree: Bool { budgetLineId == nil }       // Pas de liaison
}
```

### Comment trouver les transactions liées

**Fichier**: `Pulpe/Domain/Formulas/BudgetFormulas.swift:209`

```swift
// Filtrer toutes les transactions qui partagent le même budgetLineId
transactions.filter { $0.budgetLineId == budgetLine.id }
```

### Vue principale des transactions

**Fichier**: `Pulpe/Features/CurrentMonth/Components/OneTimeExpensesList.swift:31-108`

- `TransactionRow` : Composant de ligne de transaction
- Actuellement : swipeActions pour delete, pas de long press
- Layout : HStack avec check button → content → amount

### Budget Line Model

**Fichier**: `Pulpe/Domain/Models/BudgetLine.swift:4-16`

- `id`, `name`, `amount` disponibles pour afficher le contexte

---

## Documentation SwiftUI

### Long Press Gesture

```swift
.onLongPressGesture(
    minimumDuration: 0.5,
    maximumDistance: 10,
    pressing: { isPressed in
        // Animation de scale pendant le press
        withAnimation(.easeInOut(duration: 0.2)) {
            scale = isPressed ? 0.95 : 1.0
        }
    },
    perform: {
        // Action après le long press réussi
    }
)
```

### Haptic Feedback (iOS 17+)

```swift
// Méthode moderne avec sensoryFeedback modifier
.sensoryFeedback(.impact(weight: .medium), trigger: isPressed)
.sensoryFeedback(.success, trigger: showLinkedTransactions)
.sensoryFeedback(.warning, trigger: noLinkedTransactions)

// Ou méthode classique UIKit
let generator = UIImpactFeedbackGenerator(style: .medium)
generator.impactOccurred()

let notification = UINotificationFeedbackGenerator()
notification.notificationOccurred(.warning)  // Pour "rien à afficher"
```

### Animations recommandées

```swift
// Pattern d'animation cohérent avec l'app
withAnimation(.easeInOut(duration: 0.3)) { ... }

// Spring pour les reveals
withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { ... }

// Transitions
.transition(.scale(scale: 0.8).combined(with: .opacity))
```

---

## Patterns existants dans l'app

### Animation timing

**Cohérence**: `.animation(.easeInOut(duration: 0.3), value: X)` utilisé partout
- `PulpeApp.swift:40`
- `TutorialOverlay.swift:37`
- `OnboardingFlow.swift:57`

### Gestures actuels

- `onTapGesture` : utilisé pour checkbox, dismiss keyboard
- `swipeActions` : utilisé pour delete sur TransactionRow
- **Aucun `onLongPressGesture`** dans le codebase

### Haptic feedback

- **Aucun usage** de UIImpactFeedbackGenerator ou sensoryFeedback
- Opportunité d'établir un pattern cohérent

### Design des rows

```swift
// Pattern de BudgetLineRow/TransactionRow
HStack {
    checkButton
    VStack(alignment: .leading) {
        name
        subtitle
    }
    Spacer()
    amount
}
.padding()
.background(RoundedRectangle(cornerRadius: 14).fill(.background))
.shadow(...)
```

---

## Key Files

| Fichier | Lignes | Purpose |
|---------|--------|---------|
| `OneTimeExpensesList.swift` | 31-108 | TransactionRow à modifier |
| `RecurringExpensesList.swift` | 33-142 | BudgetLineRow (référence design) |
| `Transaction.swift` | 4-29 | Model avec `budgetLineId` |
| `BudgetLine.swift` | 4-16 | Model pour contexte |
| `BudgetFormulas.swift` | 203-222 | Logique de filtrage |
| `CurrentMonthView.swift` | 149-280 | ViewModel avec accès aux données |
| `View+Extensions.swift` | 42-48 | cardStyle() modifier |
| `Color+Pulpe.swift` | 1-25 | Couleurs du design system |

---

## Patterns à suivre

1. **Animation**: `.easeInOut(duration: 0.3)` ou `.spring(response: 0.4, dampingFraction: 0.8)`
2. **Long press duration**: 0.5 secondes (standard iOS)
3. **Haptic success**: `.sensoryFeedback(.success, trigger:)` pour reveal réussi
4. **Haptic warning**: `.sensoryFeedback(.warning, trigger:)` pour "rien à voir"
5. **Scale feedback**: 0.95 pendant le press, 1.0 après
6. **Transition**: `.scale.combined(with: .opacity)` pour le contenu révélé

---

## Proposition d'implémentation

### Option A: Sheet Modal (simple)

Long press → ouvre une sheet avec la liste des transactions liées au même budgetLine

**Avantages**: Pattern iOS standard, facile à implémenter
**Inconvénients**: Transition moins fluide

### Option B: Inline Expansion (avancé)

Long press → la row s'expand pour montrer les transactions liées en dessous

**Avantages**: Plus fluide, pas de navigation
**Inconvénients**: Plus complexe, gestion du scroll

### Option C: Popover (iOS natif)

Long press → popover ancré à la row avec preview des transactions

**Avantages**: Léger, ne quitte pas le contexte
**Inconvénients**: Limité en espace sur iPhone

### Recommandation: Option A (Sheet Modal)

- Cohérent avec `AddAllocatedTransactionSheet` existant
- Facile à implémenter
- Bon support accessibilité
- Peut afficher beaucoup de transactions

---

## Logique métier

```swift
// Sur long press d'une transaction
func handleLongPress(transaction: Transaction) {
    // Ignorer les transactions "free" (sans budgetLineId)
    guard let budgetLineId = transaction.budgetLineId else {
        return  // Pas de feedback, pas d'action
    }

    // Trouver TOUTES les transactions liées (même budgetLineId), y compris celle-ci
    let linkedTransactions = allTransactions.filter {
        $0.budgetLineId == budgetLineId
    }

    if linkedTransactions.count <= 1 {
        // Seule transaction liée → haptic warning
        triggerWarningFeedback()
    } else {
        // Plusieurs transactions liées → haptic success + modal
        triggerSuccessFeedback()
        showLinkedTransactionsSheet(linkedTransactions, budgetLine)
    }
}
```

---

## Dépendances

- iOS 17+ pour `.sensoryFeedback()` (sinon fallback UIKit)
- Accès aux `allTransactions` depuis le ViewModel parent
- Accès au `BudgetLine` pour afficher son nom dans la modal

---

## Décisions utilisateur

1. **Actions dans la modal** : Check + Delete autorisés
2. **Header de la modal** : Afficher le nom du budget line + consommation totale
3. **Transactions "free"** : Ignorer le long press (pas de feedback, pas d'action)
