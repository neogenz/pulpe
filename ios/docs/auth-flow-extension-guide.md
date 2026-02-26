# Auth Flow Extension Guide

Guide pour ajouter un nouvel etat, event, ou coordinateur au systeme d'authentification iOS.

## Ajouter un nouvel AppFlowEvent

1. **Definir l'event** dans `App/Core/AppFlowEvent.swift`
2. **Choisir le tier de dispatch** dans `AppState+FlowState.swift` :
   - **Immediate** (`handleImmediateEvent`) : synchrone, mutation directe, pas d'async
   - **Reducer** (`applyReducerTransitionIfPossible`) : transition pure via `AppFlowReducer.reduce()`
   - **Async** (`handleAsyncEvent`) : serialise via `AppFlowEventQueue`
3. **Implementer le handler** dans le bon fichier d'extension AppState
4. **Ajouter un test** dans `AppFlowEventRoutingTests.swift`

### Checklist
- [ ] Event defini dans `AppFlowEvent`
- [ ] Handler dans le bon tier
- [ ] Si reducer : ajouter la transition dans `AppFlowReducer.swift`
- [ ] Test de routing dans `AppFlowEventRoutingTests`
- [ ] Migrer les call sites views vers `send(.event)` dans `PulpeApp.swift`

## Ajouter un nouvel AuthStatus

1. **Ajouter le case** dans `AppState.AuthStatus`
2. **Mapper vers AppFlowState** dans `AppState+FlowState.swift` → `var flowState`
3. **Mapper vers AppRoute** dans `AppRoute.swift` → `AppRoute.from(flowState:biometricEnabled:)`
4. **Ajouter le routeContent** dans `PulpeApp.swift` → `routeContent` ViewBuilder
5. **Ajouter les transitions** dans les methodes concernees
6. **Tester** :
   - `AppStateFlowBridgeTests` : flowState mapping
   - `AppFlowEventRoutingTests` : transitions via send()

### Checklist
- [ ] Case dans `AuthStatus`
- [ ] Mapping `flowState` dans `AppState+FlowState.swift`
- [ ] Route dans `AppRoute.swift`
- [ ] Vue dans `routeContent` de `PulpeApp.swift`
- [ ] Guards mis a jour dans `AppState+Recovery.swift` (si pertinent)
- [ ] Tests bridge + routing

## Ajouter un scope de reset session

1. **Ajouter le case** dans `AppState.SessionResetScope`
2. **Configurer les flags** : `clearsUIState`, `clearsNavigation`, `clearsPostAuthError`, `errorMessage`, `setsManualBiometricRetry`
3. **Les feature stores sont reset automatiquement** via `SessionDataResetting` (pas de code supplementaire)
4. **Tester** dans `SessionDataResetterTests.swift`

## Ajouter un coordinateur

1. **Creer le fichier** dans `App/Auth/` ou `App/Runtime/`
2. **Pattern** : `@Observable @MainActor final class`
3. **Injection** : via `AppStateDependencies` ou directement dans `AppState.init`
4. **Delegation** : AppState expose des computed properties vers le coordinateur (pattern passthrough)
5. **Tests** : creer un fichier test dedie avec `@Suite(.serialized) @MainActor`

### Patterns de test

```swift
@Suite(.serialized)
@MainActor
struct MonCoordinateurTests {
    // Factory avec DI par closures
    private func makeSUT() -> MonCoordinateur { ... }

    // AtomicFlag pour tracker les appels @Sendable
    let called = AtomicFlag()

    // waitForCondition pour les assertions async
    await waitForCondition(timeout: .milliseconds(500), "...") { called.value }
}
```

## Anti-regression checklist

Avant de merger toute modification auth :

- [ ] `AppFlowEventRoutingTests` : vert
- [ ] `AppStateLockReasonTests` : vert
- [ ] `AppStateStartupTimeoutIsolationTests` : vert
- [ ] `RecoveryFlowCoordinatorTests` : vert
- [ ] `SessionDataResetterTests` : vert
- [ ] `AppRuntimeCoordinatorTests` : vert
- [ ] `AppStateFlowBridgeTests` : vert
- [ ] Full `PulpeTests` sans parallelisme : vert
- [ ] Scenarios SCENARIOS.md section 12 : verifies manuellement
- [ ] SwiftLint `--strict` : 0 erreur
