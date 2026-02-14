# Chiffrement des montants financiers

Les montants utilisateurs (prévisions, réels, templates, épargne, soldes) sont chiffrés en base de données avec AES-256-GCM. Le déchiffrement nécessite deux secrets qui ne sont jamais réunis au même endroit de manière permanente.

## Architecture split-key

Le chiffrement repose sur une clé de données (DEK) dérivée de deux facteurs :

```
DEK = HKDF-SHA256(clientKey + masterKey, salt, "pulpe-dek-{userId}")
```

| Facteur | Origine | Stockage |
|---------|---------|----------|
| `clientKey` | Dérivé du **code PIN** (4 chiffres minimum) côté frontend (PBKDF2). | Conservé en `sessionStorage` par défaut (ou `localStorage` via « Se souvenir de cet appareil »). Effacé au logout. Envoyé dans le header `X-Client-Key` à chaque requête. Voir section « Stockage du clientKey » ci-dessous. |
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

Chaque table stocke les montants chiffrés dans une colonne texte (type `text`). La valeur est un ciphertext AES-256-GCM encodé en base64, ou `null` si aucun montant n'a été saisi.

| Table | Colonne chiffrée |
|-------|-----------------|
| `budget_line` | `amount` |
| `transaction` | `amount` |
| `template_line` | `amount` |
| `savings_goal` | `target_amount` |
| `monthly_budget` | `ending_balance` |

## Mode démo

Le mode démo utilise un `clientKey` déterministe (`DEMO_CLIENT_KEY_BUFFER`) pour emprunter le même chemin de code que les vrais utilisateurs. Ce n'est pas un secret — les données démo sont publiques.

- **Frontend** : `DEMO_CLIENT_KEY` est défini dans `crypto.utils.ts` et injecté via `ClientKeyService.setDirectKey()` à l'activation du mode démo.
- **Backend seed** : `DemoDataGeneratorService` bootstrap une DEK avec `DEMO_CLIENT_KEY_BUFFER` et chiffre tous les montants à l'insertion (même pipeline que les utilisateurs réels).
- **Backend requêtes** : reçoit le clientKey via le header `X-Client-Key` comme n'importe quel utilisateur. La DEK est dérivée normalement.

## Flux requête typique

```
1. Frontend dérive le clientKey depuis le **code PIN** (PBKDF2) ou utilise un clientKey déjà stocké
2. Frontend envoie la requête avec :
   - Authorization: Bearer {jwt}
   - X-Client-Key: {clientKey en hex}
3. AuthGuard extrait le clientKey du header
4. Service métier appelle encryptionService.ensureUserDEK(userId, clientKey)
5. DEK = HKDF(clientKey + masterKey, salt)
6. Les montants sont chiffrés/déchiffrés avec cette DEK
7. ClientKeyCleanupInterceptor efface le clientKey de la mémoire (buffer.fill(0))
```

## Changement / reset de mot de passe (auth uniquement)

Le mot de passe Supabase et le code PIN sont **indépendants**. Changer ou réinitialiser le mot de passe ne touche pas au chiffrement. Aucun endpoint encryption n'est appelé et le `clientKey` reste valable.

## Recovery key

La recovery key permet de récupérer l'accès aux données chiffrées quand le **code PIN** est perdu.

### Architecture

```
Setup (depuis les paramètres) :
  1. recoveryKey = randomBytes(32)                      // affiché une fois
  2. wrappedDEK = AES-256-GCM(DEK, recoveryKey)        // DEK chiffrée
  3. Stocker wrappedDEK dans user_encryption_key.wrapped_dek

Recovery (code PIN oublié) :
  1. User fournit recoveryKey + nouveau code PIN
  2. DEK = AES-GCM-decrypt(wrappedDEK, recoveryKey)
  3. Nouveau clientKey dérivé du code PIN avec le **salt existant**
  4. Re-chiffrer toutes les données avec la nouvelle DEK
  5. `wrapped_dek` est mis à jour avec la même recovery key
  6. Le frontend génère ensuite une **nouvelle** recovery key (setup-recovery) et l’affiche
```

### Format (UX)

- 32 bytes encodés en **base32 groupé** : `XXXX-XXXX-XXXX-XXXX-...`
- Pas d'ambiguïté 0/O, 1/l (alphabet RFC 4648)
- Confirmation obligatoire (coller la clé) avant fermeture de la modal

### Sécurité

- La recovery key n'est **jamais stockée** côté serveur (seul `wrappedDEK` l'est)
- Le serveur ne peut pas déchiffrer `wrappedDEK` sans la recovery key
- Rate limiting sur `/v1/encryption/recover` (5 tentatives/heure)
- Le `wrapped_dek` ne change que lors d'un setup recovery ou d'une récupération (recover)

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/encryption/setup-recovery` | Génère une recovery key, wrap la DEK, stocke `wrapped_dek` |
| `POST /v1/encryption/recover` | Recovery key + nouveau clientKey → rekey complet |

## Vérification du code PIN (key check canary)

Quand un utilisateur saisit son code PIN, l'app vérifie que le `clientKey` dérivé est correct **avant** de donner accès au dashboard. Ce mécanisme empêche un utilisateur de se retrouver avec des écrans cassés (montants à 0) en cas de code incorrect.

### Principe

La colonne `key_check` de `user_encryption_key` stocke un ciphertext canary : `AES-256-GCM(DEK, 0)`. Comme AES-GCM est un chiffrement authentifié, le déchiffrement échoue si la DEK est incorrecte (l'auth tag ne correspond pas).

### Flux de validation

```
1. Frontend dérive clientKey depuis le code PIN (PBKDF2)
2. Frontend appelle POST /v1/encryption/validate-key { clientKey }
3. Backend dérive DEK = HKDF(clientKey + masterKey, salt)
4. Backend tente de déchiffrer key_check avec la DEK
5. Si succès → 204 (code correct, accès autorisé)
   Si échec → 400 (code incorrect, accès refusé)
```

### Cycle de vie du key_check

| Événement | Action |
|-----------|--------|
| Première validation (key_check absent) | Généré et stocké |
| Recovery (`/recover`) | Régénéré avec la nouvelle DEK |
| Setup recovery key | Régénéré (assure la cohérence) |

### Rate limiting

L'endpoint `validate-key` est limité à 5 tentatives par minute par utilisateur pour prévenir le brute-force.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/encryption/validate-key` | Vérifie le clientKey via le canary key_check |

## Sécurité de la table `user_encryption_key`

- RLS activé : seul `service_role` peut lire/écrire
- `REVOKE ALL` sur les rôles `authenticated` et `anon`
- Pas de politique DELETE (suppression uniquement via `ON DELETE CASCADE` depuis `auth.users`)

## Stockage du clientKey

Le `clientKey` est stocké côté client via `StorageService` :
- `sessionStorage` : `pulpe-vault-client-key-session` (par défaut)
- `localStorage` : `pulpe-vault-client-key-local` (option « Se souvenir de cet appareil »)

**Propriétés :**
- `sessionStorage` est limité à l'onglet (non partagé entre onglets)
- `localStorage` persiste entre sessions (si l'utilisateur choisit « Se souvenir »)
- Les deux sont effacés explicitement au logout (`ClientKeyService.clear()` + `AuthCleanupService`)

**Risque accepté :** une vulnérabilité XSS dans l'application permettrait de lire le `clientKey` depuis `sessionStorage`. Ce risque est atténué par :
1. La politique CSP (Content Security Policy) qui limite l'exécution de scripts tiers
2. Le fait qu'une XSS permettrait aussi d'intercepter le code PIN ou le mot de passe directement à la saisie
3. Le `clientKey` seul est insuffisant pour déchiffrer (il faut aussi la `masterKey` serveur)

**Alternative rejetée :** stocker le `clientKey` uniquement en mémoire (signal Angular) imposerait une re-saisie du code PIN à chaque rechargement de page, dégradant fortement l'expérience utilisateur.

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
| `encryption.service.ts` | Dérivation DEK, chiffrement/déchiffrement AES-GCM, wrap/unwrap DEK, cache, re-chiffrement |
| `encryption-key.repository.ts` | CRUD de la table `user_encryption_key` (salt, wrapped_dek) |
| `encryption.controller.ts` | Endpoints `/salt`, `/validate-key`, `/setup-recovery`, `/recover` |
| `client-key-cleanup.interceptor.ts` | Efface le clientKey de la mémoire après chaque requête |
| `auth.guard.ts` | Extrait et valide le `X-Client-Key` du header |
| `crypto.utils.ts` (frontend) | Dérivation PBKDF2, `DEMO_CLIENT_KEY` |
| `client-key.service.ts` (frontend) | Gestion du clientKey en sessionStorage |
| `recovery-key-dialog.ts` (frontend) | Modal d'affichage et confirmation de la recovery key |
