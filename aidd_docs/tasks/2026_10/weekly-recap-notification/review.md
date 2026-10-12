# Review: weekly recap notification (iOS)

- **Verdict**: changes-requested
- **Diff**: `1c81ed15b...52afda431` (#780) + `8a23997e1...3ae7ef8fa` (#782)
- **Axes run**: code, functional (criteria from the #780 and #782 descriptions, no plan.md), relevancy
- **Date**: 2026_10_12
- **Findings**: 0 critical, 1 warning, 4 minor

## Phases

### Phase 1 — Monday recap (#780)

- [x] Local notification on Monday at 8:30, titled « Ta semaine en bref » — `ios/Pulpe/Domain/Services/NotificationScheduler.swift:123`, `:146`
- [x] Body leads with the week ahead so the collapsed banner carries the amount — `NotificationScheduler.swift:184`
- [x] Week allowance = remaining ÷ days left × 7, compared with the 4-week average of free spending — `ios/Pulpe/Domain/Services/WeeklyRecap.swift:38`, `:61`
- [x] Unchecked forecasts usually pointed this week (`checkingDays`) — `WeeklyRecap.swift:69`
- [x] Movements noted last week, or a nudge when none — `WeeklyRecap.swift:36`, `NotificationScheduler.swift:158`
- [x] Computed on device, deterministic, no AI — `WeeklyRecap.swift:26`
- [x] The next 3 Mondays are rescheduled on every widget sync with frozen figures — `ios/Pulpe/Domain/Services/WidgetDataSyncService.swift:76`, `NotificationScheduler.swift:102`
- [x] Previews shown on the lock screen (« Toujours ») => the summary carries no amount — `NotificationScheduler.swift:112`
- [x] « Récap du lundi » toggle in Préférences; the prime sheet enables both reminders — `ios/Pulpe/Features/Account/PreferencesView.swift:40`, `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:471`
- [x] Identity change cancels every pending notification — `ios/Pulpe/App/AppState+Auth.swift:61`, `ios/Pulpe/App/AppState+SessionReset.swift:270`

### Phase 2 — Measurement and tap (#782)

- [x] `reminder_toggled` carries `reminder` (`monthly` | `weekly_recap`) — `PreferencesView.swift:169`, `:180`, `CurrentMonthView.swift:473`
- [x] `reminder_opened` (`reminder`) on a tap that opens the app, delegate installed before launch finishes — `NotificationScheduler.swift:217`, `ios/Pulpe/App/PulpeApp.swift:33`
- [x] Tap opens the Accueil, consumed once `MainTabView` exists (past the PIN) — `ios/Pulpe/App/MainTabView.swift:50`
- [x] Main-actor delegate, so UIKit's completion runs on the main thread — `NotificationScheduler.swift:207`
- [x] No `willPresent`: a reminder firing in the foreground stays silent — `NotificationScheduler.swift:207`
- [x] Shared contract mirrored — `shared/src/feature-flags.ts:142`, `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift:78`

## Findings

| Sev | Kind    | Phase | Location                                                    | Issue                                                                                                                                                                                                                                                                                                                                                              | Fix                                                                                                                                                                      |
| --- | ------- | ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟡  | conform | 1     | `ios/Pulpe/App/AppState+SessionReset.swift:371`             | `resetSession` states that the app-group balance "must not survive any session end, expiry included". The recaps freeze the same figures (allowance, usual spending, forecast names) into notification requests, and they survive logout and expiry: only a user switch or account deletion cancels them. Next Monday a logged-out device still shows the amounts. | Clear the recaps, pending and already delivered, in `resetSession` next to `widgetSyncing.clearAndReload()`. The next sync reschedules them once someone signs in again. |
| 🟢  | code    | 1     | `ios/Pulpe/Domain/Services/WidgetDataSyncService.swift:147` | A disabled recap returns without cancelling. A schedule already in flight when the toggle goes off (actor reentrancy across `notificationSettings()`) can land after `cancelWeeklyRecaps()`, and nothing ever removes those 3 recaps afterwards.                                                                                                                   | Cancel the recaps in the disabled branch, so every later sync heals a stray schedule.                                                                                    |
| 🟢  | conform | 2     | `ios/Pulpe/Domain/Services/NotificationScheduler.swift:207` | `ReminderTapHandler` and `PendingReminderTap` are main-actor classes holding navigation state, filed in `Domain/Services/`. `ios-architecture.md`: services are actors with no UI logic; navigation state lives in `App/`.                                                                                                                                         | Move both types to `ios/Pulpe/App/ReminderTapHandler.swift`, next to their only consumer `MainTabView`.                                                                  |
| 🟢  | code    | 1     | `ios/Pulpe/Domain/Services/WeeklyRecap.swift:75`            | `guard let day = checkingDays[line.id]` shadows the `day(_:)` date closure declared at line 34: one name, an `Int` period day here and a `Date` builder above.                                                                                                                                                                                                     | Rename the closure after what it returns, e.g. `daysBefore`.                                                                                                             |
| 🟢  | rot     | 1     | `ios/Pulpe/Domain/Services/NotificationScheduler.swift:100` | The doc says the recap "falls silent" after 3 Mondays without a new snapshot, but `BackgroundTaskService.refreshWidgetData` also runs the sync, so background refresh keeps rescheduling it with fresh figures.                                                                                                                                                    | State that only a missing sync, the app unused and background refresh not running, ends the series.                                                                      |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (16/16)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Files checked | `NotificationScheduler.swift`, `WeeklyRecap.swift`, `WidgetDataSyncService.swift`, `ReminderPreferences.swift`, `PreferencesView.swift`, `CurrentMonthView.swift`, `NotificationPrimeSheet.swift`, `MainTabView.swift`, `PulpeApp.swift`, `AppState+Auth.swift`, `AppState+SessionReset.swift`, `AnalyticsEvent.swift`, `feature-flags.ts`, `Localizable.xcstrings`, `WeeklyRecapTests.swift`, `NotificationSchedulerTests.swift`, `ReminderPreferencesTests.swift`, `AnalyticsServiceTests.swift` |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Unplanned     | `PulpeApp.swift:91` `Tips.configure` collapsed to one line (formatting only)                                                                                                                                                                                                                                                                                                                                                                                                                       |
