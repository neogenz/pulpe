# Task: iOS Budget Widgets

Créer des widgets iOS pour l'application Pulpe permettant :
1. **Widget petit/moyen** : Afficher le montant disponible du mois courant + bouton d'ajout rapide de dépense
2. **Widget large** : Vue des 12 mois de l'année courante avec le montant de chacun

## Codebase Context

### Architecture du Projet iOS

Le projet iOS est une application SwiftUI pure utilisant les patterns iOS 17+ modernes :

| Aspect | Détails |
|--------|---------|
| **Architecture** | App/ → Features/ → Domain/ → Core/ |
| **State** | `@Observable` (iOS 17+, pas ObservableObject) |
| **Services** | Actors avec `.shared` singletons |
| **Concurrency** | Swift 6 strict, tous les modèles sont `Sendable` |
| **UI** | SwiftUI uniquement, pas d'UIKit |
| **Dependencies** | Supabase SDK + Lottie uniquement |
| **Bundle ID** | `app.pulpe.ios` |

### Fichiers Clés

#### Modèles de Données
- **`ios/Pulpe/Domain/Models/Budget.swift:4-17`** - Modèle Budget (id, month, year, remaining, rollover, etc.)
- **`ios/Pulpe/Domain/Models/Transaction.swift:4-15`** - Modèle Transaction (id, budgetId, name, amount, kind, date)
- **`ios/Pulpe/Domain/Models/BudgetLine.swift:4-16`** - Lignes budgétaires
- **`ios/Pulpe/Domain/Models/TransactionEnums.swift:4-54`** - Enums (TransactionKind, TransactionRecurrence)

#### Calculs & Formules
- **`ios/Pulpe/Domain/Formulas/BudgetFormulas.swift:8-29`** - Struct `Metrics` avec totalIncome, totalExpenses, available, remaining, rollover
- **`ios/Pulpe/Domain/Formulas/BudgetFormulas.swift:171-191`** - `calculateAllMetrics()` - calcul optimisé one-shot

#### Réseau & Auth
- **`ios/Pulpe/Core/Network/APIClient.swift:4-223`** - Actor APIClient avec gestion token
- **`ios/Pulpe/Core/Auth/KeychainManager.swift:5-224`** - Stockage sécurisé des tokens
- **`ios/Pulpe/Core/Auth/AuthService.swift:6-189`** - Authentification Supabase directe
- **`ios/Pulpe/Core/Config/AppConfiguration.swift:7-72`** - URLs API selon environnement

#### Services
- **`ios/Pulpe/Domain/Services/BudgetService.swift:16-18`** - `getAllBudgets()`
- **`ios/Pulpe/Domain/Services/BudgetService.swift:58-64`** - `getCurrentMonthBudget()`

#### Extensions Utilitaires
- **`ios/Pulpe/Shared/Extensions/Decimal+Extensions.swift:4-7`** - `.asCHF` formatage monétaire
- **`ios/Pulpe/Shared/Extensions/Decimal+Extensions.swift:9-13`** - `.asCompactCHF` format compact

### État Actuel

**Points importants :**
- ❌ **Aucune extension widget** n'existe actuellement
- ❌ **Aucun App Group** configuré (requis pour partager données app ↔ widget)
- ❌ **Pas de fichier entitlements** (à créer)
- ✅ Keychain déjà utilisé pour les tokens (service: `app.pulpe.ios`)
- ✅ Formules de calcul budget déjà portées depuis TypeScript

### Configuration Projet (project.yml)

```yaml
# ios/project.yml:35-77
targets:
  Pulpe:
    type: application
    platform: iOS
    deploymentTarget: "17.0"
    sources: [Pulpe]
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: app.pulpe.ios
    dependencies:
      - package: supabase-swift
      - package: lottie-spm
```

**À ajouter :** Target widget extension avec App Group partagé.

## Documentation Insights

### WidgetKit Framework (iOS 17+)

#### Architecture Widget

```swift
// TimelineEntry - Données pour un moment donné
struct BudgetEntry: TimelineEntry {
    let date: Date
    let available: Decimal
    let monthName: String
}

// TimelineProvider - Fournit les données
struct BudgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> BudgetEntry { ... }
    func getSnapshot(in context: Context, completion: @escaping (BudgetEntry) -> Void) { ... }
    func getTimeline(in context: Context, completion: @escaping (Timeline<BudgetEntry>) -> Void) { ... }
}

// Widget - Configuration
struct PulpeBudgetWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BudgetWidget", provider: BudgetProvider()) { entry in
            BudgetWidgetView(entry: entry)
        }
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
```

#### Tailles de Widget

| Famille | Dimensions | Usage Recommandé |
|---------|------------|------------------|
| `.systemSmall` | 169×169 pts | Montant disponible + bouton |
| `.systemMedium` | 338×169 pts | Montant + catégories top |
| `.systemLarge` | 338×338 pts | Vue 12 mois |
| `.accessoryCircular` | 40×40 pts | Lock screen - valeur |
| `.accessoryRectangular` | 84×36 pts | Lock screen - texte |

### Interactive Widgets (iOS 17+)

**Bouton avec App Intent :**

```swift
import AppIntents

struct AddExpenseIntent: AppIntent {
    static let title: LocalizedStringResource = "Ajouter dépense"
    static let openAppWhenRun = true  // Ouvre l'app

    func perform() async throws -> some IntentResult {
        // Deep link vers l'écran d'ajout
        return .result()
    }
}

// Dans la vue widget
Button(intent: AddExpenseIntent()) {
    Label("Ajouter", systemImage: "plus.circle.fill")
}
```

### Data Sharing (App Groups)

**Configuration requise :**

1. **Entitlements** : Ajouter `com.apple.security.application-groups` avec `group.app.pulpe.ios`
2. **Keychain Sharing** : Ajouter `kSecAttrAccessGroup` pour partager tokens

```swift
// Écriture depuis l'app principale
let sharedDefaults = UserDefaults(suiteName: "group.app.pulpe.ios")
sharedDefaults?.set(budgetData, forKey: "current_budget")

// Lecture dans le widget
let sharedDefaults = UserDefaults(suiteName: "group.app.pulpe.ios")
let budgetData = sharedDefaults?.data(forKey: "current_budget")
```

### Timeline Refresh Policies

```swift
// Rafraîchissement après la dernière entrée
Timeline(entries: entries, policy: .atEnd)

// Rafraîchissement à une date précise
Timeline(entries: entries, policy: .after(nextHour))

// Jamais de rafraîchissement auto (config utilisateur)
Timeline(entries: entries, policy: .never)
```

**Budget système :** ~40-70 rafraîchissements/jour maximum.

## Research Findings

### Best Practices 2025-2026

1. **Swift 6 Concurrency**
   - Tous les modèles doivent être `Sendable`
   - Utiliser `async let` pour le fetch parallèle
   - `@MainActor` sur `perform()` des intents pour UI updates

2. **Performance**
   - Timeout de 10s sur les requêtes réseau
   - Cache local avec TTL (1-5 min) pour `snapshot()`
   - Ne jamais faire de requête réseau dans `snapshot()`

3. **Interactive Widgets**
   - Utiliser `Button(intent:)` pour les actions
   - `openAppWhenRun = true` pour deep link vers formulaire
   - `WidgetCenter.shared.reloadAllTimelines()` après modifications

4. **Data Sharing Patterns**

| Type de donnée | Méthode | Raison |
|----------------|---------|--------|
| Budget state | UserDefaults + App Group | Simple, rapide |
| Auth tokens | Keychain partagé | Sécurisé |
| Cache API | UserDefaults encodé | Données non sensibles |

### Design Guidelines Apple

- **Typographie** : System font, 11pt minimum
- **Espacement** : 12-16pt entre sections
- **Contraste** : 4.5:1 minimum pour texte
- **Simplicité** : 3-5 métriques max par widget

## Key Files to Create/Modify

### Nouveaux Fichiers (Extension Widget)

```
ios/
├── PulpeWidget/
│   ├── PulpeWidgetBundle.swift          # Entry point
│   ├── Providers/
│   │   ├── CurrentMonthProvider.swift    # Provider widget petit/moyen
│   │   └── YearOverviewProvider.swift    # Provider widget large
│   ├── Views/
│   │   ├── CurrentMonthWidgetView.swift  # Vue disponible + bouton
│   │   └── YearOverviewWidgetView.swift  # Vue 12 mois
│   ├── Intents/
│   │   └── AddExpenseIntent.swift        # Intent bouton ajout
│   └── Shared/
│       └── WidgetDataCoordinator.swift   # Accès données partagées
```

### Fichiers à Modifier

1. **`ios/project.yml`** - Ajouter target widget extension + App Group
2. **`ios/Pulpe/Pulpe.entitlements`** (à créer) - App Groups capability
3. **`ios/Pulpe/Core/Auth/KeychainManager.swift`** - Ajouter access group partagé
4. **`ios/Pulpe/App/PulpeApp.swift`** - Sauvegarder données pour widget

### Code à Réutiliser

| Source | Usage Widget |
|--------|--------------|
| `BudgetFormulas.swift` | Calculs metrics (copier dans shared) |
| `Decimal+Extensions.swift` | Formatage `.asCHF` |
| `Budget.swift`, `Transaction.swift` | Modèles données |
| `TransactionEnums.swift` | Types transaction |
| `AppConfiguration.swift` | URLs API |

## Patterns to Follow

### Pattern Actor (existant)

```swift
// Tous les services sont des actors
actor WidgetDataService {
    static let shared = WidgetDataService()

    func getCurrentMonthBudget() async throws -> Budget { ... }
}
```

### Pattern @Observable State

```swift
// iOS 17+ utilise @Observable, pas ObservableObject
@Observable
final class WidgetViewModel {
    var budget: Budget?
    var isLoading = false
}
```

### Pattern Sendable Models

```swift
// Tous les modèles doivent être Sendable
struct BudgetWidgetData: Codable, Sendable {
    let available: Decimal
    let monthName: String
}
```

### Pattern UI Français / Code Anglais

```swift
// Labels UI en français
Text("Disponible à dépenser")
Text("Ajouter une dépense")

// Code en anglais
let availableAmount = metrics.available
let addExpenseIntent = AddExpenseIntent()
```

## Dependencies

### Prérequis Techniques

1. **iOS 17.0+** minimum (déjà configuré)
2. **App Groups capability** à activer
3. **Keychain Sharing** à configurer
4. **Widget Extension target** à créer dans project.yml

### Dépendances Logiques

1. L'app principale doit sauvegarder les données budget dans le container partagé
2. Le widget doit pouvoir lire les tokens d'auth pour appeler l'API
3. Le deep link doit router vers l'écran d'ajout de dépense

## Questions à Clarifier

1. **Devise** : CHF uniquement ou supporter plusieurs devises ?
2. **Offline** : Afficher dernières données en cache si pas de connexion ?
3. **Lock Screen** : Supporter aussi les widgets lock screen (accessory) ?
4. **Rafraîchissement** : Quelle fréquence de mise à jour souhaitée ?

## Architecture Proposée

```
┌─────────────────────────────────────────────────────────────┐
│                     App Principale                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ BudgetService → Sauvegarde dans App Group Container │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                    App Group Container
                    (group.app.pulpe.ios)
                           │
┌─────────────────────────────────────────────────────────────┐
│                    Widget Extension                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WidgetDataCoordinator → Lit depuis App Group        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Small Widget │  │ Medium Widget│  │  Large Widget    │  │
│  │ (Disponible) │  │ (+ Bouton)   │  │  (12 mois)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prochaine Étape

Exécuter `/epct:plan 28-ios-budget-widgets` pour créer le plan d'implémentation détaillé.
