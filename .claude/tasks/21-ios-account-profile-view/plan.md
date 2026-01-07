# Implementation Plan: iOS Account/Profile View

## Overview

Add an account button (person.circle) to the toolbar and create a simple account sheet displaying user email, app version/build, and logout functionality. Also clean up the existing menu by removing redundant options.

## Dependencies

- `AppState` - provides `currentUser?.email` and `logout()`
- `AppConfiguration` - provides `appVersion` and `buildNumber`
- Existing sheet/toolbar patterns in app

## File Changes

### 1. `ios/Pulpe/Features/Account/AccountView.swift` (CREATE)

Create new file with simple account sheet view:

- Add `@Environment(\.dismiss)` for closing sheet
- Add `@Environment(AppState.self)` to access user data and logout
- Structure with `NavigationStack` wrapping `List`
- **Section 1 - "INFORMATIONS PERSONNELLES"**:
  - Row displaying email using `LabeledContent("E-mail", value:)`
  - Value from `appState.currentUser?.email ?? "Non connecté"`
- **Section 2 - "APPLICATION"**:
  - Row for Version: `AppConfiguration.appVersion`
  - Row for Build: `AppConfiguration.buildNumber`
- **Section 3 - Logout**:
  - Destructive button "Déconnexion" with `role: .destructive`
  - On tap: call `appState.logout()` then `dismiss()`
- **Footer text** (outside sections, at bottom):
  - Display "Version X.Y.Z - Y" format like Raiffeisen screenshot
  - Use `Section` with footer or `Text` at end of list
- NavigationTitle: "Compte"
- Toolbar with close button (placement: `.cancellationAction`)
- Use `.listStyle(.insetGrouped)` to match app style

### 2. `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift` (MODIFY)

**Add state variable** (around line 11):
- Add `@State private var showAccount = false`

**Modify toolbar** (lines 31-70):
- Remove the entire `Menu` block (lines 40-58) - this removes both "Actualiser" and "Se déconnecter"
- Add new `ToolbarItem` for account button with `person.circle` SF Symbol
- Position: `placement: .primaryAction`, placed FIRST (before chart button)
- Action: set `showAccount = true`

**Add sheet modifier** (after line 105, with other sheets):
- Add `.sheet(isPresented: $showAccount)` presenting `AccountView()`

**Final toolbar order should be**:
1. Account button (person.circle) - NEW
2. Chart button (chart.bar.fill) - existing
3. ToolbarSpacer (iOS 26)
4. Plus button (plus) - existing

---

## Testing Strategy

### Manual Verification
1. Launch app and navigate to "Ce mois-ci" tab
2. Verify person.circle button appears in toolbar (first position)
3. Tap profile button → AccountView sheet opens
4. Verify email displays correctly (from Supabase auth)
5. Verify version and build number display correctly
6. Tap "Déconnexion" → confirm logout works and navigates to login
7. Verify "Actualiser" menu option is gone (pull-to-refresh still works)
8. Test pull-to-refresh still functions correctly

### Edge Cases
- User with no email (should show "Non connecté")
- Sheet dismissal via swipe down
- Sheet dismissal via "Fermer" button

---

## Rollout Considerations

- No migrations needed
- No breaking changes
- Simple additive feature + cleanup
- iOS version compatibility: Uses standard SwiftUI APIs (iOS 15+)
