---
objective: "Les chemins de corruption silencieuse du chiffrement sont fermés (DEK validé avant cache, recalcul fail-closed), les fuites d'info backend sont colmatées, la chaîne CI/CD est durcie (Node LTS, secrets sous Environment, actions SHA-pinnées), et les actions manuelles dashboards sont exécutées par l'utilisateur."
status: blocked
---

# Plan: Remédiation audit sécurité 2026-07-23 (code + infra)

## Overview

| Field      | Value                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Corriger les findings RÉELS de l'audit (2 P0 intégrité données, 3 P1 durcissement, infra CI/CD) avec test de reproduction d'abord ; écarter les faux positifs documentés ; isoler les actions que seul l'utilisateur peut faire. |
| **Source** | Audit sécurité en session du 2026-07-23 + plan du worktree `encryption-failure-handling-audit-f49a46` (re-vérifié contre le code et la doc Postgres ; il corrige 2 erreurs de l'audit initial, reprises ici)                        |

## Phases

| #   | Phase                                                                   | File                         |
| --- | ----------------------------------------------------------------------- | ---------------------------- |
| 1   | Validation du DEK avant mise en cache (P0)                              | [`phase-1.md`](./phase-1.md) |
| 2   | Recalcul de balance fail-closed (P0)                                    | [`phase-2.md`](./phase-2.md) |
| 3   | Ne plus fuiter les messages internes des 500 (P1)                       | [`phase-3.md`](./phase-3.md) |
| 4   | Durcissement config (throttle, NODE_ENV, IP blacklist) (P1)             | [`phase-4.md`](./phase-4.md) |
| 5   | Cohérence DB transaction↔budget_line + nettoyage fonction morte (P2)    | [`phase-5.md`](./phase-5.md) |
| 6   | Infra & CI/CD (Node 24, gates Environment, SHA-pin, Bun pinné) (P1)     | [`phase-6.md`](./phase-6.md) |
| 7   | Actions manuelles dashboards (utilisateur — bloque 2 findings)          | [`phase-7.md`](./phase-7.md) |

## Resources

| Source                                                                                                       | Verified                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)             | « The policy above implicitly provides a `WITH CHECK` clause identical to its `USING` clause … rows belonging to a different manager cannot be created via `INSERT` or `UPDATE` » → **le finding « WITH CHECK manquant » est un FAUX POSITIF** ; la relocation cross-tenant est déjà bloquée. |
| Migrations `20250812050259`, `20250812064249` (grep `CREATE TRIGGER`)                                        | `auto_confirm_user()` existe mais **aucun CREATE TRIGGER ne l'attache** dans le repo → fonction morte ; l'auto-confirm live vient du setting Auth `mailer_autoconfirm`, pas de ce code.                     |
| Plan worktree `…/2026_07_23_encryption-failure-handling-audit/plan.md` (audit Railway live via MCP)          | Prod = `NODE_ENV=production` (var Railway + `Dockerfile:48`) → le défaut `development` ne mord pas le déploiement actuel ; durcissement = défense en profondeur.                                             |
| https://qhhlloqisgzwcsrbdppn.supabase.co/auth/v1/settings (live)                                             | `mailer_autoconfirm: true`, `disable_signup: false` en prod ET preview → email jamais vérifié à l'inscription (décision utilisateur requise, phase 7).                                                       |
| https://nodejs.org/en/about/previous-releases                                                                | Node v20 (Iron) = EOL (mars 2026) ; v24 = LTS → base Docker à bumper (phase 6).                                                                                                                           |
| https://api.pulpe.app + preview Railway + https://app.pulpe.app (live)                                       | Swagger/debug 404 partout, CSP stricte, erreurs assainies, `config.json` = clés publiques uniquement — rien à changer.                                                                                     |
| `git show :frontend/.env.e2e`                                                                                | La valeur Turnstile trackée = la **site key publique** (identique à celle de `config.json` prod) → rien à rotater.                                                                                          |

## Decisions

| Decision                                                                                                                        | Why                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Invariant « seul un DEK validé entre dans le cache » — appliqué aux **trois** points d'écriture du cache, dont `getUserDEK`     | Le plan worktree corrigeait `verifyAndEnsureKeyCheck` mais laissait `getUserDEK` cacher un DEK non validé sur miss (une lecture avec clé périmée empoisonne le cache pour une écriture concurrente). Sur échec du canary : ne PAS cacher, retourner le DEK dérivé non caché — l'UX de lecture (fallback 0) est inchangée. |
| Recalcul fail-closed côté **persistance** uniquement ; le comportement de lecture (0 silencieux) est différé                     | Abandonner l'écriture d'un total faux est correct sans ambiguïté ; 500 vs 0 côté GET est un choix UX/produit à trancher séparément.                                                                                                                                                   |
| **Ne PAS modifier les 4 policies UPDATE RLS** (finding de l'audit initial réfuté)                                                | Postgres réutilise l'expression `USING` comme `WITH CHECK` quand celui-ci est absent (doc officielle + exemple identique au scénario d'attaque). Ajouter un `WITH CHECK` explicite serait purement cosmétique. Confirmé aussi par l'audit du 2026-07-20 cité dans le worktree.            |
| `NODE_ENV` fail-loud au boot (défaut supprimé), les scripts dev/test le fixent déjà explicitement                                | Un déploiement futur mal configuré doit échouer bruyamment plutôt que dégrader silencieusement debug endpoints, Swagger, CORS, throttles, Turnstile. Vérifié : `start`, `dev`, `dev:local`, `dev:watch`, `start:prod` fixent NODE_ENV ; `bun test` le fixe à `test`.                       |
| `validate-key` → 5/min (aligne code et `docs/ENCRYPTION.md:188`) ; `verify-recovery-key` reste à 30/min                          | 10⁴ PIN à 30/min ≈ 5,5 h avec session volée ; les recovery keys sont haute-entropie, non brute-forçables. Le lockout progressif est une feature séparée, hors scope.                                                                                                                    |
| Secrets prod → GitHub Environment « production » (phase 7 manuelle) + `environment:` référencé dans les jobs migration (phase 6) | Sur `pull_request`, le YAML vient du head de la PR : une branche interne ou un compte compromis pourrait exfiltrer `PRODUCTION_DB_PASSWORD`/`SUPABASE_ACCESS_TOKEN`. L'Environment ajoute la gate d'approbation.                                                                          |
| `auto_confirm_user()` = code mort → `DROP FUNCTION IF EXISTS` **sans CASCADE** en migration                                      | Aucun trigger ne l'attache dans le repo. Sans CASCADE, si un trigger manuel existait en prod, la migration échoue bruyamment → signal d'investigation au lieu de casser les inserts silencieusement.                                                                                     |
