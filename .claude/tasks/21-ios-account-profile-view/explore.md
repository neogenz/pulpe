# Task: Add Account/Profile View to iOS App

Add a profile button in the top toolbar (person.circle icon) and create an account sheet displaying user email, app version, build info, and logout functionality - similar to the Angular frontend.

## Screenshots Reference
- **Screenshot 1**: Account page with sections (Informations personnelles, Paramètres de l'application, Support) - shows grouped form layout with version display at bottom
- **Screenshot 2**: Main view with profile button (person.circle) in top toolbar next to search icon

---

## Codebase Context

### iOS App Structure (Primary Target)

#### Authentication & User State
- **AppState.swift:7-79** - Central state manager
  - `currentUser: UserInfo?` at line 14 - holds user ID and email
  - `logout()` at lines 70-79 - clears user state, resets navigation
  - Access via `@Environment(AppState.self)`

- **AuthService.swift:134-139** - UserInfo struct
  ```swift
  struct UserInfo: Codable, Equatable, Sendable {
      let id: String
      let email: String
  }
  ```

#### App Version & Build Info
- **AppConfiguration.swift:48-60** - Already implemented!
  ```swift
  static var appVersion: String {
      Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "Unknown"
  }

  static var buildNumber: String {
      Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "Unknown"
  }

  static var bundleIdentifier: String {
      Bundle.main.bundleIdentifier ?? "Unknown"
  }
  ```

#### Main Toolbar (Where to add profile button)
- **CurrentMonthView.swift:30-71** - Main view with existing toolbar
  - Lines 31-58: `.toolbar` block with multiple `ToolbarItem`s
  - Lines 50-54: Existing logout button in menu (can be moved to profile view)
  - Pattern: `ToolbarItem(placement: .primaryAction)`

#### Sheet Presentation Pattern
- **AddTransactionSheet.swift:1-126** - Template for profile sheet
  - Line 8: `@Environment(\.dismiss)` for closing
  - Lines 26-93: `NavigationStack` wrapping `Form` with sections
  - Lines 78-91: Toolbar with cancel/confirm buttons

### Angular Frontend (Reference Implementation)

#### User Menu & About Dialog
- **main-layout.ts:226-279** - User menu implementation
  - Line 368-373: userEmail computed signal (shows "demo@gmail.com" for demo users)
  - Line 451-456: Opens AboutDialog for version info
  - Lines 458-488: onLogout() method

- **about-dialog.ts:1-149** - Version/build information display
  - Sections: Build, Environment, Configuration, Analytics
  - Build info: version, commit hash, build date
  - Environment: development/production mode

#### Build Info Source
- **build-info.ts:10-18** - Auto-generated metadata
  ```typescript
  export const buildInfo = {
    version: '2025.16.0',          // YYYY.WW.PATCH format
    commitHash: 'full-hash',
    shortCommitHash: '3a3ac9b',    // 7 chars
    buildDate: '2026-01-07T...',
    buildTimestamp: 1736262089
  } as const;
  ```

---

## Key Files to Modify/Create

### Files to Modify
| File | Line | Change |
|------|------|--------|
| `CurrentMonthView.swift` | ~32 | Add profile button to toolbar |
| `CurrentMonthView.swift` | ~50-54 | Remove logout from menu (moved to profile) |

### Files to Create
| File | Purpose |
|------|---------|
| `Features/Account/AccountView.swift` | Main account sheet view |

---

## Patterns to Follow

### 1. Sheet Presentation (existing pattern)
```swift
@State private var showAccount = false

.toolbar {
    ToolbarItem(placement: .primaryAction) {
        Button {
            showAccount = true
        } label: {
            Image(systemName: "person.circle")
        }
    }
}
.sheet(isPresented: $showAccount) {
    AccountView()
}
```

### 2. Sheet View Structure (from AddTransactionSheet)
```swift
struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                // Sections here
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Compte")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
}
```

### 3. Grouped Form Sections
```swift
Section {
    LabeledContent("E-mail", value: appState.currentUser?.email ?? "Non connecté")
} header: {
    Text("INFORMATIONS PERSONNELLES")
}
```

### 4. Version Display (bottom of view)
```swift
Section {
    LabeledContent("Version", value: AppConfiguration.appVersion)
    LabeledContent("Build", value: AppConfiguration.buildNumber)
}
```

### 5. Logout Button (danger style)
```swift
Section {
    Button("Déconnexion", role: .destructive) {
        appState.logout()
        dismiss()
    }
}
```

---

## Information to Display (from Angular Reference)

### Sections to Include

1. **INFORMATIONS PERSONNELLES**
   - E-mail: `appState.currentUser?.email`

2. **APPLICATION** (simplified from Angular's About dialog)
   - Version: `AppConfiguration.appVersion`
   - Build: `AppConfiguration.buildNumber`
   - (Optional) Environment: from AppConfiguration if available

3. **Déconnexion** (as destructive button)

### Footer
- Display version/build at bottom in footer style (like Raiffeisen screenshot: "Version 19.14.5 - 2")

---

## Dependencies & Prerequisites

### Already Available
- `AppState` with `currentUser` and `logout()` ✅
- `AppConfiguration` with `appVersion` and `buildNumber` ✅
- `UserInfo` struct with `email` field ✅
- Sheet presentation pattern ✅
- Toolbar button pattern ✅

### Not Needed
- Demo mode handling (iOS app doesn't have demo mode currently)
- PostHog/Analytics display (keep iOS simpler)
- Configuration URLs (not relevant for mobile)

---

## Architecture Insights

1. **Simple scope**: Just account info + logout, no settings/preferences
2. **French labels**: "Compte", "E-mail", "Version", "Déconnexion"
3. **Follow existing patterns**: Use same toolbar/sheet/form patterns as rest of app
4. **Single entry point**: Profile button in CurrentMonthView toolbar
5. **No state management needed**: Just display existing AppState data

---

## Implementation Notes

### SF Symbol for Profile Button
- Use `person.circle` (matches Raiffeisen screenshot style)
- Alternative: `person.crop.circle` (filled version)

### List vs Form
- Use `List` with `.insetGrouped` style (matches existing views)
- Alternatively `Form` which auto-applies `.insetGrouped`

### Logout Flow
1. Call `appState.logout()`
2. Dismiss the sheet
3. App will automatically navigate to login (AppState handles auth state)

### Version Format
- Display: "Version X.Y.Z - Build N"
- Or separate rows: Version | X.Y.Z, Build | N
