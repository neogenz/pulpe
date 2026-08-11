---
objective: "Les 1 faille HAUTE et 8 failles MOYENNES de l'audit sécurité 2026-08-04 sont corrigées ou documentées comme risque accepté, sans régression fonctionnelle."
status: pending
---

# Plan: Corrections audit sécurité (HAUTE + MOYENNES)

## Overview

| Field      | Value                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| **Goal**   | Corriger les 9 constats HAUTE/MOYENNE de l'audit sécurité du 2026-08-04                   |
| **Source** | Rapport d'audit produit en session (4 axes : backend/auth, chiffrement, frontend/iOS, infra/secrets/RLS) |

Correspondance constats → phases : HAUTE-1 (dump prod) → P1 · M4 (GRANT key_check) → P2 · M7 (AAD) → P3 · M2 (Turnstile fail-open, compensations) → P4 · M5 (PostHog replay) + M6 (xlsx CVE) + M3 (clé vault localStorage) → P5 · M8 (config auth Supabase) → P6.

Décisions de portée validées avec l'utilisateur : dump supprimé · remember-device conservé + documenté · AAD corrigé maintenant · config.toml local seul (prod vérifiée manuellement) · xlsx migré vers la distribution officielle SheetJS.

## Phases

| #   | Phase                                        | File                         |
| --- | -------------------------------------------- | ---------------------------- |
| 1   | Purge du dump production local               | [`phase-1.md`](./phase-1.md) |
| 2   | Verrouillage PostgREST `user_encryption_key` | [`phase-2.md`](./phase-2.md) |
| 3   | Format ciphertext v2 avec AAD                | [`phase-3.md`](./phase-3.md) |
| 4   | Durcissement throttler et flux démo          | [`phase-4.md`](./phase-4.md) |
| 5   | Confidentialité frontend (PostHog, xlsx, doc)| [`phase-5.md`](./phase-5.md) |
| 6   | Durcissement `config.toml` auth Supabase     | [`phase-6.md`](./phase-6.md) |

## Resources

| Source                                                                                          | Verified                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| https://github.com/posthog/posthog-js/blob/main/packages/types/src/posthog-config.ts            | `session_recording` expose `maskTextSelector`/`maskTextClass` mais pas `maskAllText` (via ctx7)   |
| https://docs.sheetjs.com/docs/getting-started/installation/npm                                  | Distribution officielle SheetJS hors npm (registry CDN) contenant les correctifs des CVE          |

## Decisions

| Decision                                                                                          | Why                                                                                                                                          |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AAD = `{userId}:{champ sémantique}` (ex. `user-uuid:amount`), jamais la table ni l'id de ligne     | Les ciphertexts `amount` se propagent légitimement `template_line → budget_line` au niveau SQL ; lier à la table ou à la ligne casserait ce flux |
| Format v2 préfixé `v2:`, déchiffrement rétrocompatible v1, pas de migration batch                   | Aucune interruption ni ré-écriture massive ; les lignes v1 restent lisibles et passent en v2 à la prochaine écriture                           |
| `rekey_user_encrypted_data` passe SECURITY DEFINER avant de révoquer les GRANT                     | Le RPC est aujourd'hui SECURITY INVOKER appelé avec le JWT utilisateur : révoquer sans convertir casserait change-pin et recover               |
| Fail-open Turnstile conservé (décision figée dans `turnstile.service.ts:57-66`)                    | Le commentaire interdit le fail-closed (Safari/iOS) ; on durcit uniquement les contrôles compensatoires                                       |
