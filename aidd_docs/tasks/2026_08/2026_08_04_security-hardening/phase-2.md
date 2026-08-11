---
status: pending
---

# Instruction: Verrouillage PostgREST `user_encryption_key`

## Architecture projection

```txt
backend-nest/supabase/migrations/
└── 20260804130000_lock_down_user_encryption_key.sql  ✅ revoke GRANT authenticated + RPC rekey en SECURITY DEFINER
docs/
└── ENCRYPTION.md                                     ✏️ aligner la section accès table avec la réalité
```

## User Journey

```mermaid
flowchart TD
  A[Attaquant avec JWT utilisateur volé] -->|UPDATE key_check via PostgREST| B[Permission denied - GRANT révoqué]
  C[Utilisateur légitime] -->|POST /encryption/change-pin| D[RPC rekey SECURITY DEFINER]
  D -->|auth.uid() interne + propriétaire table| E[Rekey OK sans GRANT authenticated]
```

## Contexte technique (lu avant de coder)

- `20260212100000_rekey_rpc_atomic_key_check.sql:7-8` pose `GRANT SELECT (user_id)` et `GRANT UPDATE (key_check, updated_at)` à `authenticated`.
- Le RPC `rekey_user_encrypted_data` (dernière version : `20260717120000_add_savings_goal_initial_amount.sql`, complétant `20260310120000`) est **SECURITY INVOKER** et appelé avec le client JWT (`aes-gcm.crypto-service.ts:1013`, type `AuthenticatedSupabaseClient`) — d'où le GRANT.
- Politiques RLS `user_id = auth.uid()` SELECT/UPDATE ajoutées par `20260214140000_fix_security_performance_advisors.sql:32-54` — deviennent mortes après révocation du GRANT.
- `20260129200000_create_user_encryption_key.sql:29-33` pose déjà `REVOKE ALL FROM authenticated/anon` + `GRANT ALL TO service_role` (modèle cible).
- Convention migrations : nommage `YYYYMMDDHHMMSS_snake_case.sql`, idempotentes, `SET search_path TO ''` dans les fonctions DEFINER (pattern `20260310120000`).

## Tasks to do

### `1)` Écrire la migration de verrouillage

> Un JWT utilisateur ne doit plus pouvoir modifier `key_check` via PostgREST, sans casser change-pin/recover.

1. Créer `20260804130000_lock_down_user_encryption_key.sql`.
2. Recréer `rekey_user_encrypted_data` (signature exacte de la version `20260717120000`) en `SECURITY DEFINER` avec `SET search_path TO ''`, en conservant les gardes `auth.uid()` existantes (`v_uid := auth.uid()`, exception si null, toutes les écritures bornées `user_id = v_uid`) et le verrou `FOR UPDATE`.
3. `REVOKE SELECT, UPDATE ON public.user_encryption_key FROM authenticated;`
4. Supprimer les politiques RLS devenues mortes pour `authenticated` sur `user_encryption_key` (celles de `20260214140000`), en gardant RLS activé.
5. Vérifier qu'aucune autre fonction SECURITY INVOKER ne touche `user_encryption_key` (`rg -l "user_encryption_key" backend-nest/supabase/migrations`).
6. `bun run generate-types:local` dans `backend-nest` après application locale.

### `2)` Aligner la documentation

> `docs/ENCRYPTION.md` affirme « service_role uniquement » : le rendre vrai.

1. Mettre à jour la section décrivant l'accès à `user_encryption_key` (lignes ~219, ~234-237) : accès `service_role` + RPC SECURITY DEFINER pour le rekey, `authenticated` sans aucun privilège direct.

### `3)` Prouver la non-régression du rekey

> Les flux change-pin et recover passent encore avec le JWT utilisateur.

1. Lire `backend-nest/src/modules/encryption/encryption.e2e.spec.ts` et faire passer les scénarios change-pin/recover contre Supabase local.
2. Ajouter un cas de test migration (ou SQL manuel documenté) : un `UPDATE key_check` direct via PostgREST avec un JWT `authenticated` → `permission denied`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 1    | `UPDATE user_encryption_key SET key_check=...` via PostgREST avec un JWT utilisateur → `42501 permission denied` ; la table reste accessible au `service_role` |
| 1    | `POST /api/v1/encryption/change-pin` et `/recover` retournent 200 et les données restent déchiffrables après rekey |
| 2    | `ENCRYPTION.md` décrit l'accès réel (aucune contradiction avec les GRANT effectifs)                            |
