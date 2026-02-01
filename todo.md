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

## Ce qui reste sur cette branche

### 1. Prompt recovery key au signup — #295

Le plus important. Sans ça, les nouveaux utilisateurs n'auront jamais de recovery key.

**Fichiers :** `signup.ts` → après signup réussi, appeler `setupRecoveryKey$()` et ouvrir `RecoveryKeyDialog` (disableClose).

### 2. Page "mot de passe oublié" — #296

Sans cette page, un utilisateur qui oublie son mot de passe perd ses données.

**Fichiers à créer :**
- `feature/auth/forgot-password/` (envoi email Supabase)
- `feature/auth/reset-password/` (recovery key + nouveau mdp → rekey)
- Routes dans `app.routes.ts`
- Lien "Mot de passe oublié ?" dans `login.ts`

**Flow :** email → lien Supabase → `/reset-password` → recovery key + nouveau mdp → `POST /v1/encryption/recover` → nouvelle recovery key affichée.

### 3. Nudge recovery key après changement de mdp — #297

Après un changement de mot de passe, `wrapped_dek` est nullifié. L'utilisateur doit être invité à re-générer une recovery key.

**Fichier :** là où le changement de mot de passe est géré côté frontend → après succès, appeler `setupRecoveryKey$()` + ouvrir la dialog.

### 4. Déployer et vérifier la migration prod

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

### 5. Cleanup backfill — #293

Une fois les 3 users migrés et vérifiés, supprimer le code temporaire :
- `encryption-backfill.service.ts`
- `encryption-backfill.interceptor.ts`
- `encryption-backfill.service.spec.ts`
- Références dans `encryption.module.ts` et `app.module.ts`

### 6. Drop colonnes plaintext (dernière étape)

Migration SQL pour supprimer les colonnes `amount`, `target_amount`, `ending_balance` des 5 tables. **Uniquement** après :
- Tous les users migrés
- Recovery key fonctionnelle pour tous
- Code backfill nettoyé
- Période d'observation en prod

## Ordre recommandé

| # | Tâche | Ticket | Bloqué par |
|---|-------|--------|------------|
| 1 | Prompt recovery key au signup | #295 | — |
| 2 | Nudge recovery key post-password-change | #297 | — |
| 3 | Page mot de passe oublié | #296 | #295 |
| 4 | Déploiement + migration prod | — | #295, #296 |
| 5 | Vérification prod | — | Déploiement |
| 6 | Cleanup backfill | #293 | Vérification |
| 7 | Drop colonnes plaintext | — | #293 |

## Chaîne de dépendances GitHub

```
#274 (epic)
├── #294 (recovery key) ← backend + settings DONE, reste #295 #296 #297
├── #295 (prompt signup)
├── #296 (forgot-password) ← bloqué par #295
├── #297 (nudge post-password-change)
└── #293 (cleanup backfill) ← bloqué par déploiement + vérification
```
