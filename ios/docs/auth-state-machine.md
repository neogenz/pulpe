# Auth State Machine

Documents the authentication state machine in `AppState.swift` and its supporting components.

## Component Ownership Map

Auth logic is distributed across specialized coordinators following SRP (Single Responsibility Principle).
AppState remains the `@Observable @MainActor` facade that views interact with.

### AppState (Facade)
- **Owns**: `authState`, `currentUser`, navigation state (`budgetPath`, `templatePath`, `selectedTab`), maintenance state, `hasReturningUser`
- **Role**: Public API for views (`start()`, `retryStartup()`, `send(event:)`, `logout(...)`), delegates to coordinators, maps results to state transitions
- **File**: `App/AppState.swift`
- **Extensions**: `AppState+Auth.swift`, `AppState+Bootstrap.swift`, `AppState+Maintenance.swift`, `AppState+Recovery.swift`, `AppState+SessionReset.swift`, `AppState+FlowState.swift`

### AppFlowState & AppFlowReducer (Deterministic State Core)
- **Owns**: High-level app state enumeration and pure state transitions
- **Purpose**: Provides a deterministic, testable state machine for the app lifecycle
- **Key types**: `AppFlowState`, `AppFlowEvent`, `AppFlowReducer`, `AppRoute`
- **Files**: `App/Core/AppFlowState.swift`, `App/Core/AppFlowEvent.swift`, `App/Core/AppFlowReducer.swift`, `App/Core/AppRoute.swift`

### AppFlowEventQueue (@MainActor)
- **Owns**: Serialized FIFO processing of async events
- **Purpose**: Prevents race conditions when multiple events fire in quick succession (e.g., logout during recovery)
- **Key methods**: `enqueue(_:)`, `pendingCount` (for testing)
- **File**: `App/Core/AppFlowEventQueue.swift`
- **Integration**: `AppState.send(event:)` enqueues async events instead of spawning fire-and-forget Tasks

### DeepLinkHandler (@MainActor)
- **Owns**: Pending deep link state, reset password disposition policy
- **Purpose**: Defers deep link processing until app is in correct auth state
- **Key types**: `DeepLinkDestination`, `ResetPasswordDeepLinkPolicy`, `ResetPasswordProcessResult`
- **Files**: `App/Navigation/DeepLinkHandler.swift`, `App/Navigation/DeepLinkDestination.swift`, `App/Navigation/ResetPasswordDeepLinkPolicy.swift`

### StartupCoordinator (Actor)
- **Owns**: Single-flight auth resolution with cancellation support, startup timeout
- **Purpose**: Prevents race conditions during cold-start authentication
- **Key methods**: `start(context:)`, `retry()`, `cancel()`
- **Timeout**: 30 seconds default (`defaultTimeout`), configurable via init for testing
- **Returns**: `StartupResult` enum (`.authenticated`, `.needsPinSetup`, `.needsPinEntry`, `.unauthenticated`, `.maintenance`, `.networkError`, `.biometricSessionExpired`, `.timeout`, `.cancelled`)
- **File**: `App/Auth/StartupCoordinator.swift`
- **Status**: Active runtime path for `AppState.checkAuthState()`.

### RecoveryFlowCoordinator (`@Observable`)
- **Owns**: `RecoveryFlowState` state machine, `pendingRecoveryConsent`, computed UI bindings (`isRecoveryConsentVisible`, `isRecoveryKeySheetVisible`, `recoveryKeyForPresentation`)
- **Called by**: AppState recovery methods (`acceptRecoveryKeyRepairConsent`, `declineRecoveryKeyRepairConsent`, `completePostAuthRecoveryKeyPresentation`), `resolvePostAuth`, `completePinEntry`
- **Key methods**: `showConsentPromptIfPending()`, `acceptConsent()`, `declineConsent()`, `completePresentationDismissal()`, `reset()`
- **Operation ID**: `acceptConsent()` uses a UUID-based `currentOperationId` to invalidate stale callbacks. If `reset()` or `declineConsent()` is called during the async `setupRecoveryKey()`, the returning closure checks the ID and no-ops.
- **File**: `App/Auth/RecoveryFlowCoordinator.swift`

### OnboardingBootstrapper
- **Owns**: `pendingOnboardingData`, template + budget creation from onboarding data
- **Called by**: `AppState.completePinSetup()`, `AppState.completeOnboarding()`
- **Key methods**: `setPendingData(_:)`, `clearPendingData()`, `bootstrapIfNeeded()`
- **File**: `App/Auth/OnboardingBootstrapper.swift`

### SessionLifecycleCoordinator
- **Owns**: Cold start biometric/regular session validation, background lock state (`backgroundDate`), foreground session restoration (`isRestoringSession`)
- **Called by**: `AppState.checkAuthState()`, `AppState.handleEnterBackground()`, `AppState.handleEnterForeground()`, `AppState.loginWithBiometric()`
- **Key methods**: `attemptBiometricSessionValidation()`, `attemptRegularSessionValidation()`, `handleEnterBackground()`, `handleEnterForeground(authState:)`
- **Returns**: Typed result enums (`ColdStartResult`, `ForegroundResult`) for AppState to map into state transitions
- **File**: `App/Auth/SessionLifecycleCoordinator.swift`

### AppRuntimeCoordinator (`@Observable @MainActor`)
- **Owns**: Scene phase handling, privacy shield, foreground store refresh, widget sync
- **Purpose**: Extracts runtime orchestration from RootView so it stays purely declarative
- **Key methods**: `handleScenePhaseChange(from:to:)`, `shouldShowPrivacyShield`
- **File**: `App/Runtime/AppRuntimeCoordinator.swift`

### SessionDataResetting (Protocol)
- **Owns**: Atomic reset of feature stores during session teardown
- **Purpose**: Makes `resetSession()` transactional — stores reset inside AppState, not reactively from the view
- **Production impl**: `LiveSessionDataResetter` (resets `CurrentMonthStore`, `BudgetListStore`, `DashboardStore`)
- **File**: `App/SessionDataResetting.swift`
- **Injected**: Set on `AppState.sessionDataResetter` in `PulpeApp.init()` after store creation

### AppStateDependencies (Struct)
- **Role**: Groups all injected services/closures for AppState construction, provides `.default` factory for production use
- **File**: `App/AppStateDependencies.swift`

## Event Dispatch System

Events are processed through `AppState.send(event:)` in three tiers:

### Tier 1: Immediate Events (Synchronous)
Handled by `handleImmediateEvent(_:)` — no async work, direct state mutation:
- `.recoveryInitiated` → `startRecovery()`
- `.recoveryCancelled` → `cancelRecovery()`

### Tier 2: Reducer Events (Pure State Transitions)
Handled by `applyReducerTransitionIfPossible(_:)` — pure `AppFlowReducer.reduce()` calls:
- `.maintenanceChecked(Bool)`
- `.networkBecameUnavailable`
- `.startupTimedOut`
- `.foregroundLockRequired`
- `.foregroundNoLockNeeded`
- `.biometricUnlockFailed`

### Tier 3: Async Events (Serialized Queue)
All other events are enqueued in `AppFlowEventQueue` for FIFO processing:
- `.startupInitiated`, `.retryRequested`
- `.logoutRequested(LogoutSource)`
- `.sessionValidated(SessionValidationResult)`
- `.sessionExpired`, `.sessionRefreshFailed`
- `.authenticationSucceeded(UserInfo)`
- `.pinEntrySucceeded`, `.biometricUnlockSucceeded`
- `.pinSetupCompleted`
- `.recoveryCompleted`, `.recoveryKeyConsentAccepted`, `.recoveryKeyConsentDeclined`, `.recoveryKeyPresentationDismissed`

### Race Condition Prevention
Before the event queue, concurrent events could cause state inconsistencies:
```
// BEFORE (fire-and-forget Tasks)
Task { await handleAsyncEvent(.logoutRequested) }  // starts logout
Task { await handleAsyncEvent(.recoveryCompleted) }  // starts recovery completion
// Both run concurrently → undefined final state
```

With the event queue:
```
// AFTER (serialized queue)
eventQueue.enqueue(.logoutRequested)    // queued first
eventQueue.enqueue(.recoveryCompleted)  // queued second, waits for logout
// Logout completes, then recovery completes → deterministic final state
```

## Startup Timeout

The `StartupCoordinator` enforces a 30-second timeout on cold-start authentication to prevent the app from hanging indefinitely on network issues.

### Timeout Flow
```
start(context:)
    │
    ├─▶ TaskGroup races startup vs timeout
    │       ├─▶ startupTask (maintenance check + session validation)
    │       └─▶ timeout task (30s sleep, returns .timeout)
    │
    ├─▶ First result wins
    │       └─▶ .timeout → cancels startup, returns .timeout
    │       └─▶ other → returns that result
    │
    └─▶ AppState.handleStartupResult(.timeout)
            └─▶ isNetworkUnavailable = true
            └─▶ biometricError = "Le chargement a pris trop de temps, réessaie"
```

### User Experience
When timeout occurs:
1. User sees network error screen with retry button
2. User can tap "Réessayer" to trigger `retryStartup()`
3. Startup coordinator runs again with fresh timeout

### Testing
Timeout is configurable via `StartupCoordinator.init(timeout:)`:
```swift
let coordinator = StartupCoordinator(timeout: .milliseconds(100))  // Fast timeout for tests
```

## AuthStatus Transitions

`AuthStatus` is the primary navigation state. Views switch their root content based on this value.

```
loading
  └─▶ unauthenticated         (no session found, or session expired)
  └─▶ needsPinSetup           (first login, no PIN established)
  └─▶ needsPinEntry           (returning user, PIN required)
  └─▶ authenticated           (session active, dashboard shown)

unauthenticated
  └─▶ loading                 (app restart / checkAuthState)
  └─▶ needsPinSetup           (after email/password login, first time)
  └─▶ needsPinEntry           (after email/password login, returning user)
  └─▶ authenticated           (after biometric login, via resolvePostAuth(.authenticated) → enterAuthenticated(.directAuthenticated))

needsPinSetup
  └─▶ authenticated           (via enterAuthenticated(.pinSetup))

needsPinEntry
  └─▶ needsPinRecovery        (user taps "PIN oublié ?")
  └─▶ authenticated           (via enterAuthenticated(.pinEntry))

needsPinRecovery
  └─▶ needsPinEntry           (user cancels recovery)
  └─▶ authenticated           (via enterAuthenticated(.pinRecovery))

authenticated
  └─▶ unauthenticated         (logout)
  └─▶ loading                 (session expiry / maintenance)
```

### Strict precondition guards

Each transition method requires the exact source state before proceeding. If the current state does not match, the call is a silent no-op (returns immediately):

| Method | Required `authState` |
|--------|---------------------|
| `completePinSetup()` | `.needsPinSetup` |
| `completePinEntry()` | `.needsPinEntry` |
| `completeRecovery()` | `.needsPinRecovery` |

This prevents stale or duplicate calls from triggering unexpected transitions.

### Entry points into `authenticated`

All transitions into `authenticated` go through `enterAuthenticated(context:)`:
1. Calls `transitionToAuthenticated()` — sets `authState = .authenticated`, syncs biometric credentials
2. Runs enrollment pipeline — resets the enrollment policy, evaluates it, and executes enrollment if `.proceed`

## AuthCompletionContext

Each call site that transitions to `authenticated` passes a typed context. This context is used for:
- Debug logging (written to `Logger.auth`)
- Passing a `reason` string to `BiometricManager.enable(source:reason:)`

| Case | Raw value | Trigger |
|------|-----------|---------|
| `.pinSetup` | `pin_setup` | User completes first-time PIN setup |
| `.pinEntry` | `pin_entry` | User enters correct PIN at login |
| `.pinRecovery` | `pin_recovery` | User completes PIN recovery flow |
| `.recoveryKeyConflict` | `recovery_key_conflict` | Recovery key conflict resolved |
| `.recoveryKeyError` | `recovery_key_error` | Recovery key error dismissed |
| `.recoveryKeyDeclined` | `recovery_key_declined` | User declines recovery key consent |
| `.recoveryKeyPresented` | `recovery_key_presented` | User acknowledges recovery key presentation |
| `.directAuthenticated` | `direct_authenticated` | `resolvePostAuth` routes directly to authenticated (no PIN/recovery flow) |

### `allowsAutomaticEnrollment` property

Each context declares whether it is eligible to trigger the automatic Face ID enrollment prompt:

| Case | `allowsAutomaticEnrollment` |
|------|---------------------------|
| `.pinSetup` | `true` |
| `.pinEntry` | `true` |
| `.pinRecovery` | `true` |
| `.recoveryKeyConflict` | `true` |
| `.recoveryKeyError` | `true` |
| `.recoveryKeyDeclined` | `true` |
| `.recoveryKeyPresented` | `true` |
| `.directAuthenticated` | `false` |

Only `.directAuthenticated` returns `false`, blocking automatic enrollment for the direct biometric login path (where the user just authenticated via Face ID, so prompting again would be redundant).

## RecoveryFlowState

`RecoveryFlowState` tracks the recovery key modal pipeline as a single enum, replacing four boolean properties.

```
idle
  └─▶ consentPrompt           (user has a recovery key conflict that needs consent)
       └─▶ generatingKey      (user accepted consent, key is being generated)
            └─▶ presentingKey(String)  (key ready, sheet shown)
                 └─▶ idle     (user dismissed the sheet)
       └─▶ idle               (user declined consent — enterAuthenticated(.recoveryKeyDeclined))
```

`isModalActive` returns `true` for `consentPrompt`, `generatingKey`, and `presentingKey`. The enrollment policy uses this to skip the Face ID prompt while any recovery modal is visible.

### Computed bindings on AppState

Views use these computed `Bool` bindings on AppState, which delegate to `RecoveryFlowCoordinator`:

| Property | Reads (via coordinator) | Writes |
|----------|-------------------------|--------|
| `isRecoveryConsentVisible` | `recoveryFlowCoordinator.isRecoveryConsentVisible` | `false` → `recoveryFlowCoordinator.setIdle()` |
| `isRecoveryKeySheetVisible` | `recoveryFlowCoordinator.isRecoveryKeySheetVisible` | `false` → `recoveryFlowCoordinator.setIdle()` |
| `recoveryKeyForPresentation` | `recoveryFlowCoordinator.recoveryKeyForPresentation` | read-only |

### `pendingRecoveryConsent`

A private boolean on `RecoveryFlowCoordinator` used to defer the consent alert until PIN entry succeeds.

Flow:
1. `resolvePostAuth` receives `.needsPinEntry(needsRecoveryKeyConsent: true)` → calls `recoveryFlowCoordinator.setPendingConsent(true)` (does NOT set `recoveryFlowState` yet)
2. `completePinEntry()` is called by the view after the user enters the correct PIN
3. `completePinEntry()` calls `recoveryFlowCoordinator.showConsentPromptIfPending()` — if pending, the coordinator sets `recoveryFlowState = .consentPrompt` and returns `true`, causing AppState to return early (skipping `enterAuthenticated`)
4. The consent alert is now visible; auto-enrollment is deferred because `recoveryFlowCoordinator.isModalActive == true`
5. When the user responds to the alert, `declineRecoveryKeyRepairConsent()` or `acceptRecoveryKeyRepairConsent()` calls `enterAuthenticated` to complete the transition

## BiometricAutomaticEnrollmentPolicy

Governs whether the Face ID enrollment prompt fires automatically after `enterAuthenticated(context:)`.

The policy exposes a `lastDecision` property for testability, allowing tests to verify which skip reason (if any) blocked enrollment.

### Invariants

1. At most one enrollment attempt per auth transition (per-transition, not global)
2. No concurrent enrollment — `inFlight` blocks duplicate concurrent triggers
3. No prompt while any recovery modal is visible (`hasActiveModal`)
4. No prompt when biometric is already enabled (`biometricEnabled`)
5. No prompt on devices without Face ID / Touch ID capability (`biometricCapable`)
6. No prompt when source context is not eligible for automatic enrollment (`sourceEligible`)
7. No prompt when not in authenticated state (`isAuthenticated`, defensive)

### Decision logic

```swift
func shouldAttempt(
    biometricEnabled: Bool, biometricCapable: Bool,
    isAuthenticated: Bool, sourceEligible: Bool,
    hasActiveModal: Bool, context: String
) -> PolicyDecision {
    if !isAuthenticated       { return .skip(.notAuthenticated) }
    if !sourceEligible        { return .skip(.sourceNotEligible) }
    if attemptedThisTransition { return .skip(.alreadyAttempted) }
    if inFlight               { return .skip(.inFlight) }
    if !biometricCapable      { return .skip(.capabilityUnavailable) }
    if biometricEnabled       { return .skip(.alreadyEnabled) }
    if hasActiveModal         { return .skip(.modalActive) }
    return .proceed
}
```

### Lifecycle

```
enterAuthenticated(context:) called
  └─▶ resetForNewTransition()         — clears attemptedThisTransition
  └─▶ shouldAttempt(context: ...)
        case .proceed:
          markInFlight(context:)      — sets attemptedThisTransition = true, inFlight = true
          await biometric.enable(...)
          markComplete(context:outcome:) — sets inFlight = false
        case .skip(reason):
          policy logs reason (debug only)
```

### Per-transition vs. one-shot (previous behavior)

Previously a `UserDefaults` flag (`pulpe-biometric-enrollment-dismissed`) made enrollment a global one-shot event — once declined, it would never fire again. The new policy resets on every `enterAuthenticated(context:)` call, so:
- Retry is allowed on each new auth session
- Within a single session transition, duplicates are blocked by `attemptedThisTransition` and `inFlight`

## enterAuthenticated pipeline

**Ordering guarantee:** `transitionToAuthenticated()` sets `authState = .authenticated` **before** the policy evaluation. The `isAuthenticated` check in `shouldAttempt` is therefore defensive — it is guaranteed to be `true` at that point but guards against hypothetical future call sites that might invoke the policy outside the normal pipeline.

```
completePinEntry()                          ← AppState (delegates to RecoveryFlowCoordinator for consent check)
completeRecovery()                          ← AppState
declineRecoveryKeyRepairConsent()           ← AppState (delegates to RecoveryFlowCoordinator)
completePostAuthRecoveryKeyPresentation()   ← AppState (delegates to RecoveryFlowCoordinator)
resolvePostAuth(.authenticated)             ← AppState
... (all auth completion paths)
        │
        ▼
enterAuthenticated(context: AuthCompletionContext)    ← AppState (private)
        │
        ├─▶ transitionToAuthenticated()               ← AppState (private)
        │       authState = .authenticated
        │       biometric.syncAfterAuth()
        │
        ├─▶ runEnrollmentPipeline(context:hasActiveModal:)
        │       enrollmentPolicy.resetForNewTransition()
        │       enrollmentPolicy.shouldAttempt(context: ...)
        │           .proceed  ──▶  markInFlight(context:)
        │                          biometric.enable(source: .automatic, reason: context.reason)
        │                          markComplete(context:outcome:)
        │           .skip(r)  ──▶  policy logs reason
        │
        └─▶ (done)
```

### Direct authentication path

When `resolvePostAuth(.authenticated)` is called with `.directAuthenticated`:
```
resolvePostAuth(.authenticated)
        │
        ▼
enterAuthenticated(context: .directAuthenticated)
        │
        ├─▶ enrollmentPolicy.shouldAttempt(...)
        │       .directAuthenticated has allowsAutomaticEnrollment = false
        │       → sourceEligible param is false
        │       → policy returns .skip(.sourceNotEligible)
        │
        └─▶ (enrollment skipped, no Face ID prompt)
```
