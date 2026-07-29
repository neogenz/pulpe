---
objective: "Au cold start iOS, PostHog est initialisé avant qu’AuthService puisse démarrer son listener et photographier un diagnostic de session."
status: in-progress
---

# Plan: Garantir l’attribution des diagnostics au démarrage iOS

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer le dernier warning de revue en supprimant la course entre l’initialisation Analytics et le listener Supabase. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_28_ios_auth_session_diagnostics/review.md` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Initialiser Analytics avant le listener Auth | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/PostHog/posthog-ios/blob/131859db52a6d65bc77a6f8846239a22bad8dd14/PostHog/PostHogSDK.swift#L301-L307 | La version PostHog 3.68.2 résolue retourne un distinct ID vide tant que `setup(_:)` n’a pas terminé. |
