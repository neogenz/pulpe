# Implementation: iOS Maintenance Mode

## Completed

### Files Created
- `ios/Pulpe/Resources/Lottie/maintenance-animation.json` - Copied from frontend
- `ios/Pulpe/Core/Maintenance/MaintenanceService.swift` - Actor-based service for checking maintenance status
- `ios/Pulpe/Features/Maintenance/MaintenanceView.swift` - Full-screen maintenance UI with Lottie animation and retry button

### Files Modified
- `ios/Pulpe/Core/Network/APIError.swift` - Added `case maintenance` with French error message and code handling
- `ios/Pulpe/Core/Network/APIClient.swift` - Added notification broadcast when maintenance error is detected
- `ios/Pulpe/App/AppState.swift` - Added `isInMaintenance` state property and related methods
- `ios/Pulpe/App/PulpeApp.swift` - Integrated maintenance check at startup and notification listener

## Implementation Details

### Maintenance Detection Flow

1. **At Startup**: RootView's `.task` calls `appState.checkMaintenanceStatus()` before checking auth
2. **During Session**: APIClient broadcasts `maintenanceModeDetected` notification when 503 + code="MAINTENANCE" is detected
3. **UI Response**: RootView listens for notification and sets maintenance mode, showing MaintenanceView

### Key Patterns Used

- **Notification Pattern**: Used `NotificationCenter` to communicate from APIClient actor to MainActor (AppState)
- **Fail-Closed**: On network errors checking maintenance status, assumes maintenance is active (matches Angular pattern)
- **Actor Isolation**: MaintenanceService is an actor using `URLSession.shared` directly (not APIClient) to avoid interceptor loops

## Deviations from Plan

None - implementation followed the plan exactly.

## Test Results

- Typecheck: (xcodebuild build succeeded)
- Lint: N/A (no SwiftLint configured)
- Tests: N/A (no unit tests for this feature yet)

## Manual Testing Checklist

- [ ] Set `MAINTENANCE_MODE=true` on backend -> app shows MaintenanceView
- [ ] Lottie animation plays in loop
- [ ] Retry button checks status and exits if maintenance ended
- [ ] API calls during maintenance show MaintenanceView
- [ ] App works normally when maintenance is off
- [ ] French messages display correctly

## Files Reference

| File | Purpose |
|------|---------|
| `ios/Pulpe/Core/Maintenance/MaintenanceService.swift:1-33` | Status check actor |
| `ios/Pulpe/Features/Maintenance/MaintenanceView.swift:1-69` | Maintenance UI |
| `ios/Pulpe/Core/Network/APIError.swift:26,68-69,92-93` | Maintenance error case |
| `ios/Pulpe/Core/Network/APIClient.swift:166-180` | Maintenance detection |
| `ios/Pulpe/App/AppState.swift:22-24,161-172` | Maintenance state |
| `ios/Pulpe/App/PulpeApp.swift:57-80,84-92` | Integration |

## Follow-up Tasks

- Add unit tests for MaintenanceService
- Add UI tests for maintenance flow
