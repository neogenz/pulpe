---
objective: "Every finding in the native home swipe review is resolved while SwiftUI owns the revealed action chrome and the homepage keeps its shipped layout and motion."
status: implemented
---

# Plan: Close the native home swipe review

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Align the shipped home-list contract, restore the intentional entrance, and verify fully native swipe actions in light, dark, and accessibility layouts. |
| **Source** | `aidd_docs/tasks/2026_08/2026_08_25_ios-native-home-swipe/review.md` (`changes-requested`, 2026-08-26). |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Align the homepage contract with the shipped implementation | [`phase-1.md`](./phase-1.md) |
| 2   | Return swipe presentation to SwiftUI and close the visual matrix | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://developer.apple.com/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:) | Stable trailing actions belong to direct `List` rows, use `Button` content, and can disable full-swipe execution. |
| https://developer.apple.com/documentation/swiftui/view/listrowbackground(_:) | The row background is the native seam for preserving the activity card surface behind a swiped list row. |
| https://developer.apple.com/documentation/swiftui/view/alert(_:ispresented:presenting:actions:message:) | The existing destructive confirmation uses the current native alert API and needs no replacement. |

## Decisions

| Decision | Why |
| -------- | --- |
| Make the rounded card surface the list row background and delete the mirrored action renderer. | It fixes the transparent revealed surface at its list-row seam while allowing SwiftUI to own action size, spacing, pressed state, locale, and future iOS changes. |
| Keep UI automation in XCTest and add a compact appearance matrix. | `XCUIApplication` remains XCTest-only; one matrix test gives light, dark, and accessibility evidence without duplicating the functional edit/delete flows. |
| Remove the unrelated string-catalog placeholder edit from this PR. | It does not support swipe behavior and keeping it would leave the review's relevancy finding unresolved. |
