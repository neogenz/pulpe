# TODO — Branche `feat/encrypt-user-amounts-aes256`

> Scope : [#274 — Chiffrer les montants utilisateurs (AES-256-GCM)](https://github.com/neogenz/pulpe/issues/274)

## Ce qui est fait

- [x] Architecture split-key (PBKDF2 frontend + HKDF backend + AES-256-GCM)
- [x] Dérivation clientKey au login et signup
- [x] Interceptor `X-Client-Key` sur chaque requête
- [x] `EncryptionService` : chiffrement, déchiffrement, DEK cache 5 min
- [x] Table `user_encryption_key` (salt, kdf_iterations, wrapped_dek)
- [x] Colonnes `*_encrypted` sur les 5 tables
- [x] Dual-write : plaintext = 0, encrypted = valeur réelle
- [x] Changement de mot de passe → rekey atomique
- [x] Backfill lazy (chiffre au premier login post-migration)
- [x] Mode démo : `DEMO_CLIENT_KEY` déterministe, même code path
- [x] Recovery key backend : generate, wrap/unwrap DEK, endpoints
- [x] Recovery key frontend : modal dans Paramètres > Sécurité
- [x] Migration SQL : `wrapped_dek` column
- [x] Tests : 70 backend, 1020 frontend, `pnpm quality` OK
- [x] Documentation `ENCRYPTION.md` à jour
- [x] Prompt recovery key au signup — #295
- [x] Nudge recovery key après changement de mdp — #297

## Ce qui reste sur cette branche

### 0. Validation du code coffre-fort — #305

Un code coffre-fort incorrect ne doit pas donner accès à l'app. Key check canary (pattern Bitwarden).

**Fichiers modifiés :**
- Backend : `encryption.controller.ts`, `encryption.service.ts`, `encryption-key.repository.ts`, `error-definitions.ts`
- Frontend : `encryption-api.ts`, `enter-vault-code.ts`
- Migration : `20260202100000_add_key_check_column.sql`

- [x] Page "mot de passe oublié" — #296

### ~~2. Nudge recovery key après changement de mdp — #297~~ ✅

~~Après un changement de mot de passe, `wrapped_dek` est nullifié. L'utilisateur doit être invité à re-générer une recovery key.~~

**Implémenté :** `change-password-card.ts` dans `feature/settings/`. Après changement de mdp + rekey, la dialog recovery key s'ouvre automatiquement.

### 3. Déployer et vérifier la migration prod

- Déployer la branche en prod
- Les 3 utilisateurs existants seront migrés au premier login (backfill interceptor)
- Vérifier en DB :

```sql
SELECT 'budget_line' as t, count(*) FROM budget_line WHERE amount_encrypted IS NULL
UNION ALL
SELECT 'transaction', count(*) FROM transaction WHERE amount_encrypted IS NULL
UNION ALL
SELECT 'template_line', count(*) FROM template_line WHERE amount_encrypted IS NULL
UNION ALL
SELECT 'savings_goal', count(*) FROM savings_goal WHERE target_amount_encrypted IS NULL
UNION ALL
SELECT 'monthly_budget', count(*) FROM monthly_budget WHERE ending_balance_encrypted IS NULL;
-- Attendu : 0 partout
```

### 4. Cleanup backfill — #293

Une fois les 3 users migrés et vérifiés, supprimer le code temporaire :
- `encryption-backfill.service.ts`
- `encryption-backfill.interceptor.ts`
- `encryption-backfill.service.spec.ts`
- Références dans `encryption.module.ts` et `app.module.ts`

### 5. Drop colonnes plaintext (dernière étape)

Migration SQL pour supprimer les colonnes `amount`, `target_amount`, `ending_balance` des 5 tables. **Uniquement** après :
- Tous les users migrés
- Recovery key fonctionnelle pour tous
- Code backfill nettoyé
- Période d'observation en prod

## Ordre recommandé

| # | Tâche | Ticket | Bloqué par |
|---|-------|--------|------------|
| ~~1~~ | ~~Prompt recovery key au signup~~ | ~~#295~~ | ~~—~~ ✅ |
| ~~2~~ | ~~Nudge recovery key post-password-change~~ | ~~#297~~ | ~~—~~ ✅ |
| 2b | Validation du code coffre-fort | #305 | — |
| ~~3~~ | ~~Page mot de passe oublié~~ | ~~#296~~ | ~~#295~~ | ✅ |
| 4 | Déploiement + migration prod | — | #305 | |
| 5 | Vérification prod | — | Déploiement | |
| 6 | Cleanup backfill | #293 | Vérification | |
| 7 | Drop colonnes plaintext | — | #293 | |

## Chaîne de dépendances GitHub

```
#274 (epic)
├── #294 (recovery key) ← DONE
├── #295 (prompt signup) ← DONE
├── #296 (forgot-password) ← DONE
├── #297 (nudge post-password-change) ← DONE
├── #305 (validation code coffre-fort) ← EN COURS
└── #293 (cleanup backfill) ← bloqué par déploiement + vérification
```
