# Plan de Refactoring - Architecture Auth iOS

> **Objectif** : Rendre le code immédiatement lisible pour un dev iOS senior, corriger les incohérences de stabilité au cold-start, et aligner sur les best practices SwiftUI 2025/2026 — tout en conservant la parité fonctionnelle.

---

## Vue d'ensemble de l'architecture actuelle

### Points forts (à conserver)

| Pattern | Évaluation | Commentaire |
|---------|------------|-------------|
| `@Observable @MainActor` | ✅ Excellent | Conforme iOS 17+, pas de `ObservableObject` legacy |
| Coordinators (Session, Recovery, Startup) | ✅ Bon | Séparation claire, résultats typés |
| State Machine (AppFlowState/Event/Reducer) | ✅ Solide | Transitions déterministes, testable |
| Biometric token preservation au logout | ✅ Avancé | Fast re-login via Face ID |
| Privacy Shield | ✅ Conforme | App switcher protégé |
| Keychain separation (regular vs biometric) | ✅ Sécurisé | Bonne isolation des credentials |

### Problèmes identifiés

| # | Sévérité | Problème | Impact |
|---|----------|----------|--------|
| 1 | 🔴 Critique | **Setters computed avec side-effects** (`isRecoveryConsentVisible`) | Fragile, effets inattendus |
| 2 | 🔴 Critique | **AppState trop gros** (411 lignes + 6 extensions ~600 lignes) | Difficile à maintenir |
| 3 | 🟠 Important | **Dual routing system** (`AuthStatus` + `AppFlowState` + `AppRoute`) | Confusion, duplication |
| 4 | 🟠 Important | **RootView monstre** (467 lignes) avec trop de responsabilités | Code spaghetti |
| 5 | 🟠 Important | **Navigation couplée à AppState** (`budgetPath`, `templatePath`) | Violation SRP |
| 6 | 🟡 Modéré | **Convenience init complexe** (40+ paramètres optionnels) | Tests difficiles |
| 7 | 🟡 Modéré | **Deep link handling dispersé** | Logique éparpillée |
| 8 | 🟡 Modéré | **Pas de documentation architecture** | Onboarding difficile |

---

## Phase 1 : Stabilisation (Parité fonctionnelle, zéro régression)

### 1.1 Supprimer les setters computed avec side-effects

**Fichier** : `AppState.swift:111-119`

**Problème** :
```swift
var isRecoveryConsentVisible: Bool {
    get { recoveryFlowCoordinator.isRecoveryConsentVisible }
    set { if !newValue { recoveryFlowCoordinator.setIdle() } }  // ← Side effect!
}
```

**Solution** :
```swift
// Read-only computed property
var isRecoveryConsentVisible: Bool {
    recoveryFlowCoordinator.isRecoveryConsentVisible
}

// Explicit method for dismissal
func dismissRecoveryConsent() {
    recoveryFlowCoordinator.setIdle()
}
```

**Impact dans RootView** : Remplacer `$appState.isRecoveryConsentVisible` par un binding manuel ou utiliser `.onChange`.

### 1.2 Extraire la navigation de AppState

**Créer** : `NavigationState.swift`

```swift
@Observable @MainActor
final class NavigationState {
    var selectedTab: Tab = .currentMonth
    var budgetPath = NavigationPath()
    var templatePath = NavigationPath()

    func resetPaths() {
        budgetPath = NavigationPath()
        templatePath = NavigationPath()
    }

    func navigateToBudget(_ id: String) {
        budgetPath = NavigationPath()
        budgetPath.append(BudgetDestination.details(budgetId: id))
        selectedTab = .budgets
    }
}
```

**Supprimer de AppState** : `selectedTab`, `budgetPath`, `templatePath`, `Tab`, `BudgetDestination`, `TemplateDestination`.

### 1.3 Unifier le système de routing

**Problème actuel** : 3 layers de routing coexistent :
- `AuthStatus` (legacy) : `.loading`, `.unauthenticated`, `.needsPinSetup`, etc.
- `AppFlowState` (nouveau) : `.initializing`, `.locked(reason)`, `.securitySetup(phase)`, etc.
- `AppRoute` : dérivé de `AppFlowState`

**Stratégie** : Garder `AppFlowState` comme source de vérité, éliminer progressivement `AuthStatus`.

**Étape 1** : Rendre `AuthStatus` privé, exposer uniquement `flowState` et `currentRoute`.

```swift
// AppState.swift
private(set) var _authStatus: AuthStatus = .loading

var authState: AuthStatus {
    get { _authStatus }
}

// Mutations only via typed events
func transition(to state: AppFlowState) {
    // ... apply via reducer
}
```

---

## Phase 2 : Refactoring structurel (Amélioration maintenabilité)

### 2.1 Restructurer AppState en modules cohérents

**Structure cible** :

```
App/
├── State/
│   ├── AppState.swift              # Core state + public API (< 200 lignes)
│   ├── AppState+Lifecycle.swift    # start(), bootstrap(), foreground/background
│   ├── AppState+Auth.swift         # login(), logout(), PIN flows
│   ├── AppState+Recovery.swift     # Recovery key consent/generation
│   └── AppState+Events.swift       # send(event:) implementation
├── Coordinators/
│   ├── SessionLifecycleCoordinator.swift
│   ├── StartupCoordinator.swift
│   ├── RecoveryFlowCoordinator.swift
│   └── OnboardingBootstrapper.swift
├── Flow/
│   ├── AppFlowState.swift
│   ├── AppFlowEvent.swift
│   ├── AppFlowReducer.swift
│   └── AppRoute.swift
├── Navigation/
│   ├── NavigationState.swift
│   └── DeepLinkHandler.swift
└── Root/
    ├── PulpeApp.swift              # Entry point only (< 50 lignes)
    └── RootView.swift              # Route switching (< 150 lignes)
```

### 2.2 Extraire RootView en composants

**Problème** : `RootView` fait 467 lignes avec :
- Route switching
- Deep link handling
- Scene phase handling
- Recovery key modals
- Privacy shield
- Widget sync
- Multiple sheets

**Solution** : Décomposer en ViewModifiers et sous-vues :

```swift
// RootView.swift (simplifié)
struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        RouteContentView()
            .modifier(PrivacyShieldModifier())
            .modifier(RecoveryKeyModalsModifier())
            .modifier(DeepLinkHandlerModifier())
            .modifier(ScenePhaseHandlerModifier())
            .modifier(ToastOverlayModifier())
    }
}
```

**Nouveaux fichiers** :
- `RouteContentView.swift` : Switch sur `currentRoute`
- `PrivacyShieldModifier.swift` : Overlay + logique
- `RecoveryKeyModalsModifier.swift` : Alerts + sheets recovery
- `DeepLinkHandlerModifier.swift` : `onOpenURL` + processing
- `ScenePhaseHandlerModifier.swift` : Background/foreground handling

### 2.3 Simplifier AppStateDependencies

**Problème** : 40+ paramètres optionnels dans le convenience init.

**Solution** : Builder pattern + presets pour tests.

```swift
// AppStateDependencies+Presets.swift
extension AppStateDependencies {
    static var live: AppStateDependencies {
        AppStateDependencies()  // All defaults
    }

    static func test(
        biometricEnabled: Bool = false,
        hasSession: Bool = false
    ) -> AppStateDependencies {
        AppStateDependencies(
            biometricCapability: { biometricEnabled },
            validateRegularSession: { hasSession ? UserInfo.mock : nil }
            // ... autres mocks
        )
    }

    func with(biometricCapability: @escaping @Sendable () -> Bool) -> AppStateDependencies {
        var copy = self
        copy.biometricCapability = biometricCapability
        return copy
    }
}
```

---

## Phase 3 : Modernisation SwiftUI 2025/2026

### 3.1 Adopter Swift 6 Strict Concurrency

**Fichier** : `project.yml` (XcodeGen)

```yaml
settings:
  base:
    SWIFT_STRICT_CONCURRENCY: complete
    SWIFT_VERSION: "6.0"
```

**Changements requis** :
- Ajouter `@Sendable` explicite sur toutes les closures async
- Vérifier les `@MainActor` boundaries
- Remplacer `@preconcurrency` par des conformances natives

### 3.2 Remplacer les closures DI par des protocoles

**Problème** : Closures injectées rendent le code difficile à lire.

```swift
// Avant
let validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)?
```

**Après** :
```swift
protocol SessionValidator: Sendable {
    func validateBiometric() async throws -> BiometricSessionResult?
    func validateRegular() async throws -> UserInfo?
}

// AppState reçoit un SessionValidator, pas des closures
```

### 3.3 Structured Logging avec os.log

**Ajouter** : `AuthLogger.swift`

```swift
import OSLog

enum AuthLogger {
    private static let logger = Logger(subsystem: "com.pulpe.app", category: "Auth")

    static func transition(from: AppFlowState, to: AppFlowState, reason: String) {
        logger.info("Auth transition: \(String(describing: from)) → \(String(describing: to)) [\(reason)]")
    }

    static func coldStart(biometricEnabled: Bool, hasSession: Bool) {
        logger.debug("Cold start: biometric=\(biometricEnabled), session=\(hasSession)")
    }
}
```

### 3.4 Environment-based service injection

**Problème** : Services passés via init ou singletons (`.shared`).

**Solution SwiftUI moderne** :

```swift
// EnvironmentKey
private struct AuthServiceKey: EnvironmentKey {
    static let defaultValue: AuthService = .shared
}

extension EnvironmentValues {
    var authService: AuthService {
        get { self[AuthServiceKey.self] }
        set { self[AuthServiceKey.self] = newValue }
    }
}

// Usage dans les vues
struct LoginView: View {
    @Environment(\.authService) private var authService
}
```

---

## Phase 4 : Améliorations sécurité (SCENARIOS.md §13)

### 4.1 PIN attempt limiter (côté client)

**Ajouter** : `PinAttemptLimiter.swift`

```swift
@Observable @MainActor
final class PinAttemptLimiter {
    private(set) var failedAttempts = 0
    private(set) var lockoutEndTime: Date?

    var isLockedOut: Bool {
        guard let end = lockoutEndTime else { return false }
        return Date() < end
    }

    var remainingLockoutSeconds: Int {
        guard let end = lockoutEndTime else { return 0 }
        return max(0, Int(end.timeIntervalSinceNow))
    }

    func recordFailedAttempt() {
        failedAttempts += 1
        if failedAttempts >= 5 {
            lockoutEndTime = Date().addingTimeInterval(lockoutDuration)
        }
    }

    func reset() {
        failedAttempts = 0
        lockoutEndTime = nil
    }

    private var lockoutDuration: TimeInterval {
        switch failedAttempts {
        case 5...7: return 30
        case 8...9: return 300  // 5 min
        default: return 900     // 15 min
        }
    }
}
```

### 4.2 Trivial PIN blacklist

**Ajouter** : `PinValidation.swift` (extension)

```swift
extension PinValidation {
    static let trivialPins: Set<String> = [
        "0000", "1111", "2222", "3333", "4444",
        "5555", "6666", "7777", "8888", "9999",
        "1234", "4321", "0123", "3210", "9876",
        "1212", "2121", "1010", "0101"
    ]

    static func isTrivial(_ pin: String) -> Bool {
        trivialPins.contains(pin)
    }
}
```

### 4.3 Grace period configurable

**Modifier** : `AppConfiguration.swift`

```swift
enum GracePeriodOption: Int, CaseIterable {
    case immediate = 0
    case oneMinute = 60
    case fiveMinutes = 300
    case fifteenMinutes = 900

    var label: String {
        switch self {
        case .immediate: "Immédiat"
        case .oneMinute: "1 minute"
        case .fiveMinutes: "5 minutes"
        case .fifteenMinutes: "15 minutes"
        }
    }
}

// Stocker dans UserDefaults ou Keychain
@AppStorage("gracePeriodSeconds") var gracePeriodSeconds: Int = 30
```

---

## Phase 5 : Documentation

### 5.1 Architecture Decision Records (ADR)

**Créer** : `docs/adr/`

- `001-observable-over-observableobject.md`
- `002-coordinator-pattern.md`
- `003-dual-keychain-strategy.md`
- `004-event-driven-state-machine.md`

### 5.2 Sequence diagrams

**Créer** : `docs/diagrams/`

- `cold-start-biometric.mermaid`
- `background-lock-flow.mermaid`
- `logout-with-biometric.mermaid`

### 5.3 Responsibility map

**Créer** : `docs/ARCHITECTURE.md`

```markdown
# AppState Responsibility Map

| Extension | Owns | Delegates to |
|-----------|------|--------------|
| AppState (base) | Auth state, user info | Coordinators |
| AppState+Lifecycle | Start, bootstrap, foreground/background | StartupCoordinator, SessionLifecycleCoordinator |
| AppState+Auth | Login, PIN setup/entry | PostAuthResolver, OnboardingBootstrapper |
| AppState+Recovery | Recovery key consent/generation | RecoveryFlowCoordinator |
| AppState+Events | Event dispatch | AppFlowReducer |
```

---

## Ordre d'exécution recommandé

### Sprint 1 : Stabilisation (sans changement fonctionnel)
1. ✅ Phase 1.1 : Supprimer setters computed avec side-effects
2. ✅ Phase 1.2 : Extraire NavigationState
3. ✅ Phase 4.1 : PIN attempt limiter
4. ✅ Phase 4.2 : Trivial PIN blacklist

### Sprint 2 : Restructuration
5. ✅ Phase 2.1 : Réorganiser fichiers AppState
6. ✅ Phase 2.2 : Décomposer RootView

### Sprint 3 : Modernisation
7. ✅ Phase 3.1 : Swift 6 strict concurrency
8. ✅ Phase 2.3 : Simplifier AppStateDependencies
9. ✅ Phase 1.3 : Unifier routing (AuthStatus → AppFlowState)

### Sprint 4 : Polish
10. ✅ Phase 3.3 : Structured logging
11. ✅ Phase 4.3 : Grace period configurable
12. ✅ Phase 5 : Documentation

---

## Critères de succès

- [ ] Un dev iOS senior comprend le flow auth en < 15 minutes
- [ ] Aucun fichier > 300 lignes
- [ ] Tous les tests existants passent
- [ ] Couverture des nouveaux paths (PIN limiter, trivial PIN)
- [ ] Zero warning Swift 6 strict concurrency
- [ ] Cold-start stable (pas de race conditions)

---

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Régression auth flow | Élevée | Critique | Tests de caractérisation AVANT refactor |
| Breakage biometric | Moyenne | Élevé | Tests sur device réel à chaque PR |
| Performance dégradée | Faible | Moyen | Profile Instruments avant/après |

---

## Fichiers à modifier (estimation)

| Fichier | Action | Lignes estimées |
|---------|--------|-----------------|
| `AppState.swift` | Simplifier | -200 |
| `PulpeApp.swift` | Extraire RootView | -400 |
| `NavigationState.swift` | Créer | +50 |
| `RouteContentView.swift` | Créer | +100 |
| `*Modifier.swift` (x4) | Créer | +200 |
| `PinAttemptLimiter.swift` | Créer | +50 |
| `PinValidation.swift` | Étendre | +20 |
| Tests | Adapter | ±100 |

**Net** : ~-80 lignes de code, meilleure organisation.
