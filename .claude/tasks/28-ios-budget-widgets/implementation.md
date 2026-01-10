# Implementation: iOS Budget Widgets

## Completed

### Phase 1: Configuration
- Created `ios/Pulpe/Pulpe.entitlements` with App Groups capability (`group.app.pulpe.ios`)
- Created `ios/PulpeWidget/PulpeWidget.entitlements` with matching App Groups
- Updated `ios/project.yml` with:
  - Widget extension target `PulpeWidget`
  - URL scheme `pulpe://` for deep linking
  - Shared sources between app and widget (Models, Formulas, Extensions, Formatters)
  - PulpeWidget scheme for debugging

### Phase 2: Data Layer
- Created `ios/PulpeWidget/Models/BudgetWidgetData.swift`:
  - `BudgetWidgetData` struct for widget display data
  - `WidgetDataCache` struct for cached budget data with staleness check
- Created `ios/PulpeWidget/Services/WidgetDataCoordinator.swift`:
  - App Group UserDefaults-based data sharing
  - JSON encoding/decoding for cache persistence

### Phase 3: App Integration
- Created `ios/Pulpe/Domain/Services/WidgetDataSyncService.swift`:
  - Actor service for syncing budget data to widget
  - Builds current month and year overview data
  - Triggers `WidgetCenter.reloadAllTimelines()`
- Modified `ios/Pulpe/App/PulpeApp.swift`:
  - Added `DeepLinkDestination` enum
  - Added `.onOpenURL` handler for `pulpe://add-expense`
  - Added `DeepLinkAddExpenseSheet` for widget-triggered expense creation
- Modified `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift`:
  - Added `syncWidgetData()` method called after `loadData()`
  - Widget data refreshes when user navigates to current month view

### Phase 4: Widget Extension
- Created `ios/PulpeWidget/PulpeWidgetBundle.swift`:
  - Entry point with CurrentMonthWidget and YearOverviewWidget
- Created `ios/PulpeWidget/Intents/AddExpenseIntent.swift`:
  - AppIntent for interactive `+` button with `openAppWhenRun = true`
- Created CurrentMonth widget (`ios/PulpeWidget/Widgets/CurrentMonth/`):
  - `CurrentMonthEntry.swift` - Timeline entry with available amount
  - `CurrentMonthProvider.swift` - Loads from App Group cache
  - `CurrentMonthWidgetView.swift` - Small/Medium layouts with interactive button
  - `CurrentMonthWidget.swift` - StaticConfiguration for `.systemSmall`, `.systemMedium`
- Created YearOverview widget (`ios/PulpeWidget/Widgets/YearOverview/`):
  - `YearOverviewEntry.swift` - 12-month data with current month highlight
  - `YearOverviewProvider.swift` - Year budget data loader
  - `YearOverviewWidgetView.swift` - 4x3 grid layout
  - `YearOverviewWidget.swift` - StaticConfiguration for `.systemLarge`

## Deviations from Plan

1. **Shared sources approach**: Instead of copying files to the widget, used project.yml source sharing to include Domain/Models, Domain/Formulas, and Shared/Extensions in both targets
2. **Excluded View+Extensions.swift** from widget target due to UIApplication.shared usage (unavailable in app extensions)
3. **Added PulpeWidget/Models and PulpeWidget/Services** to main Pulpe target so WidgetDataSyncService can access shared data types
4. **Type inference fix**: Changed `foregroundStyle()` to `foregroundColor()` in YearOverviewWidgetView to fix Swift type inference issue with ternary operator

## Test Results

- Xcode project generation: ✓
- Build (simulator): ✓ **BUILD SUCCEEDED**
- Both targets compile: ✓ (Pulpe + PulpeWidget)

## File Structure

```
ios/
├── Pulpe/
│   ├── Pulpe.entitlements                    # NEW
│   ├── App/
│   │   └── PulpeApp.swift                    # MODIFIED (deep link)
│   ├── Domain/
│   │   └── Services/
│   │       └── WidgetDataSyncService.swift   # NEW
│   └── Features/
│       └── CurrentMonth/
│           └── CurrentMonthView.swift        # MODIFIED (sync widget)
├── PulpeWidget/
│   ├── PulpeWidget.entitlements              # NEW
│   ├── PulpeWidgetBundle.swift               # NEW
│   ├── Models/
│   │   └── BudgetWidgetData.swift            # NEW
│   ├── Services/
│   │   └── WidgetDataCoordinator.swift       # NEW
│   ├── Intents/
│   │   └── AddExpenseIntent.swift            # NEW
│   └── Widgets/
│       ├── CurrentMonth/
│       │   ├── CurrentMonthWidget.swift      # NEW
│       │   ├── CurrentMonthEntry.swift       # NEW
│       │   ├── CurrentMonthProvider.swift    # NEW
│       │   └── CurrentMonthWidgetView.swift  # NEW
│       └── YearOverview/
│           ├── YearOverviewWidget.swift      # NEW
│           ├── YearOverviewEntry.swift       # NEW
│           ├── YearOverviewProvider.swift    # NEW
│           └── YearOverviewWidgetView.swift  # NEW
└── project.yml                               # MODIFIED
```

## Follow-up Tasks

1. **Manual testing on device**: Add widgets to Home Screen, verify data display and refresh
2. **Test deep linking**: Tap widget and `+` button, verify app opens to add expense flow
3. **App Store Connect**: Enable App Groups capability in provisioning profile
4. **Consider**: Lock Screen widgets (accessory families) for future iteration
