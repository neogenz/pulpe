# Implementation Plan: iOS Maintenance Mode

## Overview

Implement maintenance mode for the iOS app following the Angular frontend pattern:
- Detect 503 + code='MAINTENANCE' responses from API
- Check maintenance status at startup before authentication
- Display MaintenanceView with Lottie animation and retry button
- Use fail-closed approach (assume maintenance on network errors)

## Dependencies

Order of implementation (files with dependencies must come after their dependencies):

1. Lottie animation asset (no deps)
2. APIError.swift (no deps)
3. MaintenanceService.swift (depends on AppConfiguration)
4. APIClient.swift (depends on APIError)
5. AppState.swift (depends on MaintenanceService)
6. MaintenanceView.swift (depends on AppState, MaintenanceService, Lottie asset)
7. PulpeApp.swift (depends on MaintenanceView, AppState)

---

## File Changes

### `ios/Pulpe/Resources/Lottie/maintenance-animation.json`
**Action: CREATE** - Copy Lottie animation from frontend

- Copy file from `frontend/projects/webapp/public/lottie/maintenance-animation.json`
- Place in existing Lottie resources folder alongside `welcome-animation.json`
- No modifications needed - copy as-is

---

### `ios/Pulpe/Core/Network/APIError.swift`
**Action: MODIFY** - Add maintenance error case

- Add new case `maintenance` in the APIError enum (around line 25, after `rateLimited`)
- Add French error description in `errorDescription` computed property: "Application en maintenance — réessaie dans quelques instants"
- Add case handling in `static func from(code:message:)` for code "MAINTENANCE" returning `.maintenance`
- Follow existing pattern for other error cases

---

### `ios/Pulpe/Core/Maintenance/MaintenanceService.swift`
**Action: CREATE** - Maintenance status check service

- Create new directory `ios/Pulpe/Core/Maintenance/`
- Create actor `MaintenanceService` with `static let shared` singleton pattern
- Add private `StatusResponse` struct with `maintenanceMode: Bool` and optional `message: String`
- Implement `func checkStatus() async throws -> Bool`
  - Build URL from `AppConfiguration.apiBaseURL.appendingPathComponent("/maintenance/status")`
  - Use `URLSession.shared.data(for:)` directly (NOT APIClient to avoid interceptor loops)
  - Set Accept header to "application/json"
  - Decode response and return `maintenanceMode` value
  - Throw error on non-2xx status codes
- IMPORTANT: Must NOT use APIClient to avoid circular dependency with maintenance detection

---

### `ios/Pulpe/Core/Network/APIClient.swift`
**Action: MODIFY** - Detect maintenance mode in API responses

- Modify `parseError(from:statusCode:)` function (around lines 166-194)
- Add handling for status code 503:
  - Try to decode response body to check for `code` field
  - If `code == "MAINTENANCE"`, return `APIError.maintenance`
  - Otherwise fall through to existing server error handling
- Consider: Need to decode a simple response structure `{ code: String? }` to check for MAINTENANCE code

---

### `ios/Pulpe/App/AppState.swift`
**Action: MODIFY** - Add maintenance state management

- Add property `private(set) var isInMaintenance = false` (around line 21, after authState)
- Add method `func setMaintenanceMode(_ active: Bool)` to update the state
- Add method `func checkMaintenanceStatus() async`:
  - Call `MaintenanceService.shared.checkStatus()`
  - On success: set `isInMaintenance` to returned value
  - On error: set `isInMaintenance = true` (fail-closed pattern like Angular)
- Import statement: No new imports needed (Foundation already imported)

---

### `ios/Pulpe/Features/Maintenance/MaintenanceView.swift`
**Action: CREATE** - Maintenance UI component

- Create new directory `ios/Pulpe/Features/Maintenance/`
- Create SwiftUI view `MaintenanceView`
- Import Lottie and SwiftUI
- Use `@Environment(AppState.self)` to access app state
- Add `@State` properties for `isChecking: Bool` and `errorMessage: String?`
- Build UI layout following WelcomeLottieView pattern:
  - LottieView with animation named "maintenance-animation", looping, size 200x200
  - Title: "Maintenance en cours" (title font, bold)
  - Description: "On améliore Pulpe pour toi — tes données sont bien au chaud, pas d'inquiétude. Réessaie dans quelques instants." (body font, secondary color, centered)
  - Optional error message display in red
  - Retry button with "Réessayer" label and arrow.clockwise icon, borderedProminent style
- Implement `checkAndRetry()` async function:
  - Set isChecking = true, clear errorMessage
  - Call MaintenanceService.shared.checkStatus()
  - If not in maintenance: call appState.setMaintenanceMode(false)
  - If still in maintenance: set errorMessage = "Toujours en maintenance — réessaie dans un instant"
  - On error: set errorMessage = "Connexion difficile — réessaie dans un instant"
  - Set isChecking = false
- Add Preview macro

---

### `ios/Pulpe/App/PulpeApp.swift`
**Action: MODIFY** - Integrate maintenance check in app flow

- Modify `RootView` body (around lines 54-77):
  - Wrap existing auth state switch in conditional
  - Check `appState.isInMaintenance` first, show `MaintenanceView()` if true
  - Otherwise show existing auth state handling
- Modify `.task` modifier (around line 81):
  - Call `await appState.checkMaintenanceStatus()` FIRST
  - Only call `await appState.checkAuthState()` if NOT in maintenance
- This ensures maintenance is checked before any auth validation

---

## Testing Strategy

### Manual Testing Steps

1. **Maintenance active at startup**
   - Set `MAINTENANCE_MODE=true` on backend
   - Launch app fresh → should see MaintenanceView with animation

2. **Maintenance during session**
   - Login normally with maintenance off
   - Enable maintenance on backend
   - Perform any API action → should redirect to MaintenanceView

3. **Retry functionality**
   - While on MaintenanceView, disable maintenance on backend
   - Tap "Réessayer" → should exit maintenance and show normal app

4. **Network error handling**
   - Disconnect network while checking maintenance status
   - Should fail-closed to MaintenanceView

5. **Animation verification**
   - Verify Lottie animation plays in loop
   - Check animation renders correctly on different device sizes

### Build Verification

```bash
cd ios && xcodegen generate && xcodebuild build -scheme Pulpe -destination 'platform=iOS Simulator,name=iPhone 15' CODE_SIGNING_ALLOWED=NO
```

---

## Documentation

No documentation updates required. The feature is internal and follows the same pattern as the Angular frontend.

---

## Rollout Considerations

- **No breaking changes**: Feature is additive
- **No migration needed**: New state property defaults to false
- **Backend compatible**: Backend endpoint already exists and is tested
- **Regenerate Xcode project**: Run `xcodegen generate` after adding new files
