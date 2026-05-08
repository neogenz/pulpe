# Plan — Migration `BudgetLineDetailSheet` (sheet → push full page)

> **Décisions prises avant exécution**
>
> - Full page push partout : `lineDetail`, `addAllocatedTx`, `editTx`, **et free transaction edit**.
> - `EditTransactionSheet` et `AddAllocatedTransactionSheet` sont retirés complètement après migration (orphelins).
> - `EditBudgetLineSheet` (déclenché depuis le menu header de la page lineDetail) **reste sheet** : tâche modale courte, pattern HIG approprié.
> - **ViewModel sharing** : `@Environment` injection (idiom 2026 Swift + Observation framework). Pas d'init param explicite.

---

## Contexte

### Problème UX actuel

Flux courant dans `BudgetDetailsView` :

1. Tap sur une enveloppe (`BudgetLine`) → `destination = .lineDetail(line)` → ouverture d'un bottom sheet `BudgetLineDetailSheet` (detents `.medium` / `.large`).
2. Tap sur une transaction dans la liste → callback `onDismissAndEditTransaction` → SwiftUI **ferme** le bottom sheet, puis le parent **ré-ouvre** un autre sheet (`EditTransactionSheet`) via `destination = .editTransaction(tx)`.
3. Save / cancel → fermeture du sheet d'édition → l'utilisateur revient sur la **liste des budgets**, plus sur la sheet enveloppe. Il doit re-taper l'enveloppe pour reprendre.

Conséquence : perte du contexte d'édition à chaque saisie. Très douloureux quand on saisit plusieurs transactions d'affilée.

### Décision

Adopter le pattern canonique iOS HIG pour ce flux : **drill-down par push** dans le `NavigationStack` parent.

```
BudgetsTab (NavigationStack root, path: appState.budgetPath)
└─ push BudgetListView
   └─ push BudgetDestination.details(budgetId) → BudgetDetailsView
      ├─ push BudgetLinePushRoute.lineDetail(lineId) → BudgetLineDetailPage
      │  ├─ push BudgetLinePushRoute.editTx(transactionId) → EditTransactionPage
      │  └─ push BudgetLinePushRoute.addAllocatedTx(lineId) → AddAllocatedTransactionPage
      └─ push BudgetLinePushRoute.editTx(transactionId) → EditTransactionPage  (free tx tap)
```

Bénéfices :

- Plus de fermeture / ré-ouverture de sheet.
- Back swipe natif iOS pour revenir à la liste de transactions ou à la liste des enveloppes.
- Saisie de plusieurs transactions sans perdre le contexte enveloppe.
- Pas de quirks Liquid Glass (les push transitions n'ont pas les contraintes des partial detents).
- Cohérence stylistique : tous les flows d'édition de transactions passent par push.

### Hors scope

- Édition / suppression de la `BudgetLine` elle-même (menu header de `BudgetLineDetailPage`) → reste sheet (`EditBudgetLineSheet`) ou alert (delete). Tâche modale courte, pattern HIG approprié.
- `BudgetDetailsView` lui-même reste push (déjà le cas depuis `BudgetListView`).
- `addBudgetLine` (icon toolbar racine de `BudgetDetailsView`), `previousBudget`, `realizedBalance` restent en sheet.

## Architecture cible

### Hiérarchie navigation

| Niveau | Type | État |
|---|---|---|
| `BudgetsTab` | `NavigationStack(path: $appState.budgetPath)` | **Inchangé** |
| `BudgetListView` | racine du stack | **Inchangé** |
| `BudgetDetailsView` | push via `BudgetDestination.details(budgetId)` | **Inchangé** |
| `BudgetLineDetailPage` | push via nouveau `BudgetLinePushRoute.lineDetail(lineId)` | **Nouveau** |
| `EditTransactionPage` | push via `BudgetLinePushRoute.editTx(transactionId)` | **Nouveau** |
| `AddAllocatedTransactionPage` | push via `BudgetLinePushRoute.addAllocatedTx(lineId)` | **Nouveau** |

### Nouveau type de destination push

```swift
enum BudgetLinePushRoute: Hashable {
    case lineDetail(lineId: String)
    case addAllocatedTx(lineId: String)
    case editTx(transactionId: String)
}
```

ID-based (jamais le model entier) : la page résout reactivement le model depuis le `BudgetDetailsViewModel` partagé.

Enregistré au niveau de `BudgetDetailsView` :

```swift
.navigationDestination(for: BudgetLinePushRoute.self) { route in
    pushDestination(for: route)
        .environment(viewModel)  // injection idiomatique 2026
}
```

`navigationDestination(for:)` à n'importe quelle profondeur du stack contribue au registry global du `NavigationStack`.

### Sheet enum simplifiée

`BudgetDetailDestination` (sheet enum existante) après migration :

| Case | Statut | Pourquoi |
|---|---|---|
| `addBudgetLine` | conservé | + icon toolbar racine |
| `editBudgetLine(BudgetLine)` | conservé | menu header de `BudgetLineDetailPage`, tâche modale courte |
| `previousBudget(PreviousBudgetItem)` | conservé | inchangé |
| `realizedBalance` | conservé | inchangé |
| `editTransaction(Transaction)` | **retiré** | tap free tx devient push aussi |
| `lineDetail(BudgetLine)` | **retiré** | devient push |
| `addAllocatedTransaction(BudgetLine)` | **retiré** | devient push |

### Stratégie de partage du `BudgetDetailsViewModel`

#### Idiom 2026 Swift retenu : `@Environment` injection

Le viewModel est `@State` dans `BudgetDetailsView` (ownership correct, modèle Observation iOS 17+). Pour le partager aux pages enfants pushées :

```swift
// BudgetDetailsView.body
.navigationDestination(for: BudgetLinePushRoute.self) { route in
    pushDestination(for: route)
        .environment(viewModel)   // <-- injection sur la destination view
}
```

```swift
// BudgetLineDetailPage, EditTransactionPage, AddAllocatedTransactionPage
@Environment(BudgetDetailsViewModel.self) private var viewModel
```

Pourquoi cet idiom :

- Pure Observation framework (`@Observable` + `@Environment(Type.self)`), pas de boilerplate init param.
- Pattern publié par Apple dans les samples iOS 17+ (FoodTruck, Bookshelf) et repris par Swift with Majid, Hacking with Swift et la communauté en 2024-2026.
- Tracking automatique : Observation ne re-render que les pages qui lisent réellement les propriétés mutées.
- Couplage minimal : ajouter une nouvelle dépendance ne touche pas chaque callsite.
- `.environment(viewModel)` placé sur la destination view (et non sur le body de `BudgetDetailsView`) garantit la propagation dans la branche pushée — propriété documentée de SwiftUI.

⚠️ Pas d'init param `viewModel: BudgetDetailsViewModel` dans les pages : redondant avec l'env, et SwiftUI tracerait deux références.

#### Lookup reactif dans les pages enfants

Les pages reçoivent uniquement un ID, et résolvent le model depuis le viewModel :

```swift
struct BudgetLineDetailPage: View {
    let lineId: String

    @Environment(BudgetDetailsViewModel.self) private var viewModel
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    private var budgetLine: BudgetLine? {
        viewModel.budgetLines.first { $0.id == lineId }
    }

    private var transactions: [Transaction] {
        viewModel.transactions
            .filter { $0.budgetLineId == lineId }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    var body: some View {
        Group {
            if let line = budgetLine {
                pageContent(for: line)
            } else {
                Color.clear
                    .task { dismiss() }   // ligne supprimée pendant la session
            }
        }
        .pulpeBackground()
        .navigationBarTitleDisplayMode(.inline)
    }
}
```

`@Environment(BudgetDetailsViewModel.self)` participe au tracking Observation : les recomputes du body sont déclenchés uniquement par la mutation des propriétés effectivement lues.

## Fichiers touchés

### Modifications

| Fichier | Action |
|---|---|
| `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift` | + `navigationDestination(for: BudgetLinePushRoute.self)` avec `.environment(viewModel)` ; `onTap` enveloppe = push ; `onTap` free tx = push ; drop `BudgetLineDetailSheetWrapper` ; drop cases sheet enum `lineDetail`, `addAllocatedTransaction`, `editTransaction` |
| `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineDetailSheet.swift` → renommer `BudgetLineDetailPage.swift` | drop `NavigationStack` interne + `standardSheetPresentation` + `SheetCloseButton` ; back swipe natif ; push edit / add via `appState.budgetPath` ; `dismiss()` automatique si `budgetLine == nil` ; viewModel via `@Environment` |
| `ios/Pulpe/App/PUL209VerifyHarness.swift` | priming `pendingOpenLineId` → push path au lieu de set sheet destination |

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `ios/Pulpe/Features/Budgets/BudgetDetails/EditTransactionPage.swift` | Push page rendant le form inline (`KindToggle` + `HeroAmountField` + …) dans `ScrollView` + toolbar back natif + `pulpeBackground()`. Lookup `transactionId` via `@Environment(BudgetDetailsViewModel.self)`. |
| `ios/Pulpe/Features/Budgets/BudgetDetails/AddAllocatedTransactionPage.swift` | idem pour add allocated, lookup `lineId`. |
| `ios/Pulpe/Features/Budgets/BudgetDetails/EditTransactionLogic.swift` | Pure helpers (anciennement static methods de `EditTransactionSheet`) : `shouldShowAlternateCurrency(for:userCurrency:)`, `initialAmount(for:userCurrency:)`, `isFormValid(name:amount:isLoading:)`, `buildUpdate(name:amount:kind:transactionDate:conversion:)`. Enum namespace, fonctions statiques, testables sans instancier de view. |
| `ios/Pulpe/Features/Budgets/BudgetDetails/AddAllocatedTransactionLogic.swift` | idem pour add allocated (`buildCreate(...)`, helpers de validation). |

> **Pourquoi pas un type `…FormContent` intermédiaire ?** Un seul consumer (la Page) après migration. Pattern Apple sample code 2026 : composition par subviews définies dans la Page elle-même, pas extraction d'un `…FormContent` type. Le form (KindToggle, HeroAmountField, etc.) reste inline dans la Page via subviews privées. Évite un niveau d'indirection inutile.

### Suppressions définitives

| Fichier / symbole | Raison |
|---|---|
| `ios/Pulpe/Shared/Components/EditTransactionSheet.swift` | Plus aucun caller après migration (le free tx edit passe en push). |
| `ios/Pulpe/Features/Budgets/BudgetDetails/AddAllocatedTransactionSheet.swift` | Plus aucun caller après migration. |
| `BudgetLineDetailSheetWrapper` (private struct dans `BudgetDetailsView.swift`) | Plus de wrapping callback-based, push direct. |
| `lineDetailSheet(for:)` (private method dans `BudgetDetailsView.swift`) | Idem. |
| `BudgetDetailDestination.lineDetail` (case enum) | Devient push. |
| `BudgetDetailDestination.addAllocatedTransaction` (case enum) | Devient push. |
| `BudgetDetailDestination.editTransaction` (case enum) | Devient push. |
| `pendingTransactionDeletion` + `handleSheetDismiss` | Plus de pattern dismiss-then-toast pour transactions : suppression directe inline, toast émis par le viewModel. |

⚠️ Avant de supprimer `EditTransactionSheet` et `AddAllocatedTransactionSheet`, vérifier qu'aucun test ne référence ces types directement (snapshot tests, UI tests). Mettre à jour le harness si besoin.

## Détails par fichier

### `BudgetLineDetailPage.swift` (refactor de `BudgetLineDetailSheet`)

**À retirer**

- `NavigationStack { ... }` wrapper interne (le stack du tab fournit la chrome).
- `.standardSheetPresentation(detents: [.medium, .large])`.
- `ToolbarItem(.cancellationAction) { SheetCloseButton() }` (back natif).
- `safeAreaInset(.bottom)` background `Color.sheetBackground` → conserver le `safeAreaInset` mais bg = `pulpeBackground()` ou `Color.appBackground`.
- Tous les closures parent : `onEditTransaction`, `onDeleteTransaction`, `onToggleTransaction`, `onAddTransaction`, `onDelete` → remplacés par accès direct au `viewModel` (env) ou push (`appState.budgetPath.append`).

**À conserver**

- `titleWithKindDot` (rendered en header inline dans le contenu, pas dans `navigationTitle` car le dot coloré est custom). Optionnel : `.navigationBarTitleDisplayMode(.inline)` avec un title vide si on garde le dot inline.
- `heroSection` (montant restant + progress bar + spent / planned label).
- `transactionsHeader` (« Transactions » + count).
- `swipeActions(for:)` → call `viewModel.toggleTransaction(...)` et `viewModel.softDeleteTransaction(...)` directement.
- `addTransactionButton` → `appState.budgetPath.append(BudgetLinePushRoute.addAllocatedTx(lineId: line.id))`.
- Row tap → `appState.budgetPath.append(BudgetLinePushRoute.editTx(transactionId: tx.id))`.
- `headerMenu` (Modifier ligne / Supprimer ligne) :
  - Modifier → callback `onEditLine(line)` propagé au parent qui set `destination = .editBudgetLine(line)` (sheet over push, pattern OK).
  - Supprimer → confirmation alert → `viewModel.softDeleteBudgetLine(...)` puis `dismiss()` (= pop) puis toast.
- `#if DEBUG` overlay `PUL209VerifyState.pendingShowMenu` → conservé.

**À ajouter**

- `@Environment(BudgetDetailsViewModel.self) private var viewModel`.
- `@Environment(AppState.self) private var appState` pour `budgetPath`.
- `@Environment(\.dismiss) private var dismiss` pour pop manuel (delete budget line, ligne disparue).

**Signature**

```swift
struct BudgetLineDetailPage: View {
    let lineId: String
    let onEditLine: (BudgetLine) -> Void
}
```

`viewModel` injecté via env, pas en init param.

### `BudgetDetailsView.swift`

**Body : ajout du resolver push**

```swift
.sheet(item: $destination) { sheetContent(for: $0) }
.navigationDestination(for: BudgetLinePushRoute.self) { route in
    pushDestination(for: route)
        .environment(viewModel)
}
```

`onDismiss: handleSheetDismiss` retiré : `pendingTransactionDeletion` / `handleSheetDismiss` n'ont plus de raison d'être.

**Resolver push**

```swift
@ViewBuilder
private func pushDestination(for route: BudgetLinePushRoute) -> some View {
    switch route {
    case .lineDetail(let lineId):
        BudgetLineDetailPage(
            lineId: lineId,
            onEditLine: { line in destination = .editBudgetLine(line) }
        )
    case .addAllocatedTx(let lineId):
        AddAllocatedTransactionPage(lineId: lineId)
    case .editTx(let transactionId):
        EditTransactionPage(transactionId: transactionId)
    }
}
```

**Tap callback enveloppe (modification ligne 198)**

```swift
// Avant
onTap: { line in destination = .lineDetail(line) }
// Après
onTap: { line in
    appState.budgetPath.append(BudgetLinePushRoute.lineDetail(lineId: line.id))
}
```

**Tap callback free transaction (modification ligne 222)**

```swift
// Avant
onTap: { transaction in
    destination = .editTransaction(transaction)
}
// Après
onTap: { transaction in
    appState.budgetPath.append(BudgetLinePushRoute.editTx(transactionId: transaction.id))
}
```

**Cleanup**

- Drop `BudgetLineDetailSheetWrapper` private struct.
- Drop `lineDetailSheet(for:)` private method.
- Drop `case .lineDetail(let line):` dans `sheetContent(for:)`.
- Drop `case .addAllocatedTransaction(let line):` dans `sheetContent(for:)`.
- Drop `case .editTransaction(let transaction):` dans `sheetContent(for:)`.
- Drop les trois cases correspondantes dans l'enum `BudgetDetailDestination`.
- Drop `pendingTransactionDeletion` (`@State`) et `handleSheetDismiss()` (private method).

### `EditTransactionLogic.swift` (nouveau)

Helpers purs, testables sans instancier de view. Récupère les méthodes statiques de l'ancienne `EditTransactionSheet`.

```swift
enum EditTransactionLogic {
    static func shouldShowAlternateCurrency(
        for transaction: Transaction,
        userCurrency: SupportedCurrency
    ) -> Bool {
        guard let txCurrency = transaction.originalCurrency else { return false }
        return txCurrency != userCurrency
    }

    static func initialAmount(
        for transaction: Transaction,
        userCurrency: SupportedCurrency
    ) -> Decimal {
        if shouldShowAlternateCurrency(for: transaction, userCurrency: userCurrency),
           let originalAmount = transaction.originalAmount {
            return originalAmount
        }
        return transaction.amount
    }

    static func isFormValid(name: String, amount: Decimal?, isLoading: Bool) -> Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    static func buildUpdate(
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        transactionDate: Date,
        conversion: CurrencyConversion?
    ) -> TransactionUpdate {
        // logic identique à EditTransactionSheet.buildUpdate
    }
}
```

### `EditTransactionPage.swift` (nouveau)

```swift
struct EditTransactionPage: View {
    let transactionId: String

    @Environment(BudgetDetailsViewModel.self) private var viewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var name: String = ""
    @State private var amount: Decimal?
    @State private var amountText: String = ""
    @State private var kind: TransactionKind = .expense
    @State private var transactionDate: Date = .now
    @State private var error: Error?
    @State private var isLoading = false
    @State private var submitSuccessTrigger = false
    @FocusState private var focusedField: AmountDescriptionField?

    private var transaction: Transaction? {
        viewModel.transactions.first { $0.id == transactionId }
    }

    var body: some View {
        Group {
            if let tx = transaction {
                ScrollView {
                    formContent(for: tx)
                }
                .scrollBounceBehavior(.basedOnSize)
                .scrollDismissesKeyboard(.interactively)
                .pulpeBackground()
                .navigationTitle("Modifier la transaction")
                .navigationBarTitleDisplayMode(.inline)
                .loadingOverlay(isLoading)
                .dismissKeyboardOnTap()
                .keyboardFieldNavigation(focus: $focusedField, order: [.amount, .description])
                .sensoryFeedback(.success, trigger: submitSuccessTrigger)
                .task(id: tx.id) { hydrate(from: tx) }
            } else {
                Color.clear.task { dismiss() }
            }
        }
    }

    @ViewBuilder
    private func formContent(for tx: Transaction) -> some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            KindToggle(selection: $kind)
            // CurrencyAmountPicker (read-only si alternate)
            // HeroAmountField
            // CurrencyConversionBadge
            // FormTextField description
            // TransactionDateSelector
            // ErrorBanner conditionnel
            saveButton(for: tx)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xl)
    }

    @ViewBuilder
    private func saveButton(for tx: Transaction) -> some View {
        let canSubmit = EditTransactionLogic.isFormValid(name: name, amount: amount, isLoading: isLoading)
        Button { Task { await save(for: tx) } } label: { Text("Enregistrer") }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)
    }

    private func hydrate(from tx: Transaction) {
        // assign @State from tx (idempotent — task(id:) re-fires si tx changes)
    }

    private func save(for tx: Transaction) async {
        // viewModel.updateTransaction(...) + toast + dismiss
    }
}
```

Notes idiom 2026 :

- Form rendu via subviews privées de la Page (`formContent(for:)`, `saveButton(for:)`), pas via type extrait. Match Apple sample code FoodTruck / Bookshelf.
- `task(id: tx.id)` au lieu de `onAppear` : re-fire automatique si la transaction est mutée externally (sync), pas de stale state.
- Helpers logiques dans `EditTransactionLogic` enum (pure functions), testables via Swift Testing sans bootstrap SwiftUI.

### `AddAllocatedTransactionPage.swift` + `AddAllocatedTransactionLogic.swift`

Même pattern : Page rend le form inline via subviews privées, helpers purs dans un enum dédié. Pas de `FormContent` intermédiaire. La page push appelle `viewModel.addTransaction(tx)` puis `dismiss()` (= pop) + toast.

### `PUL209VerifyHarness.swift`

Le harness debug pré-amorçait l'ouverture de `lineDetail` :

```swift
// Avant (BudgetDetailsView.applyPUL209VerifyPriming)
if let lineId = PUL209VerifyState.pendingOpenLineId,
   let line = viewModel.budgetLines.first(where: { $0.id == lineId }) {
    destination = .lineDetail(line)
}

// Après
if let lineId = PUL209VerifyState.pendingOpenLineId,
   viewModel.budgetLines.contains(where: { $0.id == lineId }) {
    appState.budgetPath.append(BudgetLinePushRoute.lineDetail(lineId: lineId))
}
```

Le debug overlay `PUL209VerifyState.pendingShowMenu` migre de `BudgetLineDetailSheet` à `BudgetLineDetailPage` (markup inchangé).

⚠️ Vérifier que le harness préserve son rôle : visual snapshot test passe encore. À ajuster si tests existants vérifient présence de sheet drag indicator.

## Edge cases

| Cas | Comportement attendu |
|---|---|
| Ligne supprimée pendant que la page lineDetail est ouverte | `budgetLine == nil` → auto `dismiss()` (pop). Toast soft-delete déjà émis par `viewModel.softDeleteBudgetLine`. |
| Edit transaction → save → retour à la liste de transactions | `dismiss()` pop la page edit. `viewModel.transactions` mis à jour reactively → liste se rafraîchit. Toast « Transaction modifiée ». |
| Add transaction → save → retour à la liste de transactions | Idem. Toast « Transaction ajoutée ». |
| Swipe delete transaction depuis lineDetail | Direct `viewModel.softDeleteTransaction(...)` + toast. Plus simple qu'avant : pas de pattern dismiss-then-toast. |
| Swipe toggle (pointer / dépointer) | Direct `viewModel.toggleTransaction(...)`. |
| Edit budget line depuis menu header | Callback `onEditLine` → parent set sheet `editBudgetLine`. Sheet sur page push = pattern HIG OK (sheet over content). |
| Delete budget line depuis menu header | Confirmation → `viewModel.softDeleteBudgetLine(...)` → `dismiss()` (pop) → toast. |
| Free tx edit (tap depuis racine `BudgetDetailsView`) | Push direct vers `EditTransactionPage`. Back swipe revient à `BudgetDetailsView`. |
| Tab switch pendant lineDetail ouvert | `appState.budgetPath` est state per-tab → préserve le stack au retour. |
| Deep link futur vers lineDetail | `appState.budgetPath = NavigationPath([...])` chaîné. À tester pour vérifier que `NavigationPath.append` mixe correctement `BudgetDestination` et `BudgetLinePushRoute`. |
| iOS 26 Liquid Glass toolbar push | Aucune config particulière, push transitions natives. |
| NavigationLink iOS 26 gesture conflict | Le row n'est pas un `NavigationLink` mais un `Button` qui appelle `.append(...)` programmatic → non concerné par le bug. |
| Tests UI (`PulpeUITests`) | Adapter assertions cherchant un drag indicator de sheet → chercher la nav bar back button. |
| Tests unit (`PulpeTests`) | `BudgetDetailsViewModel` non modifié → pas de régression attendue. |

## Plan d'exécution (4 phases / 4 commits)

### Phase 1 — Plumbing push

**Objectif** : la navigation push fonctionne, page stub.

1. Ajouter `BudgetLinePushRoute` dans `BudgetDetailsView.swift` (en bas du fichier).
2. Ajouter `.navigationDestination(for: BudgetLinePushRoute.self)` sur le body avec `.environment(viewModel)`.
3. Stub `BudgetLineDetailPage` qui rend `Text("WIP — \(lineId)")`.
4. Convertir `onTap` ligne (ligne 198) → `appState.budgetPath.append(BudgetLinePushRoute.lineDetail(...))`.
5. Build : `xcodebuild build -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' CODE_SIGNING_ALLOWED=NO`.
6. Smoke test : tap enveloppe, vérifier que la page stub apparaît en push.

### Phase 2 — Migration `BudgetLineDetailPage`

**Objectif** : la page lineDetail rend tout son contenu en push.

1. Renommer `BudgetLineDetailSheet.swift` → `BudgetLineDetailPage.swift` (`git mv`).
2. Drop `NavigationStack` interne, `standardSheetPresentation`, `SheetCloseButton`.
3. Adapter ownership : init prend `lineId` + `onEditLine`. ViewModel injecté via `@Environment(BudgetDetailsViewModel.self)`.
4. Auto-dismiss si `budgetLine == nil`.
5. Tap row + add button → `appState.budgetPath.append(...)` (destinations stub renvoient `Text("Edit/Add WIP")`).
6. Drop `BudgetLineDetailSheetWrapper` + `lineDetailSheet(for:)` dans `BudgetDetailsView`.
7. Drop case `.lineDetail` dans sheet enum.
8. Build + smoke test : navigation push, swipe actions (toggle, delete), header menu, delete budget line.

### Phase 3 — Pages push edit / add + free tx push

**Objectif** : édition, ajout et free tx fonctionnent en push, dead sheets supprimés.

1. Créer `EditTransactionLogic.swift` (pure helpers depuis l'ancienne `EditTransactionSheet`).
2. Créer `AddAllocatedTransactionLogic.swift` idem depuis `AddAllocatedTransactionSheet`.
3. Créer `EditTransactionPage` rendant le form inline via subviews privées (`formContent`, `saveButton`). `task(id: tx.id)` pour hydrater. ViewModel via `@Environment`.
4. Créer `AddAllocatedTransactionPage` idem.
5. Wire les deux dans `pushDestination(for:)` du `BudgetDetailsView`.
6. Convertir le tap free tx (ligne 222) → push `BudgetLinePushRoute.editTx(transactionId:)`.
7. Drop `EditTransactionSheet.swift` (orphelin).
8. Drop `AddAllocatedTransactionSheet.swift` (orphelin).
9. Drop cases `.addAllocatedTransaction` et `.editTransaction` dans sheet enum.
10. Drop `pendingTransactionDeletion` + `handleSheetDismiss` dans `BudgetDetailsView`.
11. Drop `onDismiss: handleSheetDismiss` argument du `.sheet(item:)` (devient `.sheet(item:) { sheetContent(for: $0) }`).
12. Build + tests E2E manuels :
    - tap enveloppe → tap tx → edit → save → retour liste tx (page lineDetail);
    - tap enveloppe → bouton « Ajouter une transaction » → fill → save → retour liste;
    - tap free tx (depuis racine `BudgetDetailsView`) → edit → save → retour racine;
    - error states (network down, validation);
    - back swipe à chaque niveau.

### Phase 4 — Harness, cleanup, validation

**Objectif** : tests verts, harness debug aligné, dead code éliminé.

1. Update `PUL209VerifyHarness` priming → push path.
2. Migrer le debug overlay `pendingShowMenu` de `BudgetLineDetailSheet` (renommé) à `BudgetLineDetailPage` (markup inchangé).
3. Run unit tests : `xcodebuild test -scheme PulpeLocal -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' -only-testing:PulpeTests CODE_SIGNING_ALLOWED=NO`.
4. Run UI smoke tests : `xcodebuild test -scheme PulpeUITests -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max,OS=26.2' CODE_SIGNING_ALLOWED=NO`. Adapter assertions sheet-related si besoin.
5. Visual check sur simulateur : flux complet sur iPhone 17 Pro Max iOS 26.
6. Run `pnpm quality` au root du workspace (sanity check).

## Risques et mitigations

| Risque | Mitigation |
|---|---|
| `viewModel` non visible depuis page enfant via env | `.environment(viewModel)` placé sur la destination view du resolver garantit la propagation. SwiftUI documenté : modifier appliqué à la view racine de la destination. |
| ViewModel re-instancié à chaque push | Non : `@State` dans `BudgetDetailsView` (qui reste dans le stack). L'env injection passe une référence, pas de copie. |
| `dismiss()` ambigu (pop vs sheet close) | `@Environment(\.dismiss)` est layer-aware : push context → pop, sheet context → close. Marche dans les deux. |
| Toolbar styling iOS 26 push | Pas de config particulière. À vérifier visuellement, ajuster si nécessaire. |
| Tests UI cassés (drag indicator absent) | Adapter assertions. Chercher nav bar back button au lieu de sheet drag indicator. |
| `editBudgetLine` sheet par-dessus push page | Pattern HIG OK : sheet over push content. Vérifier visuellement (drag indicator + medium detent par-dessus le push). |
| `NavigationPath` mixant deux types `Hashable` (`BudgetDestination` + `BudgetLinePushRoute`) | API supportée nativement (`NavigationPath` accepte n'importe quel `Hashable`). Test rapide en Phase 1 avec deep link manuel. |
| Suppression orpheline `EditTransactionSheet` casse un test | Grep `PulpeTests` + `PulpeUITests` avant suppression. Mettre à jour si besoin. |
| Toast double-fired (viewModel + page) | Définir une convention claire : toast émis dans le viewModel pour les opérations CRUD, jamais dans la page. Vérifier l'unicité après refactor. |

## Patterns SwiftUI 2026 appliqués

Récap des choix d'idiom retenus, avec justification et source.

| Pattern | Choix | Justification | Source |
|---|---|---|---|
| Modèle d'état partagé | `@Observable` class + `@State` au root + `@Environment(Type.self)` pour les enfants | Standard Observation framework iOS 17+. Tracking dépendances automatique : seules les pages qui lisent les propriétés mutées re-rendent. | [WWDC23 — Discover Observation in SwiftUI](https://developer.apple.com/videos/play/wwdc2023/10149/) |
| Bindings vers un Observable | `@Bindable var x = viewModel` localement quand un binding est nécessaire | API moderne iOS 17+. Pas besoin d'`@Binding` indirection. | WWDC23 + samples Apple |
| Injection vers une route push | `.environment(viewModel)` sur la destination view du `navigationDestination`, pas sur le body parent | Garantit la propagation dans la branche pushée. Le body parent n'atteint pas les vues du resolver. | [Apple — NavigationStack docs](https://developer.apple.com/documentation/SwiftUI/NavigationStack) |
| Routing | `NavigationPath` + enum `Hashable` typé par feature | API standard iOS 16+. Type-safe, préserve l'historique au tab-switch. | [Apple — NavigationStack docs](https://developer.apple.com/documentation/SwiftUI/NavigationStack) |
| Drill-down vs modal | Push pour drill-down hiérarchique + interactions fréquentes ; sheet pour tâche modale courte self-contained | HIG strict : push quand l'utilisateur "spend significant time" / "frequently navigate between content". | [HIG Modality](https://developer.apple.com/design/human-interface-guidelines/modality), [Frank Rausch — Modern iOS Navigation Patterns](https://frankrausch.com/ios-navigation/) |
| Composition de vue | Subviews privées via `@ViewBuilder private func` ou subview struct privée, pas de `…FormContent` type extrait | Sample code Apple 2024-2026 (FoodTruck, Bookshelf) montre cette composition. Un type extrait est over-engineering quand il a un seul consumer. | Apple sample code |
| Logique métier de form | Pure functions dans `enum` namespace (Pointfree-style) | Testables sans bootstrap SwiftUI. Découplé de la view. | Convention iOS / Pointfree |
| Async loading | `.task(id:)` keyed sur l'identité du model resolved | Cancellation + restart automatiques. Pas de `.onAppear { Task { } }`. | [Apple — task(id:)](https://developer.apple.com/documentation/swiftui/view/task(id:priority:_:)) |
| Dismissal | `@Environment(\.dismiss)` partout | Layer-aware : pop dans push context, close dans sheet context. | Apple — dismiss docs |
| Toast post-CRUD | Émis depuis le viewModel ou inline, AVANT `dismiss()`. `ToastManager` dans env, persiste après pop. | Évite race conditions. ToastManager est global, indépendant du lifecycle de la page. | Convention interne Pulpe |
| Sheet presentation | `.sheet(item:)` (vs `isPresented`) avec enum discriminé | Rebind automatique sur changement de model, pas de stale data. | [SwiftUI sheet(item:)](https://developer.apple.com/documentation/swiftui/view/sheet(item:ondismiss:content:)) |
| Sheet over push | OK pour modal task courte (edit budget line). Sheet over content = HIG-compliant. | HIG : sheet est self-contained, push reste visible derrière le dimming. | HIG Modality |
| Reactivity sur model par ID | Computed property `viewModel.transactions.first { $0.id == id }` | Reactive : Observation track la liste, recompute si elle change. Auto-dismiss si nil (model supprimé). | WWDC23 Observation |

## Sources

- [Modern iOS Navigation Patterns — Frank Rausch](https://frankrausch.com/ios-navigation/)
- [Explore navigation design for iOS — WWDC22](https://developer.apple.com/videos/play/wwdc2022/10001/)
- [Human Interface Guidelines — Apple Developer](https://developer.apple.com/design/human-interface-guidelines)
- [SwiftUI Liquid Glass sheets with NavigationStack and Form — Nil Coalescing](https://nilcoalescing.com/blog/LiquidGlassSheetsWithNavigationStackAndForm/)
- [NavigationStack — Apple Developer Documentation](https://developer.apple.com/documentation/SwiftUI/NavigationStack)
- [Discover Observation in SwiftUI — WWDC23](https://developer.apple.com/videos/play/wwdc2023/10149/)

## Décisions baked-in

1. ✅ Full page push partout : `lineDetail`, `addAllocatedTx`, `editTx`, free tx edit.
2. ✅ Edit budget line reste sheet (modal task courte).
3. ✅ ViewModel sharing via `@Environment` injection (idiom 2026 Swift, Observation framework).
4. ✅ `EditTransactionSheet` et `AddAllocatedTransactionSheet` supprimés après migration.
5. ✅ Pas de `…FormContent` type extrait : composition par subviews privées dans la Page.
6. ✅ Logique de form en pure helpers (`enum EditTransactionLogic`), testables sans bootstrap SwiftUI.
7. ✅ `task(id:)` keyed sur identité du model pour hydratation et restart automatique.
8. ✅ Toast émis avant `dismiss()`, persistance via `ToastManager` global env.
