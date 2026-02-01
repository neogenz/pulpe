# Chiffrement des montants financiers

Les montants utilisateurs (prévisions, réels, templates, épargne, soldes) sont chiffrés en base de données avec AES-256-GCM. Le déchiffrement nécessite deux secrets qui ne sont jamais réunis au même endroit de manière permanente.

## Architecture split-key

Le chiffrement repose sur une clé de données (DEK) dérivée de deux facteurs :

```
DEK = HKDF-SHA256(clientKey + masterKey, salt, "pulpe-dek-{userId}")
```

| Facteur | Origine | Stockage |
|---------|---------|----------|
| `clientKey` | Dérivé du mot de passe utilisateur côté frontend | Conservé en `sessionStorage` (limité à l'onglet, effacé à la fermeture ou au logout). Envoyé dans le header `X-Client-Key` à chaque requête. Voir section « Stockage du clientKey » ci-dessous. |
| `masterKey` | Variable d'environnement `ENCRYPTION_MASTER_KEY` | Serveur uniquement. GitHub Secrets en prod, `.env` en local. |
| `salt` | Généré aléatoirement par utilisateur | Table `user_encryption_key` (accessible uniquement au `service_role`). |

La DEK n'est jamais stockée. Elle est recalculée à chaque requête (avec un cache en mémoire de 5 minutes).

### Ce que ça implique en cas de fuite

| Scénario | Impact |
|----------|--------|
| Fuite de la base de données seule | Les montants sont illisibles (chiffrés en base64/AES-GCM). |
| Fuite de la master key seule | Inutile sans le client key de chaque utilisateur. |
| Fuite d'un client key seul (ex: interception réseau) | Inutile sans la master key serveur. |
| Fuite master key **ET** client key | Toutes les données de l'utilisateur concerné sont déchiffrables. |

## Algorithme de chiffrement

- **AES-256-GCM** : chiffrement authentifié (confidentialité + intégrité)
- **IV** : 12 octets aléatoires par opération (jamais réutilisé)
- **Auth tag** : 16 octets
- **Format stocké** : `base64(IV || authTag || ciphertext)`
- **Dérivation** : HKDF-SHA256 avec info contextuelle `pulpe-dek-{userId}`

## Tables concernées

Chaque table a une colonne `amount_encrypted` (ou équivalent) à côté de la colonne `amount` existante. Les deux coexistent pendant la phase de migration.

| Table | Colonne claire | Colonne chiffrée |
|-------|---------------|-----------------|
| `budget_line` | `amount` | `amount_encrypted` |
| `transaction` | `amount` | `amount_encrypted` |
| `template_line` | `amount` | `amount_encrypted` |
| `savings_goal` | `target_amount` | `target_amount_encrypted` |
| `monthly_budget` | `ending_balance` | `ending_balance_encrypted` |

Quand le chiffrement est actif (clientKey présent), les colonnes en clair contiennent `0` et seules les colonnes `*_encrypted` contiennent les montants réels.

## Mode démo

Le mode démo utilise un `clientKey` déterministe (`DEMO_CLIENT_KEY`) pour emprunter le même chemin de code que les vrais utilisateurs. Ce n'est pas un secret — les données démo sont publiques.

- **Frontend** : `DEMO_CLIENT_KEY` est défini dans `crypto.utils.ts` et injecté via `ClientKeyService.setDirectKey()` à l'activation du mode démo.
- **Backend** : reçoit le clientKey via le header `X-Client-Key` comme n'importe quel utilisateur. La DEK est dérivée normalement.
- **Backfill** : les données de seed (insérées sans encryption) sont chiffrées automatiquement lors de la première requête grâce au `EncryptionBackfillInterceptor`.

## Flux requête typique

```
1. Frontend dérive clientKey depuis le mot de passe (PBKDF2)
2. Frontend envoie la requête avec :
   - Authorization: Bearer {jwt}
   - X-Client-Key: {clientKey en hex}
3. AuthGuard extrait le clientKey du header
4. Service métier appelle encryptionService.ensureUserDEK(userId, clientKey)
5. DEK = HKDF(clientKey + masterKey, salt)
6. Les montants sont chiffrés/déchiffrés avec cette DEK
7. ClientKeyCleanupInterceptor efface le clientKey de la mémoire (buffer.fill(0))
```

## Changement de mot de passe (rekey)

Quand un utilisateur change son mot de passe, son `clientKey` change. Il faut donc re-chiffrer toutes ses données.

1. Le frontend appelle `POST /v1/encryption/password-change` avec le nouveau `clientKey`
2. Le backend dérive l'ancienne DEK (ancien clientKey + masterKey + ancien salt) et la nouvelle DEK (nouveau clientKey + masterKey + nouveau salt)
3. Toutes les données sont déchiffrées avec l'ancienne DEK et re-chiffrées avec la nouvelle
4. L'opération est atomique côté SQL via la RPC `rekey_user_encrypted_data`
5. En cas d'échec, le salt est restauré à sa valeur précédente

## Recovery key

La recovery key permet de récupérer l'accès aux données chiffrées si l'utilisateur oublie son mot de passe.

### Architecture

```
Setup (depuis les paramètres) :
  1. recoveryKey = randomBytes(32)                      // affiché une fois
  2. wrappedDEK = AES-256-GCM(DEK, recoveryKey)        // DEK chiffrée
  3. Stocker wrappedDEK dans user_encryption_key.wrapped_dek

Recovery (mot de passe oublié) :
  1. User fournit recoveryKey + nouveau mot de passe
  2. DEK = AES-GCM-decrypt(wrappedDEK, recoveryKey)
  3. Nouveau clientKey dérivé du nouveau mot de passe
  4. Nouveau salt, nouvelle DEK' = HKDF(newClientKey + masterKey, newSalt)
  5. Re-chiffrer toutes les données avec DEK'
  6. Nouveau wrappedDEK' = AES-GCM(DEK', recoveryKey)
```

### Format (UX)

- 32 bytes encodés en **base32 groupé** : `XXXX-XXXX-XXXX-XXXX-...`
- Pas d'ambiguïté 0/O, 1/l (alphabet RFC 4648)
- Confirmation obligatoire (coller la clé) avant fermeture de la modal

### Sécurité

- La recovery key n'est **jamais stockée** côté serveur (seul `wrappedDEK` l'est)
- Le serveur ne peut pas déchiffrer `wrappedDEK` sans la recovery key
- Rate limiting sur `/v1/encryption/recover` (5 tentatives/heure)
- Après un changement de mot de passe, `wrappedDEK` est invalidé (l'utilisateur doit re-générer une recovery key)

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/encryption/setup-recovery` | Génère une recovery key, wrap la DEK, stocke `wrapped_dek` |
| `POST /v1/encryption/recover` | Recovery key + nouveau clientKey → rekey complet |

## Sécurité de la table `user_encryption_key`

- RLS activé : seul `service_role` peut lire/écrire
- `REVOKE ALL` sur les rôles `authenticated` et `anon`
- Pas de politique DELETE (suppression uniquement via `ON DELETE CASCADE` depuis `auth.users`)

## Stockage du clientKey

Le `clientKey` est conservé dans `sessionStorage` sous la clé `pulpe:client-key` pour éviter de redemander le mot de passe à chaque rechargement de page.

**Propriétés de `sessionStorage` :**
- Limité à l'onglet du navigateur (non partagé entre onglets)
- Effacé automatiquement à la fermeture de l'onglet
- Effacé explicitement au logout (`ClientKeyService.clear()`)

**Risque accepté :** une vulnérabilité XSS dans l'application permettrait de lire le `clientKey` depuis `sessionStorage`. Ce risque est atténué par :
1. La politique CSP (Content Security Policy) qui limite l'exécution de scripts tiers
2. Le fait qu'une XSS permettrait aussi d'intercepter le mot de passe directement à la saisie
3. Le `clientKey` seul est insuffisant pour déchiffrer (il faut aussi la `masterKey` serveur)

**Alternative rejetée :** stocker le `clientKey` uniquement en mémoire (signal Angular) imposerait une re-saisie du mot de passe à chaque rechargement de page, dégradant fortement l'expérience utilisateur.

## Configuration

### Production / CI

```bash
# Générer une master key
openssl rand -hex 32

# Résultat : 64 caractères hexadécimaux, ex:
# a3f1b2c4d5e6f7890123456789abcdef0123456789abcdef0123456789abcdef
```

Cette valeur doit être configurée dans :
- **GitHub Secrets** : `ENCRYPTION_MASTER_KEY` (pour le déploiement)
- **CI** : déjà configuré dans `ci.yml` avec une valeur de test
- **Local** : dans `backend-nest/.env` (gitignored)

### Validation

Le backend vérifie au démarrage que `ENCRYPTION_MASTER_KEY` :
- est défini
- fait exactement 64 caractères hexadécimaux (32 octets)

Si la validation échoue, le serveur refuse de démarrer.

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `encryption.service.ts` | Dérivation DEK, chiffrement/déchiffrement AES-GCM, wrap/unwrap DEK, cache |
| `encryption-key.repository.ts` | CRUD de la table `user_encryption_key` (salt, wrapped_dek) |
| `encryption-rekey.service.ts` | Re-chiffrement de toutes les données lors d'un changement de mot de passe |
| `encryption.controller.ts` | Endpoints `/salt`, `/password-change`, `/setup-recovery`, `/recover` |
| `client-key-cleanup.interceptor.ts` | Efface le clientKey de la mémoire après chaque requête |
| `encryption-backfill.interceptor.ts` | Chiffre les données plaintext existantes à la première requête |
| `auth.guard.ts` | Extrait et valide le `X-Client-Key` du header |
| `crypto.utils.ts` (frontend) | Dérivation PBKDF2, `DEMO_CLIENT_KEY` |
| `client-key.service.ts` (frontend) | Gestion du clientKey en sessionStorage |
| `recovery-key-dialog.ts` (frontend) | Modal d'affichage et confirmation de la recovery key |
