---
objective: "Every screen touched by the iOS design refonte reads as one calm, clear product: the hero zone survives pull-to-refresh, the home page has a full-bleed chart and a content card that rises over the forest, toolbar and pager chrome are legible, pointing is discoverable again, and all six entry forms share the home sheet's three-block model."
status: in-progress
---

# Plan: iOS design fix pass after the refonte

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Fix the UX/UI regressions and under-delivery reported on `feat/ios-design-refonte` (simulator review of 2026-08-22) and push the home page to the visual quality of the inspiration set. |
| **Source** | User text + 23 screenshots (2026-08-22 review) + `~/Downloads/inspi-pulpe-v2/*.png` + `~/Downloads/pulpe-inspiration/*`. Inspiration reading: one deep surface at the top with a full-bleed line chart, a neutral card rising over it, one accent, tiles not chips, weight from size not boldness, rows without decoration, flat pill CTAs, numeric-pad-first amount entry. |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | Hero zone lives in the scroll: overlapping content card, parallax, refresh-proof | [`phase-1.md`](./phase-1.md) |
| 2   | Home hero: edge-to-edge chart, one hierarchy | [`phase-2.md`](./phase-2.md) |
| 3   | Hero chrome: legible toolbar buttons, month pager that never hides content | [`phase-3.md`](./phase-3.md) |
| 4   | Pointing is visible again on the budget detail ledger | [`phase-4.md`](./phase-4.md) |
| 5   | One entry-form model for the six add/edit forms | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified          |
| ------ | ----------------- |
| `~/workspace/perso/oa-design/DESIGN-SKILL.md` (oa-design skill) | Rules reused: one accent spent in one place; hierarchy from size/color/spacing, not weight; chrome never waits, skeleton pixel-matched; exits faster than entrances; nothing in chrome tweens longer than 0.2s; cards never lift on press. |
| Apple docs `visualEffect(_:)` / `onScrollGeometryChange` | iOS 17 / iOS 18 APIs; deployment target is iOS 18.0 (`ios/project.yml`), so scroll-driven parallax needs no custom preference key. |
| Apple docs `interpolationMethod(.monotone)` (Swift Charts) | Monotone cubic keeps a step-shaped balance series from overshooting while smoothing the line; stable, first-party. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| The forest surface becomes part of the scroll content (hero background extended above the viewport), replacing the viewport-fixed `HeroZoneSurface` + `HeroZoneTracker` geometry loop. | Root cause of the pull-to-refresh bug: the fixed surface follows a reported `maxY` that lags during the refresh inset animation. A scroll-native background cannot lag, and it is what makes the content card "rise over" the forest for free. |
| The content zone is a `appBackground` card with `CornerRadius.zone` top corners over the forest (inverse of today's forest-with-rounded-bottom). | Matches the inspiration and the user's ask; the boundary shadow token and the Two-Zone Rule keep their meaning, only the owner of the curve changes. Documented in `ios/DESIGN.md`. |
| Pointing affordance: unpointed disc draws a ring in the nature tint; leading swipe "Pointer" as a second path. No new control at the trailing edge. | The nature disc stays the single leading element (One Ledger Rule) and the ring gives it a "to tick" reading; the trailing slot stays amount + chevron. |
| Form model = home sheet: hero amount + quick chips, then `FormCard` "what" (description, tag), then `FormCard` "details" (date, checked, goal/origin). Segmented choices stay above the amount. | One model for six forms; the home sheet is the one the user rated best. |
