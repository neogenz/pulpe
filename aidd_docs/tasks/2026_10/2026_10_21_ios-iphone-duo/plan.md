---
objective: "Pulpe preserves its native iOS identity, navigation and financial state across iPhone Duo displays, rotations and folds, with the verified build available in TestFlight."
status: in-progress
---

# Plan: Native iPhone Duo adaptation

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Make existing journeys resize naturally, then add useful budget context using native SwiftUI containers. |
| **Source** | User conversation dated 2026-10-21; Apple links below; rejected sidebar in “Screenshot 2026-10-21 at 15.06.08.png”. The HTML exploration is not a visual specification. On 2026-10-23 the user authorized full implementation and TestFlight from a dedicated branch/worktree based on fresh origin/main. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Establish the SDK and native baseline | [phase-1.md](./phase-1.md) |
| 2 | Adapt budget navigation without losing context | [phase-2.md](./phase-2.md) |
| 3 | Adapt home, forms and fold-sensitive content | [phase-3.md](./phase-3.md) |
| 4 | Verify continuity, capture and deliver TestFlight | [phase-4.md](./phase-4.md) |

## Resources

| Source | Verified on 2026-10-21 |
| --- | --- |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) | Native containers, consistent hierarchy, reserved regions; vertical bars except on the inner display in portrait. |
| [Technical preparation](https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo) | Semantic toolbar items; custom-view limitations; arrangement placement restrictions; reserved-region APIs. |
| [SDK and testing](https://developer.apple.com/iphone-duo/prepare/) | SDK 27.1 enables the full native layout; Xcode 27.1 Duo simulator is the reference for validation. |
| [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) | April 2027 requirement applies to builds using SDK 27.1 or later; outer 1398×2034 and inner 2007×2853, or transposed. |

## Decisions

| Decision | Why |
| --- | --- |
| Preserve four native tabs, typed navigation and Pulpe components; Liquid Glass belongs to system navigation. | Existing product and iOS design rules are the reference; no custom sidebar chrome, imitation glass or replacement tab bar. |
| Use available space and native containers, with budget list/detail as the first contextual enhancement. | Every pose retains the same functions; no separate “Duo mode”, device-size table, new comparison dashboard or forced three-column layout. |
| Keep selection and active editing state independent of layout; retain each entry point's back stack. | Resizing must not recreate drafts, switch tabs, lose changes or expose another session's state. |
| Keep iOS 18 and iPhone targeting; gate new APIs after checking SDK declarations. | Duo support does not justify adding iPad support, changing formulas or raising the deployment target. |
| Review actual native captures before extending the layout. | The sketches specify structure only and remain proposals; the rejected HTML cannot approve visual styling. |
