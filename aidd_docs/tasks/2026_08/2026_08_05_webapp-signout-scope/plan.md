---
objective: "Une déconnexion depuis la webapp ne révoque plus la session iOS, et la prochaine déconnexion subie devient attribuable à une cause précise."
status: pending
---

# Plan: Portée du signOut webapp

## Overview

| Field      | Value                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| **Goal**   | Aligner la webapp sur le scoping par intention déjà appliqué côté iOS, et combler le trou d'observabilité |
| **Source** | Diagnostic conversationnel du 2026-08-05 — iOS 1.3.1 (3), événements `auth_session_observed` en PostHog   |

## Phases

| #   | Phase                          | File                         |
| --- | ------------------------------ | ---------------------------- |
| 1   | Portée locale du signOut       | [`phase-1.md`](./phase-1.md) |
| 2   | Événement de logout webapp     | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                                | Verified                                                                                                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@supabase/auth-js@2.71.1` — `dist/main/GoTrueClient.js:1384-1408`     | `_signOut({ scope } = { scope: 'global' })` : le défaut est bien `global`. En `local`, seul l'argument passé à `admin.signOut` change ; `_removeSession()` tourne quand même. |
| PostHog projet 87621, événements `auth_session_observed` sur 14 jours  | 18 déconnexions subies sur le build 3, toutes précédées d'un `refresh_token_not_found` (400) au refresh horaire.                                                              |
| PostHog projet 87621, événements `$lib = 'web'` du 2026-08-05          | **Lien causal confirmé.** Déconnexion web à 08:21:44 (chute d'identité + `welcome_page_viewed` anonymes), session iOS morte à 08:53:50, soit +32 min — le délai du refresh horaire. |
| PostHog projet 87621, 23 noms d'événements web distincts sur 7 jours   | Aucun événement de logout côté web n'existe : ni en télémétrie, ni dans `shared/src/`, ni dans `auth-session.service.ts` qui n'importe aucun module analytics.                |
| Supabase `pulpe` (qhhlloqisgzwcsrbdppn), logs auth                     | Le `/token` refusé à 06:53:50Z porte `referer: https://app.pulpe.app` — la session web meurt à la même seconde que la session iOS.                                            |

## Decisions

| Decision                                                                        | Why                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La webapp passe en `scope: 'local'` sur **tous** ses sites, sans exception       | Les deux seuls cas qui justifieraient `global` — suppression de compte programmée et compte bloqué — sont déjà révoqués côté serveur par `signOutGlobally` dans `schedule-account-deletion.use-case.ts`. Le global client y est redondant. |
| Le correctif est livré avec son instrumentation, pas seul                        | Le lien causal est confirmé, donc la phase 2 ne sert plus à diagnostiquer mais à détecter une récidive : sans événement de logout web, il a fallu reconstituer la déconnexion à partir d'une chute d'identité `$set` et de `welcome_page_viewed` anonymes. |
| Aucune modification iOS                                                          | iOS scope déjà par intention : `.local` par défaut, `.global` explicite et documenté sur le reset de mot de passe et la suppression de compte. C'est le comportement cible.                                                     |
