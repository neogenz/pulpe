# Implementation Plan: iOS Budget Widgets

## Overview

Créer deux types de widgets iOS pour l'application Pulpe :
1. **CurrentMonthWidget** (Small/Medium) : Montant "Disponible à dépenser" + bouton `+` interactif
2. **YearOverviewWidget** (Large) : Vue des 12 mois de l'année avec le montant disponible de chacun

**Décisions utilisateur :**
- Deep link → Ouvre le formulaire d'ajout de dépense directement
- Pas de widgets Lock Screen (Home Screen uniquement)

**Approche technique :**
- App Groups pour partager données entre app et widget
- UserDefaults encodé pour le cache des données budget
- App Intent avec `openAppWhenRun = true` pour le bouton interactif
- Sources partagées (pas de framework séparé) pour simplicité

## Dependencies

**Ordre d'implémentation obligatoire :**
1. Configuration projet (entitlements, project.yml) → Prérequis pour tout
2. Data coordinator + modèles widget → Base du système de données
3. Modifications app principale → Alimenter le widget
4. Widget extension → Consommer les données
5. Tests manuels sur simulateur

## File Changes

### Phase 1: Configuration Projet

#### `ios/Pulpe/Pulpe.entitlements` (CRÉER)
- Créer fichier XML entitlements
- Ajouter capability `com.apple.security.application-groups`
- Groupe : `group.app.pulpe.ios`
- Ce fichier active App Groups pour l'app principale

#### `ios/PulpeWidget/PulpeWidget.entitlements` (CRÉER)
- Créer fichier XML entitlements identique à l'app principale
- Même groupe `group.app.pulpe.ios`
- Permet au widget d'accéder aux données partagées

#### `ios/project.yml`
- Ajouter `entitlements` à la target Pulpe existante
  - `path: Pulpe/Pulpe.entitlements`
  - Propriété `com.apple.security.application-groups: [group.app.pulpe.ios]`
- Ajouter URL scheme pour deep linking dans `info.properties`
  - `CFBundleURLTypes` avec scheme `pulpe`
- Ajouter nouvelle target `PulpeWidget`
  - `type: app-extension`
  - `platform: iOS`
  - `deploymentTarget: "17.0"`
  - `sources: [PulpeWidget, Pulpe/Domain/Models, Pulpe/Domain/Formulas, Pulpe/Shared/Extensions, Pulpe/Core/Config]`
  - `dependencies: sdk: WidgetKit.framework, sdk: SwiftUI.framework`
  - `entitlements: path: PulpeWidget/PulpeWidget.entitlements`
  - `settings.PRODUCT_BUNDLE_IDENTIFIER: app.pulpe.ios.widget`
  - `settings.SKIP_INSTALL: true`
  - `info.properties.NSExtension.NSExtensionPointIdentifier: com.apple.widgetkit-extension`
- Ajouter target `PulpeWidget` comme dépendance embedded de `Pulpe`
- Ajouter scheme `PulpeWidget` pour debug

---

### Phase 2: Data Layer Partagé

#### `ios/PulpeWidget/Models/BudgetWidgetData.swift` (CRÉER)
- Struct `BudgetWidgetData: Codable, Sendable`
  - `id: String`
  - `month: Int, year: Int`
  - `available: Decimal` (montant disponible à dépenser)
  - `monthName: String` (nom français du mois)
  - `isCurrentMonth: Bool`
- Struct `WidgetDataCache: Codable, Sendable`
  - `currentMonth: BudgetWidgetData?`
  - `yearBudgets: [BudgetWidgetData]` (12 mois de l'année courante)
  - `lastUpdated: Date`
- Pattern : Données pré-calculées pour éviter les calculs dans le widget

#### `ios/PulpeWidget/Services/WidgetDataCoordinator.swift` (CRÉER)
- Struct `WidgetDataCoordinator` (pas actor car sync)
- Constante `appGroupId = "group.app.pulpe.ios"`
- Property `sharedDefaults = UserDefaults(suiteName: appGroupId)`
- Méthode `save(_ cache: WidgetDataCache)` → encode JSON et stocke
- Méthode `load() -> WidgetDataCache?` → décode depuis UserDefaults
- Clé de stockage : `"widget_budget_cache"`
- Pattern: Follow existing Decimal+Extensions for currency formatting

---

### Phase 3: App Principale - Modifications

#### `ios/Pulpe/App/PulpeApp.swift`
- Importer WidgetKit
- Ajouter `@State private var deepLinkDestination: DeepLinkDestination?`
- Enum `DeepLinkDestination: Hashable` avec case `.addExpense(budgetId: String?)`
- Ajouter `.onOpenURL { url in }` sur WindowGroup
  - Parser `pulpe://add-expense` → `.addExpense(budgetId: nil)`
  - Parser `pulpe://add-expense?budgetId=xxx` → `.addExpense(budgetId: xxx)`
- Passer `deepLinkDestination` binding à RootView via environment
- Dans RootView, quand authenticated et deepLinkDestination != nil :
  - Présenter sheet TransactionFormView pour ajout dépense
  - Reset deepLinkDestination après présentation

#### `ios/Pulpe/App/AppState.swift`
- Ajouter méthode `refreshWidgetData()` → public, appelable après modifications
- Dans cette méthode :
  - Appeler `WidgetCenter.shared.reloadAllTimelines()`
- Cette méthode sera appelée depuis les ViewModels après CRUD

#### `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift`
- Importer WidgetKit dans le ViewModel
- Après chaque opération CRUD réussie (loadData, create, update, delete) :
  - Appeler helper pour sauvegarder dans App Group
  - Appeler `WidgetCenter.shared.reloadAllTimelines()`

#### `ios/Pulpe/Domain/Services/WidgetDataSyncService.swift` (CRÉER)
- Actor `WidgetDataSyncService`
- `static let shared = WidgetDataSyncService()`
- Private `coordinator = WidgetDataCoordinator()`
- Méthode `sync(budgets: [Budget], currentBudgetDetails: BudgetDetails?)` :
  - Calculer metrics via BudgetFormulas pour chaque budget
  - Créer BudgetWidgetData pour le mois courant
  - Créer tableau des 12 mois de l'année courante
  - Sauvegarder via coordinator
  - Appeler `WidgetCenter.shared.reloadAllTimelines()`
- Cette méthode encapsule toute la logique de sync

---

### Phase 4: Widget Extension

#### `ios/PulpeWidget/PulpeWidgetBundle.swift` (CRÉER)
- `@main` struct `PulpeWidgetBundle: WidgetBundle`
- `var body: some Widget` retourne :
  - `CurrentMonthWidget()`
  - `YearOverviewWidget()`

#### `ios/PulpeWidget/Intents/AddExpenseIntent.swift` (CRÉER)
- Import AppIntents
- Struct `AddExpenseIntent: AppIntent`
- `static let title: LocalizedStringResource = "Ajouter une dépense"`
- `static let openAppWhenRun = true` → ouvre l'app
- `func perform() async throws -> some IntentResult`
  - Retourner `.result()` - l'ouverture de l'app est automatique
  - L'URL scheme sera configurée dans le widget view

#### `ios/PulpeWidget/Widgets/CurrentMonth/CurrentMonthEntry.swift` (CRÉER)
- Struct `CurrentMonthEntry: TimelineEntry`
  - `let date: Date`
  - `let available: Decimal`
  - `let monthName: String`
  - `let budgetId: String?`
  - `let hasData: Bool` (pour afficher placeholder si pas de données)
- Conformer à Sendable

#### `ios/PulpeWidget/Widgets/CurrentMonth/CurrentMonthProvider.swift` (CRÉER)
- Struct `CurrentMonthProvider: TimelineProvider`
- `typealias Entry = CurrentMonthEntry`
- `func placeholder(in context: Context) -> Entry`
  - Retourner entry avec données exemple (CHF 1'500.00, "Janvier")
- `func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void)`
  - Lire depuis WidgetDataCoordinator
  - Si données trouvées → entry avec données réelles
  - Sinon → placeholder
  - Ne PAS faire de requête réseau
- `func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void)`
  - Lire depuis WidgetDataCoordinator
  - Créer entry avec données du mois courant
  - Policy: `.after(nextHour)` pour rafraîchir toutes les heures
  - Si pas de données : `.after(Date(timeIntervalSinceNow: 300))` retry dans 5min

#### `ios/PulpeWidget/Widgets/CurrentMonth/CurrentMonthWidgetView.swift` (CRÉER)
- Struct `CurrentMonthWidgetView: View`
- `var entry: CurrentMonthEntry`
- `@Environment(\.widgetFamily) var family`
- Body différent selon `family` :
  - `.systemSmall` : Montant disponible centré, texte "Disponible" en caption
  - `.systemMedium` : Montant à gauche + bouton `+` à droite
- Utiliser `containerBackground(for: .widget)` pour le fond
- Bouton via `Button(intent: AddExpenseIntent()) { ... }`
- URL widget via `.widgetURL(URL(string: "pulpe://add-expense"))`
- Textes UI en français ("Disponible à dépenser", "Ajouter")
- Utiliser `.asCHF` pour formater le montant

#### `ios/PulpeWidget/Widgets/CurrentMonth/CurrentMonthWidget.swift` (CRÉER)
- Struct `CurrentMonthWidget: Widget`
- `let kind = "CurrentMonthWidget"`
- Body: `StaticConfiguration(kind: kind, provider: CurrentMonthProvider()) { ... }`
- `.configurationDisplayName("Budget du mois")`
- `.description("Affiche le montant disponible à dépenser")`
- `.supportedFamilies([.systemSmall, .systemMedium])`

#### `ios/PulpeWidget/Widgets/YearOverview/YearOverviewEntry.swift` (CRÉER)
- Struct `YearOverviewEntry: TimelineEntry`
  - `let date: Date`
  - `let year: Int`
  - `let months: [MonthData]` (12 éléments)
- Struct `MonthData: Identifiable, Sendable`
  - `id: String` (budgetId ou "month-X")
  - `month: Int`
  - `shortName: String` ("Jan", "Fév", etc.)
  - `available: Decimal?` (nil si pas de budget)
  - `isCurrentMonth: Bool`

#### `ios/PulpeWidget/Widgets/YearOverview/YearOverviewProvider.swift` (CRÉER)
- Struct `YearOverviewProvider: TimelineProvider`
- `typealias Entry = YearOverviewEntry`
- `func placeholder(in context: Context) -> Entry`
  - 12 mois avec données exemple variées
- `func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void)`
  - Lire yearBudgets depuis WidgetDataCoordinator
  - Mapper vers MonthData
- `func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void)`
  - Même logique que snapshot
  - Policy: `.after(nextHour)`

#### `ios/PulpeWidget/Widgets/YearOverview/YearOverviewWidgetView.swift` (CRÉER)
- Struct `YearOverviewWidgetView: View`
- `var entry: YearOverviewEntry`
- Layout : Grille 4×3 (4 colonnes, 3 lignes)
- Chaque cellule affiche :
  - Nom court du mois (Jan, Fév...)
  - Montant disponible ou "—" si pas de budget
  - Highlight visuel si mois courant (fond accent)
- Utiliser `LazyVGrid` avec `GridItem(.flexible())` ×4
- `.widgetURL(URL(string: "pulpe://budget"))` pour ouvrir l'app
- Utiliser `.asCompactCHF` pour montants (format compact)

#### `ios/PulpeWidget/Widgets/YearOverview/YearOverviewWidget.swift` (CRÉER)
- Struct `YearOverviewWidget: Widget`
- `let kind = "YearOverviewWidget"`
- Body: `StaticConfiguration(kind: kind, provider: YearOverviewProvider()) { ... }`
- `.configurationDisplayName("Vue annuelle")`
- `.description("Affiche les 12 mois de l'année")`
- `.supportedFamilies([.systemLarge])`

---

### Phase 5: Info.plist Widget

#### `ios/PulpeWidget/Info.plist` (CRÉER)
- Via project.yml `info.properties` :
  - `NSExtension.NSExtensionPointIdentifier: com.apple.widgetkit-extension`
- XcodeGen générera automatiquement le plist

---

## Testing Strategy

### Tests Manuels

1. **Après Phase 1** : `xcodegen generate` puis build - vérifier compilation sans erreur
2. **Après Phase 2** : Unit test du WidgetDataCoordinator (encode/decode)
3. **Après Phase 3** :
   - Ouvrir l'app, naviguer dans budgets
   - Vérifier que les données sont sauvées (print/log)
   - Tester deep link `pulpe://add-expense` via Simulator
4. **Après Phase 4** :
   - Ajouter widget sur Home Screen du simulateur
   - Vérifier affichage des données
   - Tester tap sur widget (ouvre app)
   - Tester bouton `+` (ouvre formulaire)

### Tests Automatisés (optionnel)

- **`ios/PulpeWidget/Tests/WidgetDataCoordinatorTests.swift`** (optionnel)
  - Test save/load cycle
  - Test données vides
  - Test données corrompues

---

## Documentation

Aucune documentation formelle requise. Les widgets sont auto-explicatifs pour l'utilisateur.

---

## Rollout Considerations

### Prérequis

1. **Development Team** : Doit être configuré dans project.yml pour signer le widget
2. **App Groups capability** : Doit être activé dans Apple Developer Portal
3. **Provisioning Profiles** : Régénérer après ajout App Groups

### Génération Projet

Après toutes les modifications :
```bash
cd ios
xcodegen generate
open Pulpe.xcodeproj
```

### Points d'Attention

- **Premier lancement** : Widget affichera placeholder jusqu'à ce que l'utilisateur ouvre l'app
- **Pas de requête réseau dans widget** : Toutes les données viennent du cache App Group
- **Rafraîchissement limité** : iOS limite à ~40-70 refresh/jour, le widget ne sera pas temps réel
- **Mémoire** : Les widgets ont une limite mémoire stricte, éviter les images lourdes

---

## Structure Finale des Fichiers

```
ios/
├── Pulpe/
│   ├── Pulpe.entitlements                    # NOUVEAU
│   ├── App/
│   │   ├── PulpeApp.swift                    # MODIFIÉ (deep link)
│   │   └── AppState.swift                    # MODIFIÉ (refresh widget)
│   ├── Domain/
│   │   └── Services/
│   │       └── WidgetDataSyncService.swift   # NOUVEAU
│   └── Features/
│       └── CurrentMonth/
│           └── CurrentMonthView.swift        # MODIFIÉ (sync widget)
├── PulpeWidget/
│   ├── PulpeWidget.entitlements              # NOUVEAU
│   ├── PulpeWidgetBundle.swift               # NOUVEAU
│   ├── Models/
│   │   └── BudgetWidgetData.swift            # NOUVEAU
│   ├── Services/
│   │   └── WidgetDataCoordinator.swift       # NOUVEAU
│   ├── Intents/
│   │   └── AddExpenseIntent.swift            # NOUVEAU
│   └── Widgets/
│       ├── CurrentMonth/
│       │   ├── CurrentMonthWidget.swift      # NOUVEAU
│       │   ├── CurrentMonthEntry.swift       # NOUVEAU
│       │   ├── CurrentMonthProvider.swift    # NOUVEAU
│       │   └── CurrentMonthWidgetView.swift  # NOUVEAU
│       └── YearOverview/
│           ├── YearOverviewWidget.swift      # NOUVEAU
│           ├── YearOverviewEntry.swift       # NOUVEAU
│           ├── YearOverviewProvider.swift    # NOUVEAU
│           └── YearOverviewWidgetView.swift  # NOUVEAU
└── project.yml                               # MODIFIÉ
```

---

## Prochaine Étape

Exécuter `/epct:code 28-ios-budget-widgets` pour implémenter le plan.
