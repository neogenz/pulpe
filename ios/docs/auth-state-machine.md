# Auth State Machine

Documents the authentication state machine in `AppState.swift` and its supporting components.

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
  └─▶ authenticated           (after biometric login)

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

### Entry points into `authenticated`

All transitions into `authenticated` go through `enterAuthenticated(context:)`, which:
1. Calls `transitionToAuthenticated()` — sets `authState = .authenticated` and syncs biometric tokens
2. Resets `BiometricAutomaticEnrollmentPolicy` for the new transition
3. Evaluates the policy to decide whether to show the Face ID enrollment prompt

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

Contexts from PIN/recovery flows (`.pinSetup`, `.pinEntry`, `.pinRecovery`) return `true`, allowing the enrollment policy to potentially show the Face ID prompt. The `.directAuthenticated` context returns `false`, blocking automatic enrollment for direct auth routes.

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

Views use these computed `Bool` bindings rather than accessing `recoveryFlowState` directly:

| Property | Reads | Writes |
|----------|-------|--------|
| `isRecoveryConsentVisible` | `recoveryFlowState == .consentPrompt` | `false` → sets `.idle` |
| `isRecoveryKeySheetVisible` | `recoveryFlowState == .presentingKey` | `false` → sets `.idle` |
| `recoveryKeyForPresentation` | key string from `.presentingKey(key)` | read-only |

### `pendingRecoveryConsent`

A private boolean on `AppState` used to defer the consent alert until PIN entry succeeds.

Flow:
1. `resolvePostAuth` receives `.needsPinEntry(needsRecoveryKeyConsent: true)` → sets `pendingRecoveryConsent = true` (does NOT set `recoveryFlowState` yet)
2. `completePinEntry()` is called by the view after the user enters the correct PIN
3. `completePinEntry()` checks `pendingRecoveryConsent`, and if `true`, synchronously sets `recoveryFlowState = .consentPrompt` and returns early (skipping `enterAuthenticated`)
4. The consent alert is now visible; auto-enrollment is deferred because `recoveryFlowState.isModalActive == true`
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

```
completePinEntry()
completeRecovery()
declineRecoveryKeyRepairConsent()
completeRecoveryKeyPresentation()
resolvePostAuth(.authenticated)
... (all auth completion paths)
        │
        ▼
enterAuthenticated(context: AuthCompletionContext)
        │
        ├─▶ transitionToAuthenticated()
        │       authState = .authenticated
        │       biometric.syncAfterAuth()
        │
        ├─▶ enrollmentPolicy.resetForNewTransition()
        │
        ├─▶ enrollmentPolicy.shouldAttempt(context: ...)
        │       .proceed  ──▶  markInFlight(context:)
        │                      biometric.enable(source: .automatic, reason: context.reason)
        │                      markComplete(context:outcome:)
        │       .skip(r)  ──▶  policy logs reason
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
