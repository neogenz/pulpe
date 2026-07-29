---
objective: "Toute fin de session iOS en production laisse un diagnostic ordonné, rattaché au bon utilisateur, catégorisé précisément et compatible avec la version Supabase livrée."
status: implemented
---

# Plan: Fiabiliser les diagnostics de déconnexion iOS

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Fermer les cinq findings de la revue afin qu’une nouvelle déconnexion permette de distinguer une action attendue, une expiration confirmée et une perte locale anormale. |
| **Source** | Demande utilisateur et `aidd_docs/tasks/2026_07/2026_07_28_ios_auth_session_diagnostics/review.md` |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Rendre la capture déterministe et durable | [`phase-1.md`](./phase-1.md) |
| 2 | Classer chaque fin de session | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://github.com/PostHog/posthog-ios/blob/131859db52a6d65bc77a6f8846239a22bad8dd14/PostHog/PostHogSDK.swift | La version résolue expose une capture avec `distinctId` et `timestamp`; `reset()` remplace ensuite l’identité courante par une identité anonyme. |
| https://github.com/supabase/supabase-swift/blob/003e58d745f0151c6590bfcb756af8234fdc9ec8/Sources/Helpers/HTTP/LoggerInterceptor.swift | Supabase 2.54.0 produit le format verbose actuellement parsé pour les réponses HTTP. |
| https://github.com/yonaskolb/XcodeGen/blob/master/Docs/ProjectSpec.md#remote-package | XcodeGen accepte `exactVersion` pour verrouiller une dépendance Swift distante. |

## Decisions

| Decision | Why |
| --- | --- |
| Photographier le distinct ID PostHog et l’horodatage avant tout saut vers le MainActor, puis utiliser l’overload de capture explicite. | L’événement garde l’identité et l’instant de l’incident même si `reset()` s’exécute avant le task différé, sans flush réseau bloquant. |
| Réutiliser `AppState.SessionResetScope` comme source typée de la raison de fin de session. | Ce point central reçoit déjà toutes les transitions vers une session vide; l’étendre évite une deuxième taxonomie susceptible de diverger. |
| Verrouiller `supabase-swift` sur la version exacte 2.54.0. | Le parser dépend d’un format de log non public; autoriser une autre version 2.x rendrait la collecte silencieusement instable. |
