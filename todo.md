# TODO — Branche `feat/encrypt-user-amounts-aes256`

> Scope : [#274 — Chiffrer les montants utilisateurs (AES-256-GCM)](https://github.com/neogenz/pulpe/issues/274)

## Ce qui est fait

- [x] Architecture split-key (PBKDF2 frontend + HKDF backend + AES-256-GCM)
- [x] Dérivation clientKey via **vault code** (login, signup, recovery)
- [x] Interceptor `X-Client-Key` sur chaque requête
- [x] `EncryptionService` : chiffrement, déchiffrement, DEK cache 5 min
- [x] Table `user_encryption_key` (salt, kdf_iterations, wrapped_dek, key_check)
- [x] Colonnes `*_encrypted` sur les 5 tables
- [x] Dual-write : plaintext = 0, encrypted = valeur réelle
- [x] Changement de mot de passe → indépendant du chiffrement (vault code découplé)
- [x] Backfill lazy (chiffre au premier login post-migration)
- [x] Mode démo : `DEMO_CLIENT_KEY` déterministe, même code path — #308
- [x] Recovery key backend : generate, wrap/unwrap DEK, endpoints — #294
- [x] Recovery key frontend : modal dans Paramètres > Sécurité — #294
- [x] Prompt recovery key au signup — #295
- [x] Nudge recovery key après changement de mdp — #297
- [x] Page mot de passe oublié + reset-password — #296
- [x] Code coffre-fort Google OAuth — #300
- [x] Validation du code coffre-fort (key check canary) — #305
- [x] Mode démo bypass vault code — #308
- [x] Migration SQL : `wrapped_dek`, `key_check` columns
- [x] Migration design : tokens Material 3, StateCard, progress bars
- [x] Code review : 3 bugs corrigés (validator stale error, timezone bottom sheet, dead form field)
- [x] Documentation `ENCRYPTION.md` à jour
- [x] Tests : 87 fichiers frontend (1233 tests), backend, `pnpm quality` OK

## Ce qui reste

### 1. Déployer et vérifier la migration prod

- Merger la branche en `main`
- Déployer en prod
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

### 2. Cleanup backfill — #293

Une fois les 3 users migrés et vérifiés, supprimer le code temporaire :
- `encryption-backfill.service.ts`
- `encryption-backfill.interceptor.ts`
- `encryption-backfill.service.spec.ts`
- Références dans `encryption.module.ts` et `app.module.ts`

### 3. Drop colonnes plaintext (dernière étape)

Migration SQL pour supprimer les colonnes `amount`, `target_amount`, `ending_balance` des 5 tables. **Uniquement** après :
- Tous les users migrés
- Recovery key fonctionnelle pour tous
- Code backfill nettoyé
- Période d'observation en prod

## Ordre de completion

| # | Tâche | Ticket | Status |
|---|-------|--------|--------|
| 1 | Architecture split-key + colonnes encrypted | #274 | ✅ Done |
| 2 | Recovery key (backend + frontend) | #294 | ✅ Done |
| 3 | Prompt recovery key au signup | #295 | ✅ Done |
| 4 | Nudge recovery key post-password-change | #297 | ✅ Done |
| 5 | Page mot de passe oublié | #296 | ✅ Done |
| 6 | Code coffre-fort Google OAuth | #300 | ✅ Done |
| 7 | Validation du code coffre-fort | #305 | ✅ Done |
| 8 | Mode démo sans code coffre-fort | #308 | ✅ Done |
| 9 | Code review + bug fixes | — | ✅ Done |
| 10 | **Déploiement + migration prod** | — | ⏳ Prochaine étape |
| 11 | Vérification prod | — | 🔒 Bloqué par #10 |
| 12 | Cleanup backfill | #293 | 🔒 Bloqué par #11 |
| 13 | Drop colonnes plaintext | — | 🔒 Bloqué par #12 |

## Chaîne de dépendances GitHub

```
#274 (epic)
├── #294 (recovery key) ✅
├── #295 (prompt signup) ✅
├── #296 (forgot-password) ✅
├── #297 (nudge post-password-change) ✅
├── #300 (code coffre-fort Google OAuth) ✅
├── #305 (validation code coffre-fort) ✅
├── #308 (mode démo bypass vault code) ✅
└── #293 (cleanup backfill) ⏳ bloqué par déploiement + vérification
```
