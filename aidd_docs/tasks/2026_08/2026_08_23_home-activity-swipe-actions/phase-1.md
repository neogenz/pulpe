---
status: done
---

# Instruction: Ledger scroll: swipe gesture no longer claims vertical pans

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/Pulpe/Shared/Components/
└── ✏️ LeadingSwipeAction.swift   (highPriorityGesture → simultaneousGesture)
```

## User Journey

```mermaid
flowchart TD
  A[Finger lands on a ledger row] --> B{Pan direction}
  B -- vertical --> C[ScrollView scrolls, row stays put]
  B -- rightward --> D[Row reveals the leading action band]
  D --> E{Past commit distance on release?}
  E -- yes --> F[Action runs, row snaps back]
  E -- no --> G[Row snaps back]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Build Local, install on the interactive simulator from an explicit derivedDataPath, open a budget with ~10 rows => ledger on screen: 5: cli
  section Happy path
    Drag straight down 100pt starting on a transaction row => the page scrolls on that same drag: 5: cli
    Drag right 90pt on a row and release => the leading action commits, row snaps back: 5: cli
  section Edge case - diagonal
    Drag down-right at ~45° => the page scrolls and no action commits: 1: cli
```

## Tasks to do

### `1)` Gesture

> Let the scroll view keep vertical pans.

1. In `LeadingSwipeAction.body`, replace `.highPriorityGesture(drag, including:)` with `.simultaneousGesture(drag, including:)`.
2. Keep the `dx > abs(dy)` guard: it is what keeps a diagonal from revealing the band.
3. Update the doc comment: the row no longer pre-empts the scroll view; both see the pan, the guard picks the horizontal one.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 1    | A vertical drag started on a ledger row scrolls the page on that same drag, every time.                     |
| 1    | A rightward drag past 72pt still commits the leading action with its haptic; a short one snaps back.       |
| 1    | `xcodebuild build` Local succeeds; `swiftlint --strict` clean on the file.                                  |
