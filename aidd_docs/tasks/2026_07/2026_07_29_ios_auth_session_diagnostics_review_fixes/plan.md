---
objective: "Toute expiration iOS atteint un reset terminal attribuable avant la rotation PostHog, avec un contrat analytics exact et aucun nouveau défaut de qualité."
status: implemented
---

# Plan: Fermer les écarts de revue des diagnostics de session iOS

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer les quatre warnings et le mineur de la revue sans élargir le lot aux violations SwiftLint préexistantes. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_28_ios_auth_session_diagnostics/review.md` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Fermer le chemin terminal et capturer avant reset | [`phase-1.md`](./phase-1.md) |
| 2 | Rendre le contrat exhaustif et le garde qualité honnête | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/PostHog/posthog-ios/blob/131859db52a6d65bc77a6f8846239a22bad8dd14/PostHog/PostHogSDK.swift#L621-L633 | La version PostHog résolue réinitialise l’identité et la session lors de `reset()`. |
| https://github.com/PostHog/posthog-ios/blob/131859db52a6d65bc77a6f8846239a22bad8dd14/PostHog/PostHogStorage.swift#L394-L411 | `reset()` supprime les propriétés enregistrées, donc elles doivent être réarmées pour les événements suivants. |
