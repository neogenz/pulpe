# Auth State Machine

Documents the authentication state machine in `AppState.swift` and its supporting components.

## Component Ownership Map

After the SRP-Lite refactoring, auth logic is distributed across specialized coordinators.
AppState remains the `@Observable @MainActor` facade that views interact with.

### AppState (Facade)
- **Owns**: `authState`, `currentUser`, navigation state (`budgetPath`, `templatePath`, `selectedTab`), maintenance state, `hasReturningUser`
- **Role**: Public API for views, delegates to coordinators, maps results to state transitions
- **File**: `App/AppState.swift`

### AuthenticatedEntryCoordinator
- **Owns**: Post-auth pipeline (biometric credential sync + enrollment policy execution)
- **Called by**: `AppState.enterAuthenticated(context:)` via `transitionToAuthenticated()` and `runEnrollmentPipeline()`
- **Key methods**: `syncCredentials()`, `runEnrollmentPipeline(context:hasActiveModal:)`
- **File**: `App/Auth/AuthenticatedEntryCoordinator.swift`

### RecoveryFlowCoordinator (`@Observable`)
- **Owns**: `RecoveryFlowState` state machine, `pendingRecoveryConsent`, computed UI bindings (`isRecoveryConsentVisible`, `isRecoveryKeySheetVisible`, `recoveryKeyForPresentation`)
- **Called by**: AppState recovery methods (`acceptRecoveryKeyRepairConsent`, `declineRecoveryKeyRepairConsent`, `completePostAuthRecoveryKeyPresentation`), `resolvePostAuth`, `completePinEntry`
- **Key methods**: `showConsentPromptIfPending()`, `acceptConsent()`, `declineConsent()`, `completePresentationDismissal()`, `reset()`
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

### AppStateDependencies (Struct)
- **Role**: Groups all 14 injected services/closures for AppState construction, provides `.default` factory for production use
- **File**: `App/AppStateDependencies.swift`

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

All transitions into `authenticated` go through `enterAuthenticated(context:)`, which delegates to `AuthenticatedEntryCoordinator`:
1. Calls `transitionToAuthenticated()` — sets `authState = .authenticated`, then calls `authenticatedEntryCoordinator.syncCredentials()` (biometric token sync)
2. Calls `authenticatedEntryCoordinator.runEnrollmentPipeline(context:hasActiveModal:)` — resets the enrollment policy, evaluates it, and executes enrollment if `.proceed`

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

After the SRP-Lite refactoring, the pipeline delegates to `AuthenticatedEntryCoordinator`:

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
        │       authenticatedEntryCoordinator.syncCredentials()
        │
        ├─▶ authenticatedEntryCoordinator.runEnrollmentPipeline(context:hasActiveModal:)
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
