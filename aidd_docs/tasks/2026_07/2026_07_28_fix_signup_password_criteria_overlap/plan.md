---
objective: "The signup form preserves its layout, product tours stay anchored and accurate, and onboarding creates a complete twelve-month future projection."
status: in-progress
---

# Plan: Fix webapp first-run regressions

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Fix three independent webapp regressions, including a complete product-tour consistency pass, without hiding valid validation or projection feedback. |
| **Source** | User reports and screenshots from 2026-07-28 showing the signup overlap, the wrong tour on budget templates, and one missing future budget immediately after onboarding. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Restore the checklist host layout contract | [`phase-1.md`](./phase-1.md) |
| 2   | Repair and refresh every product tour | [`phase-2.md`](./phase-2.md) |
| 3   | Generate a complete onboarding horizon | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://angular.dev/guide/components/host-elements | An Angular component renders inside its selector's host element, and the component metadata can bind classes or styles to that host. |
| https://tailwindcss.com/docs/display | Tailwind's `block` utility gives the host a block-level box that fills the available inline space. |
| https://tailwindcss.com/docs/margin#adding-space-between-children | `space-y-*` is implemented with child margins; its documented limitations support fixing the child host contract instead of compensating on the following field. |
| https://driverjs.com/docs/configuration | A tour step whose selector is missing falls back to a centered popover, matching the reported screenshots. |
