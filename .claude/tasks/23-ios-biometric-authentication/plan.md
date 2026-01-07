# Implementation Plan: iOS Biometric Authentication

## Overview

Implement Face ID / Touch ID authentication for the Pulpe iOS app. By default, users must re-login on every app launch. If they enable biometric authentication, the app will prompt for Face ID/Touch ID at launch and restore their session automatically.

**Key UX Decisions:**
- Biometric prompt is automatic on launch (no manual button)
- Prompt to enable biometric after each successful login (if available and not yet enabled)

---

## Best Practices Applied (from review)

| Practice | Implementation |
|----------|----------------|
| **Concurrency safety** | Use `@MainActor` on BiometricService and AppState |
| **Dependency injection** | Inject BiometricService via init, avoid singleton access in views |
| **Biometric flag** | Use `.biometryAny` for UX-friendliness (tokens survive biometric changes) |
| **Fresh LAContext** | Create new LAContext instance for each authentication attempt |
| **async/await** | Wrap `evaluatePolicy` with `withCheckedThrowingContinuation` |

---

## Dependencies

Implementation order matters. Complete files in this sequence:

1. `Info.plist` (no dependencies)
2. `BiometricService.swift` (new file, no dependencies)
3. `KeychainManager.swift` (no dependencies)
4. `AuthService.swift` (depends on KeychainManager)
5. `AppState.swift` (depends on BiometricService, AuthService)
6. `LoginView.swift` (depends on AppState)
7. `AccountView.swift` (depends on AppState)

---

## File Changes

### 1. `ios/Pulpe/Info.plist`

**Purpose**: Declare Face ID usage to comply with Apple requirements.

- Add key `NSFaceIDUsageDescription` with value: `"Utilisez Face ID pour vous connecter rapidement et en toute sécurité."`
- This is required for any app that uses LocalAuthentication with Face ID

---

### 2. `ios/Pulpe/Core/Auth/BiometricService.swift` (NEW FILE)

**Purpose**: Encapsulate all LocalAuthentication logic in a dedicated service.

**Class Declaration:**
- Import `LocalAuthentication` framework
- Use `@MainActor final class BiometricService` for concurrency safety
- Add `static let shared = BiometricService()` for convenience (but prefer DI)

**Properties:**
- `biometryType: LABiometryType` - computed property that creates fresh LAContext and checks capability
- `biometryDisplayName: String` - returns "Face ID" or "Touch ID" based on `biometryType`

**Methods:**

- `canUseBiometrics() -> Bool`
  - Create fresh `LAContext()` instance
  - Call `context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error:)`
  - Return result

- `authenticate() async throws -> Bool`
  - Create fresh `LAContext()` instance (critical: never reuse)
  - Use `withCheckedThrowingContinuation` to wrap callback-based API:
    ```
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                           localizedReason: "Authentifiez-vous pour accéder à Pulpe")
    ```
  - On success: resume with `true`
  - On failure: map LAError to BiometricError and throw

**Error Handling:**
- Create `BiometricError` enum with cases: `unavailable`, `notEnrolled`, `cancelled`, `lockout`, `failed`
- Map LAError.Code to BiometricError:
  - `.biometryNotAvailable` → `.unavailable`
  - `.biometryNotEnrolled` → `.notEnrolled`
  - `.userCancel`, `.userFallback` → `.cancelled`
  - `.biometryLockout` → `.lockout`
  - default → `.failed`

---

### 3. `ios/Pulpe/Core/Auth/KeychainManager.swift`

**Purpose**: Add biometric-protected token storage alongside existing non-protected storage.

**New Constants** (add after line 10):
- `biometricAccessTokenKey = "biometric_access_token"`
- `biometricRefreshTokenKey = "biometric_refresh_token"`

**New Methods:**

- `saveBiometricTokens(accessToken: String, refreshToken: String)`
  - Create `SecAccessControl` with:
    - `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` as protection
    - `.biometryAny` as flag (UX-friendly: survives biometric changes)
  - Handle `SecAccessControlCreateWithFlags` error
  - Delete existing biometric tokens before saving (same pattern as `save()`)
  - Add tokens with `kSecAttrAccessControl` instead of `kSecAttrAccessible`

- `getBiometricAccessToken() throws -> String?`
  - Query keychain with biometric access token key
  - Add `kSecUseAuthenticationUI: kSecUseAuthenticationUIAllow` to query
  - System will automatically trigger Face ID/Touch ID prompt
  - Return token string or throw on error

- `getBiometricRefreshToken() throws -> String?`
  - Same as above for refresh token

- `clearBiometricTokens()`
  - Delete both biometric token keys from keychain

- `hasBiometricTokens() -> Bool`
  - Check if biometric tokens exist WITHOUT triggering biometric prompt
  - Use `kSecUseAuthenticationUI: kSecUseAuthenticationUIFail` to skip prompt
  - Return true if `errSecSuccess` or `errSecInteractionNotAllowed`, false otherwise

**Important**: Keep existing `saveTokens()`, `getAccessToken()`, `clearTokens()` unchanged - they're used for non-biometric flow

---

### 4. `ios/Pulpe/Core/Auth/AuthService.swift`

**Purpose**: Add biometric token management methods that delegate to KeychainManager.

**New Methods** (add after line 115):

- `saveBiometricTokens() async throws`
  - Get current session from Supabase (`supabase.auth.session`)
  - Call `keychain.saveBiometricTokens()` with access and refresh tokens
  - Throw if no session available

- `validateBiometricSession() async throws -> UserInfo?`
  - Check if biometric tokens exist via `keychain.hasBiometricTokens()`
  - If not, return nil (no biometric tokens saved)
  - Try to get biometric tokens (triggers Face ID prompt via keychain)
  - Use tokens to create/restore Supabase session
  - Return UserInfo on success, throw on failure

- `clearBiometricTokens() async`
  - Call `keychain.clearBiometricTokens()`

**Modify `logout()` method** (line 89-98):
- Add call to `await keychain.clearBiometricTokens()` alongside existing `clearTokens()`

---

### 5. `ios/Pulpe/App/AppState.swift`

**Purpose**: Core flow changes for biometric authentication.

**Class Declaration:**
- Add `@MainActor` attribute to class declaration (if not already present)
- This ensures all state mutations happen on main thread (Swift 6 best practice)

**New Properties** (add after line 30):

- `biometricEnabled: Bool` - UserDefaults-backed property with key `pulpe-biometric-enabled`
  - Follow existing pattern from `hasCompletedOnboarding` (line 24-26)
  - `didSet` saves to UserDefaults

- `private let biometricService: BiometricService` - injected via init

**Modify `init`** (line 40-42):
- Add `biometricService: BiometricService = .shared` parameter
- Store in property

**Modify `checkAuthState()` method** (replace lines 47-60):

New flow:
1. Set `authState = .loading`
2. If `biometricEnabled` is false:
   - Call `await authService.logout()` to clear any stale tokens
   - Set `authState = .unauthenticated`
   - Return early
3. If `biometricEnabled` is true:
   - Try `authService.validateBiometricSession()` (triggers Face ID)
   - On success: set `currentUser`, set `authState = .authenticated`
   - On any error: set `authState = .unauthenticated` (keep preference for retry)

**New Methods:**

- `enableBiometric() async`
  - Guard: check `biometricService.canUseBiometrics()` returns true
  - Call `try await authService.saveBiometricTokens()`
  - Set `biometricEnabled = true`
  - Handle errors gracefully (don't crash on failure)

- `disableBiometric() async`
  - Call `await authService.clearBiometricTokens()`
  - Set `biometricEnabled = false`

- `shouldPromptBiometricEnrollment() -> Bool`
  - Return `biometricService.canUseBiometrics() && !biometricEnabled && authState == .authenticated`

**Modify `logout()` method** (line 70-79):
- Add `biometricEnabled = false` to clear preference on logout

---

### 6. `ios/Pulpe/Features/Auth/LoginView.swift`

**Purpose**: Prompt user to enable biometric after successful login.

**New State Property** (add in LoginView struct):
- `@State private var showBiometricPrompt = false`

**Modify `login()` function** (lines 153-164):
- After successful login (after `appState.login()` succeeds):
  - Check `appState.shouldPromptBiometricEnrollment()`
  - If true AND `isPresented` is nil: set `showBiometricPrompt = true`
  - Otherwise: dismiss as before (if `isPresented` set)

**Add Alert Modifier** (add to NavigationStack, after `.dismissKeyboardOnTap()`):
```swift
.alert("Activer \(BiometricService.shared.biometryDisplayName) ?",
       isPresented: $showBiometricPrompt) {
    Button("Activer") {
        Task { await appState.enableBiometric() }
    }
    Button("Plus tard", role: .cancel) { }
} message: {
    Text("Utilisez la reconnaissance biométrique pour vous connecter plus rapidement")
}
```

---

### 7. `ios/Pulpe/Features/Account/AccountView.swift`

**Purpose**: Add toggle to enable/disable biometric authentication in settings.

**Add New Section** (insert before the logout section, around line 22):

- Only render if biometrics available: `if BiometricService.shared.canUseBiometrics()`
- Section header: `"SÉCURITÉ"`
- Content: Toggle for biometric authentication
  - Label: `BiometricService.shared.biometryDisplayName` (e.g., "Face ID")
  - Binding: Create local `@State` or use computed binding to `appState.biometricEnabled`
  - On change handler:
    ```swift
    .onChange(of: biometricToggle) { _, newValue in
        Task {
            if newValue {
                await appState.enableBiometric()
            } else {
                await appState.disableBiometric()
            }
        }
    }
    ```

**Alternative approach** (simpler):
- Use `Toggle(isOn: Binding(...))` with custom getter/setter that calls async methods

---

## Testing Strategy

### Manual Testing (Required - Physical Device Only)

Biometric authentication requires physical device testing:

1. **Device with Face ID (iPhone X+)**:
   - Launch with biometric disabled → should show login
   - Login → should prompt to enable Face ID
   - Accept → restart app → Face ID prompt → authenticated
   - Decline → restart app → login required
   - Settings toggle ON/OFF → verify behavior

2. **Device with Touch ID (iPhone SE/8)**:
   - Same flow as above with Touch ID

3. **Edge Cases**:
   - Cancel biometric prompt → should show login screen
   - Fail biometric 3 times → lockout handling (show login)
   - Remove Face ID enrollment in iOS Settings → graceful fallback to login
   - Add new fingerprint/face → should still work (`.biometryAny`)
   - Enable biometric, logout, login → biometric should be disabled
   - Device with passcode but no biometrics enrolled → toggle should not appear

4. **Onboarding Flow**:
   - New user completes onboarding → biometric prompt should appear
   - Verify onboarding users get same biometric enrollment prompt

---

## Documentation

No README or external documentation changes needed. This is a user-facing feature with self-explanatory UI.

---

## Rollout Considerations

### No Migration Needed
- Existing users will simply need to re-login on next app launch (expected behavior)
- No data loss - user accounts are stored in Supabase, not locally

### Breaking Change
- Users will no longer stay logged in by default
- This is intentional and the core requirement

### Backwards Compatibility
- No API changes
- No schema changes
- Works with all iOS versions that support Face ID/Touch ID (iOS 11+)
- Minimum deployment target should be iOS 11+ for LocalAuthentication
