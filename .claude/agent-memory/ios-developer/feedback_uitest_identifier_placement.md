---
name: uitest-identifier-placement
description: Where to attach accessibilityIdentifier when converting PulpeUITests off French literals — container, Button, and tap-target traps
metadata:
  type: feedback
---

When replacing a display-literal query in `PulpeUITests/` with an identifier: reuse an
existing identifier first, otherwise add `.accessibilityIdentifier(...)` in the app source
at the queried element — additive only, never touching `accessibilityLabel` or visible text.

Three placement traps:

- A bare identifier on a SwiftUI **layout container** (`VStack`/`HStack`/`Group`) is applied
  to every descendant element and overwrites identifiers they set themselves. Put
  `.accessibilityElement(children: .contain)` immediately before it. Real elements
  (`ScrollView`, `List`, `Button`) own the identifier themselves — `savingsGoalDetailRoot`
  on a `ScrollView` coexists with `savingsGoalProgressCard` inside it.
- A `Button` inherits the identifier of a `Text` in its label. Give the `Button` its own.
- To **tap**, target the `Button` element. Tapping the `Other` element of a `.contain`
  container synthesizes nothing the SwiftUI button receives (`press(forDuration:)` on a
  container is fine).

**Why:** the EN/DE/IT localization makes every French display literal a time bomb, and each
of these traps has already produced a silently-passing or unfindable element in this suite.

**How to apply:** any time a UI test queries by visible copy. Query with
`app.descendants(matching: .any)["id"]` (the convention in `BudgetLineLongPressTests`) —
it resolves whether the identifier landed on the container or on its leaves. Assertions on
harness fixture data (seeded names, ids) may stay literal; they are not product copy.
Related: [[uitest-harness-locale-split]].
