# Task: iOS Maintenance Mode Implementation

## Summary

Implement a maintenance mode feature for the iOS app, mirroring the Angular frontend implementation:
1. Detect 503 responses with `code: 'MAINTENANCE'` from API calls
2. Check maintenance status at app startup via `/maintenance/status` endpoint
3. Display a maintenance page with Lottie animation
4. Allow users to retry and check if maintenance is over

---

## Architecture Overview

The backend already handles maintenance mode. The iOS app needs to:
1. **Intercept 503 + MAINTENANCE responses** from APIClient
2. **Check status at startup** before showing main content
3. **Display a MaintenanceView** with Lottie animation
4. **Provide retry functionality** to check if maintenance ended

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Already implemented)                                  │
│  ─────────────────────────────────────────────────────────────  │
│  MAINTENANCE_MODE=true → All routes return 503                  │
│  Whitelist: /health, /api/v1/maintenance/status                 │
│                                                                 │
│  Response: { statusCode: 503, code: 'MAINTENANCE', message }    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  iOS App                                                        │
│  ─────────────────────────────────────────────────────────────  │
│  1. APIClient: detect 503 + code=MAINTENANCE                    │
│     → Set appState.isInMaintenance = true                       │
│                                                                 │
│  2. PulpeApp: check /maintenance/status at startup              │
│     → Block app if maintenance active                           │
│                                                                 │
│  3. RootView: show MaintenanceView when isInMaintenance         │
│     → Display Lottie + retry button                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Codebase Context

### Angular Implementation (Reference)

**MaintenancePage** (`frontend/projects/webapp/src/app/feature/maintenance/maintenance-page.ts:1-87`)
- Standalone component with Lottie animation
- Uses `checkAndReload()` to verify if maintenance ended
- On success, redirects to home via `window.location.href = '/'`
- Displays French message: "Maintenance en cours"

**MaintenanceInterceptor** (`frontend/projects/webapp/src/app/core/maintenance/maintenance.interceptor.ts:1-27`)
- Catches 503 with `error.error?.code === 'MAINTENANCE'`
- Redirects to `/maintenance` route
- Returns `EMPTY` to stop error propagation

**MaintenanceApi** (`frontend/projects/webapp/src/app/core/maintenance/maintenance-api.ts:1-31`)
- Uses native `fetch` (not HttpClient) to avoid interceptor loops
- Endpoint: `GET /maintenance/status`
- Response: `{ maintenanceMode: boolean }`

**MaintenanceGuard** (`frontend/projects/webapp/src/app/core/maintenance/maintenance.guard.ts:1-38`)
- Checks maintenance status at route activation
- Fail-closed: assumes maintenance on network errors

### Backend Maintenance

**MaintenanceMiddleware** (`backend-nest/src/common/middleware/maintenance.middleware.ts:1-27`)
```typescript
// Returns when MAINTENANCE_MODE=true
{
  statusCode: 503,
  code: 'MAINTENANCE',
  message: 'Application en maintenance. Veuillez réessayer plus tard.'
}
```

**Status Endpoint** (`backend-nest/src/main.ts:154-162`)
```typescript
// GET /api/v1/maintenance/status
{
  maintenanceMode: boolean,
  message: string
}
```

### iOS App Structure

**PulpeApp Entry Point** (`ios/Pulpe/App/PulpeApp.swift:9-45`)
- Main entry with `@main` attribute
- RootView handles auth state switching
- Already has task to check auth at startup

**AppState** (`ios/Pulpe/App/AppState.swift:11-159`)
- `@Observable @MainActor` class
- Manages `authState: AuthStatus` (loading/unauthenticated/authenticated)
- Pattern to follow for maintenance state

**RootView** (`ios/Pulpe/App/PulpeApp.swift:47-127`)
```swift
Group {
    switch appState.authState {
    case .loading: LoadingView(message: "Chargement...")
    case .unauthenticated: LoginView() or OnboardingFlow()
    case .authenticated: MainTabView()
    }
}
```
- Add maintenance case before auth check

**APIClient** (`ios/Pulpe/Core/Network/APIClient.swift:1-223`)
- Actor-based, thread-safe
- `parseError()` handles status codes (lines 166-194)
- Need to add 503 MAINTENANCE detection

**APIError** (`ios/Pulpe/Core/Network/APIError.swift:1-95`)
- Enum with localized French messages
- Pattern: `case maintenance` with specific message
- `static func from(code: String?, message: String?)` for code-based creation

**Endpoints** (`ios/Pulpe/Core/Network/Endpoints.swift:1-132`)
- Enum with all API paths
- Need to add: `case maintenanceStatus`

**AppConfiguration** (`ios/Pulpe/Core/Config/AppConfiguration.swift:1-71`)
- `apiBaseURL` already includes `/api/v1` prefix
- Debug: `http://localhost:3000/api/v1`
- Release: Production Railway URL

### Existing Lottie Usage

**WelcomeLottieView** (`ios/Pulpe/Shared/Components/WelcomeLottieView.swift:1-23`)
```swift
import Lottie
import SwiftUI

struct WelcomeLottieView: View {
    let size: CGFloat

    var body: some View {
        LottieView(animation: .named("welcome-animation"))
            .playing(loopMode: .loop)
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}
```

**Lottie Resources Location** (`ios/Pulpe/Resources/Lottie/`)
- Already has: `welcome-animation.json`
- Need to add: `maintenance-animation.json`

**Lottie SPM Dependency** (`ios/project.yml:14-16`)
```yaml
lottie-spm:
  url: https://github.com/airbnb/lottie-spm
  from: "4.0.0"
```

---

## Key Files to Create/Modify

### Create

| File | Purpose |
|------|---------|
| `ios/Pulpe/Resources/Lottie/maintenance-animation.json` | Copy from frontend |
| `ios/Pulpe/Features/Maintenance/MaintenanceView.swift` | Full-screen maintenance UI |
| `ios/Pulpe/Core/Maintenance/MaintenanceService.swift` | Status check service |

### Modify

| File | Change |
|------|--------|
| `ios/Pulpe/App/AppState.swift` | Add `isInMaintenance: Bool` state |
| `ios/Pulpe/App/PulpeApp.swift` | Check maintenance at startup, show MaintenanceView |
| `ios/Pulpe/Core/Network/APIError.swift` | Add `case maintenance` |
| `ios/Pulpe/Core/Network/APIClient.swift` | Detect 503 MAINTENANCE in parseError |
| `ios/Pulpe/Core/Network/Endpoints.swift` | Add `case maintenanceStatus` |

---

## Patterns to Follow

### MaintenanceService Pattern

```swift
// MaintenanceService.swift
import Foundation

actor MaintenanceService {
    static let shared = MaintenanceService()

    private init() {}

    struct StatusResponse: Decodable {
        let maintenanceMode: Bool
        let message: String?
    }

    func checkStatus() async throws -> Bool {
        let url = AppConfiguration.apiBaseURL.appendingPathComponent("/maintenance/status")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError(message: "Impossible de vérifier le statut")
        }

        let status = try JSONDecoder().decode(StatusResponse.self, from: data)
        return status.maintenanceMode
    }
}
```

### APIError Extension

```swift
// In APIError.swift
case maintenance

// In errorDescription
case .maintenance:
    return "Application en maintenance — réessaie dans quelques instants"

// In from(code:message:)
case "MAINTENANCE":
    return .maintenance
```

### AppState Extension

```swift
// In AppState.swift
private(set) var isInMaintenance = false

func setMaintenanceMode(_ active: Bool) {
    isInMaintenance = active
}

func checkMaintenanceStatus() async {
    do {
        isInMaintenance = try await MaintenanceService.shared.checkStatus()
    } catch {
        // Fail-closed: assume maintenance on error (like Angular)
        isInMaintenance = true
    }
}
```

### RootView Modification

```swift
// In RootView body
Group {
    if appState.isInMaintenance {
        MaintenanceView()
    } else {
        switch appState.authState {
        case .loading: LoadingView(message: "Chargement...")
        case .unauthenticated: ...
        case .authenticated: ...
        }
    }
}
.task {
    await appState.checkMaintenanceStatus()
    if !appState.isInMaintenance {
        await appState.checkAuthState()
    }
}
```

### MaintenanceView Component

```swift
// MaintenanceView.swift
import Lottie
import SwiftUI

struct MaintenanceView: View {
    @Environment(AppState.self) private var appState
    @State private var isChecking = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            LottieView(animation: .named("maintenance-animation"))
                .playing(loopMode: .loop)
                .resizable()
                .scaledToFit()
                .frame(width: 200, height: 200)

            Text("Maintenance en cours")
                .font(.title)
                .fontWeight(.bold)

            Text("On améliore Pulpe pour toi — tes données sont bien au chaud, pas d'inquiétude. Réessaie dans quelques instants.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let error = errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task { await checkAndRetry() }
            } label: {
                if isChecking {
                    ProgressView()
                } else {
                    Label("Réessayer", systemImage: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isChecking)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
    }

    private func checkAndRetry() async {
        isChecking = true
        errorMessage = nil

        do {
            let stillInMaintenance = try await MaintenanceService.shared.checkStatus()
            if !stillInMaintenance {
                appState.setMaintenanceMode(false)
            } else {
                errorMessage = "Toujours en maintenance — réessaie dans un instant"
            }
        } catch {
            errorMessage = "Connexion difficile — réessaie dans un instant"
        }

        isChecking = false
    }
}
```

---

## Dependencies

- `Lottie` package (already added in project.yml)
- No new external dependencies needed

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| App launch during maintenance | checkMaintenanceStatus() at startup → show MaintenanceView |
| API call returns 503 MAINTENANCE | APIClient sets appState.isInMaintenance = true |
| Network error checking status | Fail-closed → assume maintenance |
| Maintenance ends while on page | Retry button → check status → exit maintenance mode |
| Already authenticated when maintenance starts | Next API call triggers maintenance detection |

---

## Testing Checklist

- [ ] Set `MAINTENANCE_MODE=true` on backend → app shows MaintenanceView
- [ ] Lottie animation plays in loop
- [ ] Retry button checks status and exits if maintenance ended
- [ ] API calls during maintenance show MaintenanceView
- [ ] App works normally when maintenance is off
- [ ] French messages display correctly

---

## Animation Asset

The maintenance Lottie animation needs to be copied from:
`frontend/projects/webapp/public/lottie/maintenance-animation.json`

To:
`ios/Pulpe/Resources/Lottie/maintenance-animation.json`

Note: The file is large (48007 tokens). It should be copied as-is without modification.
