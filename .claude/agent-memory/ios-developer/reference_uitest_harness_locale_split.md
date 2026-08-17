---
name: uitest-harness-locale-split
description: UI-test harnesses render app copy in AppLocale but system controls in the simulator's language — two independent languages on one screen
metadata:
  type: reference
---

In `PulpeUITests`, app copy and system-control copy follow **different** languages.

`PulpeApp` applies `.environment(\.locale, AppLocale.uiLocale(for:))`, but the UI-test
harnesses (`SavingsGoalIntervalUITestHarness`, `BudgetLongPressUITestHarness`, …) host their
scenario views directly and never set `\.locale`. So inside a harness:

- App copy resolves through `AppLocale.string(...)` → the value persisted in the app-group
  `UserDefaults` (`pulpe-app-locale`), French on a fresh simulator, and **sticky across
  launches** once anything writes it.
- System controls (`DatePicker` calendar cells, keyboard, share sheet) resolve through the
  process locale → the simulator's Language & Region setting.

Consequence: a day-cell query such as `label CONTAINS "15 juillet"` in
`SavingsGoalIntervalUITests.openDeadlineReconciliation` cannot be converted to an identifier
(no app-owned element) and breaks when the _simulator_ language changes, independently of
the app's language. Verify assumptions about which language a given element speaks before
blaming the app. See [[uitest-identifier-placement]].
