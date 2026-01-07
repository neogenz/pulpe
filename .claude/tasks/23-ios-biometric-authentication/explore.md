# Task: iOS Biometric Authentication (Face ID / Touch ID)

## Objective

Force re-login on every app launch by default. Allow persistent session ONLY if user enables biometric authentication (Face ID / Touch ID).

---

## Codebase Context

### Current Authentication Architecture

The app uses a clean authentication flow with Supabase:

| File | Purpose |
|------|---------|
| `ios/Pulpe/Core/Auth/AuthService.swift:6-116` | Actor-based auth service using Supabase SDK |
| `ios/Pulpe/Core/Auth/KeychainManager.swift:5-105` | Keychain storage for access/refresh tokens |
| `ios/Pulpe/App/AppState.swift:3-127` | Observable app state with auth status |
| `ios/Pulpe/App/PulpeApp.swift:15-45` | Root view that calls `checkAuthState()` on launch |
| `ios/Pulpe/Features/Auth/LoginView.swift` | Login form UI |
| `ios/Pulpe/Features/Account/AccountView.swift` | Account settings (logout button) |

### Current Session Flow

```
App Launch
    ↓
PulpeApp.RootView.task → appState.checkAuthState()
    ↓
AuthService.validateSession() → checks keychain for tokens
    ↓
If tokens exist → try Supabase session refresh → authenticated
If no tokens → unauthenticated → show LoginView
```

### Key Observations

1. **KeychainManager** (`KeychainManager.swift:54-73`) stores tokens with `kSecAttrAccessibleAfterFirstUnlock`:
   - Tokens are accessible after device unlock
   - NO biometric protection currently
   - Tokens persist across app launches

2. **AppState.checkAuthState()** (`AppState.swift:47-60`):
   - Called on every app launch
   - Automatically restores session if tokens exist
   - No biometric check

3. **UserDefaults keys** (`AppState.swift:24-30`):
   - `pulpe-onboarding-completed`
   - `pulpe-tutorial-completed`
   - (Need to add: `pulpe-biometric-enabled`)

---

## Documentation Insights

### LocalAuthentication Framework

**Key APIs:**

| API | Purpose |
|-----|---------|
| `LAContext` | Main class for biometric authentication |
| `canEvaluatePolicy(_:error:)` | Check if biometrics available |
| `evaluatePolicy(_:localizedReason:)` | Trigger biometric prompt |
| `biometryType` | Get `.faceID`, `.touchID`, or `.none` |

**Authentication Policies:**
- `.deviceOwnerAuthenticationWithBiometrics` - Biometric only
- `.deviceOwnerAuthentication` - Biometric OR passcode fallback

**Error Handling (LAError.Code):**
- `.userCancel` - User tapped Cancel
- `.biometryNotAvailable` - Device doesn't support
- `.biometryNotEnrolled` - User hasn't set up Face ID/Touch ID
- `.biometryLockout` - Too many failed attempts

### Keychain Biometric Protection

**Access Control Flags:**

| Flag | Behavior |
|------|----------|
| `.biometryCurrentSet` | Requires current biometrics; invalidated if user changes enrolled biometrics |
| `.biometryAny` | Works with any biometric enrollment |
| `.userPresence` | Biometric OR passcode fallback |

**Recommended for tokens:** `.biometryCurrentSet` for stricter security

**Accessibility Levels:**
- `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` (recommended for biometric items)

### Supabase Swift SDK

**Custom Storage Adapter:**
```swift
let client = SupabaseClient(
    supabaseURL: URL(string: "...")!,
    supabaseKey: "...",
    options: SupabaseClientOptions(
        auth: .init(
            storage: MyCustomLocalStorage(),
            flowType: .pkce
        )
    )
)
```

The SDK supports custom `AuthLocalStorage` for token persistence.

---

## Research Findings

### Recommended Architecture Pattern

```
┌─ App Launch ──────────────────────────────────────────┐
│                                                        │
│  1. Check UserDefaults["biometric_enabled"]           │
│     ├─ FALSE → Clear tokens → Show LoginView          │
│     └─ TRUE → Attempt biometric auth                  │
│                                                        │
│  2. If biometric enabled:                             │
│     ├─ Create fresh LAContext                         │
│     ├─ evaluatePolicy → biometric prompt              │
│     ├─ Success → Retrieve tokens → Restore session    │
│     └─ Failure → Show LoginView                       │
│                                                        │
│  3. After successful login:                           │
│     ├─ Check biometric availability                   │
│     ├─ Ask: "Enable Face ID/Touch ID?"               │
│     ├─ If yes → Store tokens + set preference         │
│     └─ If no → Clear tokens (next launch = re-login)  │
└───────────────────────────────────────────────────────┘
```

### Best Practices

1. **Store tokens in Keychain** with biometric protection - NOT UserDefaults
2. **Store preference in UserDefaults** - just a boolean, not sensitive
3. **Create fresh LAContext** for each authentication attempt
4. **Never store email/password** - only tokens
5. **Handle lockout gracefully** - require manual login after lockout

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `ios/Pulpe/Core/Auth/KeychainManager.swift` | Add biometric-protected token storage methods |
| `ios/Pulpe/App/AppState.swift` | Modify `checkAuthState()` logic, add biometric preference |
| `ios/Pulpe/Features/Account/AccountView.swift` | Add biometric toggle UI |
| `ios/Pulpe/Features/Auth/LoginView.swift` | Offer biometric enrollment after login |
| `ios/Pulpe/Info.plist` | Add `NSFaceIDUsageDescription` |

## New Files to Create

| File | Purpose |
|------|---------|
| `ios/Pulpe/Core/Auth/BiometricService.swift` | Handle LocalAuthentication logic |

---

## Patterns to Follow

### Existing UserDefaults Pattern
```swift
// From AppState.swift:24-26
var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: "pulpe-onboarding-completed") {
    didSet { UserDefaults.standard.set(hasCompletedOnboarding, forKey: "pulpe-onboarding-completed") }
}
```

### Existing Actor Pattern
```swift
// From AuthService.swift:6
actor AuthService {
    static let shared = AuthService()
    ...
}
```

### Existing Keychain Pattern
```swift
// From KeychainManager.swift:5
actor KeychainManager {
    static let shared = KeychainManager()
    ...
}
```

---

## Dependencies

### Required Framework
- `LocalAuthentication` (iOS built-in)

### Info.plist Entry
```xml
<key>NSFaceIDUsageDescription</key>
<string>Utilisez Face ID pour vous connecter rapidement et en toute sécurité.</string>
```

---

## Implementation Notes

### Token Storage Strategy

Two approaches considered:

**Option A: Separate keychain items** (Recommended)
- Non-biometric tokens: existing storage
- Biometric-protected tokens: new storage with access control
- Clear non-biometric on logout, keep biometric tokens for next session

**Option B: Modify existing storage**
- Change `kSecAttrAccessible` to `kSecAttrAccessControl` with biometry
- Requires migration logic

### Biometric Flow Details

1. **On app launch (if biometric enabled):**
   - Show loading state
   - Create `LAContext`
   - Call `evaluatePolicy` with reason: "Authentifiez-vous pour accéder à Pulpe"
   - On success: retrieve tokens from keychain, restore session
   - On failure: clear session, show login

2. **On successful login:**
   - Check `LAContext.canEvaluatePolicy`
   - If biometrics available: show prompt "Activer Face ID/Touch ID ?"
   - If user accepts: store tokens with biometric protection, set preference

3. **On logout:**
   - Clear all tokens (biometric and non-biometric)
   - Clear biometric preference (user must re-enable)

4. **In settings (AccountView):**
   - Show toggle if biometrics available
   - Toggle ON: store current tokens with biometric protection
   - Toggle OFF: clear biometric tokens, next launch = login required

---

## UI Strings (French)

| Key | Value |
|-----|-------|
| Biometric prompt | "Authentifiez-vous pour accéder à Pulpe" |
| Face ID toggle | "Face ID" |
| Touch ID toggle | "Touch ID" |
| Enable prompt title | "Activer Face ID ?" / "Activer Touch ID ?" |
| Enable prompt message | "Utilisez la reconnaissance faciale pour vous connecter plus rapidement" |
| Info.plist description | "Utilisez Face ID pour vous connecter rapidement et en toute sécurité." |

---

## Testing Considerations

- Test on physical device (simulator biometrics are limited)
- Test Face ID device (iPhone X+)
- Test Touch ID device (iPhone 8/SE)
- Test biometric lockout scenario
- Test biometric enrollment changes
- Test app backgrounding during biometric prompt
