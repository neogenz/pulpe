---
objective: "The home activity rows use native SwiftUI trailing swipe actions without changing the two-zone hero, vertical scrolling, Dynamic Type, or mandatory deletion confirmation."
status: in-progress
---

# Plan: Make the home activity swipe native without flattening the homepage

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Replace the home-only swipe renderer with native `List` row actions while preserving the shipped home composition and scroll behavior. |
| **Source** | Session brief validated on 2026-08-25 after reviewing commit `1edc9df02`. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Prove a native-list shell can preserve the two-zone home | [`phase-1.md`](./phase-1.md) |
| 2   | Replace the custom activity swipe with native row actions | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://developer.apple.com/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:) | The stable API adds actions to a list row, requires `Button` content, and disables full-swipe execution with `allowsFullSwipe: false`. |
| https://developer.apple.com/documentation/swiftui/list | One `List` can mix static views, sections, and dynamic `ForEach` rows, and remains the stable native scrolling container for swipeable rows. |
| https://developer.apple.com/videos/play/wwdc2021/10018/ | SwiftUI owns the swipe presentation, symbol treatment, action tint, and platform behavior when actions are declared as buttons. |
| https://developer.apple.com/documentation/swiftui/view/swipeactionscontainer() | Native swipe actions in `ScrollView` and custom containers are announced for the 2026 beta SDK, but the API is absent from the installed Xcode 26.6 toolchain and cannot ship in the current project. |

## Decisions

| Decision | Why |
| -------- | --- |
| Treat the previous “`List` is excluded” conclusion as a scope decision, not a platform impossibility. | The previous plan deliberately avoided a redesign during a gesture fix; it did not test a list-level two-zone composition. |
| Prove the `List` shell before deleting the custom swipe code. | Hero parallax and the rounded content boundary are the real risks; retaining the current swipe through phase 1 keeps the change reversible until those visuals pass on-device inspection. |
| Add list-compatible behavior to the existing `HeroZoneSurface` family and leave its current modifiers intact. | Seven other loaded/skeleton surfaces use the current modifiers; a parallel capability avoids a cross-app migration while keeping the home inside the shared hero grammar. |
| Use the stable list-row API now; do not add an unavailable beta path or dual implementation. | The app builds with Xcode 26.6 and targets iOS 18. A future container API is the eventual simpler route, not a production dependency today. |
| Disable full swipe and keep the existing system confirmation dialog. | The validated product rule requires explicit revelation of both actions and confirmation before every deletion. |
