# Chiffrement des montants financiers

Les montants utilisateurs (prévisions, réels, templates, épargne, soldes) sont chiffrés en base de données avec AES-256-GCM. Le déchiffrement nécessite deux secrets qui ne sont jamais réunis au même endroit de manière permanente.

## Architecture split-key

Le chiffrement repose sur une clé de données (DEK) dérivée de deux facteurs :

```
DEK = HKDF-SHA256(clientKey + masterKey, salt, "pulpe-dek-{userId}")
```

| Facteur     | Origine                                                     | Stockage                                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientKey` | Dérivé du **code PIN** (4 chiffres) côté frontend (PBKDF2). | Conservé en `sessionStorage` par défaut (ou `localStorage` via « Se souvenir de cet appareil »). Effacé au logout. Envoyé dans le header `X-Client-Key` à chaque requête. Voir section « Stockage du clientKey » ci-dessous. |
| `masterKey` | Variable d'environnement `ENCRYPTION_MASTER_KEY`            | Serveur uniquement. GitHub Secrets en prod, `.env` en local.                                                                                                                                                                 |
| `salt`      | Généré aléatoirement par utilisateur                        | Table `user_encryption_key` (accessible uniquement au `service_role`).                                                                                                                                                       |

La DEK n'est jamais stockée. Un cache mémoire de 5 minutes évite de répéter la dérivation, mais chaque nouvelle requête de mutation revalide son entrée avec le `key_check` courant.

### Ce que ça implique en cas de fuite

| Scénario                                             | Impact                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Fuite de la base de données seule                    | Les montants sont illisibles (chiffrés en base64/AES-GCM).       |
| Fuite de la master key seule                         | Inutile sans le client key de chaque utilisateur.                |
| Fuite d'un client key seul (ex: interception réseau) | Inutile sans la master key serveur.                              |
| Fuite master key **ET** client key                   | Toutes les données de l'utilisateur concerné sont déchiffrables. |

## Algorithme de chiffrement

- **AES-256-GCM** : chiffrement authentifié (confidentialité + intégrité)
- **IV** : 12 octets aléatoires par opération (jamais réutilisé)
- **Auth tag** : 16 octets
- **Format stocké** : `base64(IV || authTag || ciphertext)`
- **Dérivation** : HKDF-SHA256 avec info contextuelle `pulpe-dek-{userId}`

## Tables concernées

Chaque table stocke les montants chiffrés dans une colonne texte (type `text`). La valeur est un ciphertext AES-256-GCM encodé en base64, ou `null` si aucun montant n'a été saisi.

| Table                          | Colonne chiffrée                                            |
| ------------------------------ | ----------------------------------------------------------- |
| `budget_line`                  | `amount`, `original_amount`                                 |
| `transaction`                  | `amount`, `original_amount`                                 |
| `template_line`                | `amount`, `original_amount`                                 |
| `savings_goal`                 | `target_amount`, `initial_amount`, `original_target_amount` |
| `monthly_budget`               | `ending_balance`                                            |
| `savings_goal_plan_withdrawal` | `amount`                                                    |

### Colonnes plaintext liées mathématiquement aux montants chiffrés

Les tables multi-devises (`budget_line`, `transaction`, `template_line`) stockent aussi `exchange_rate` en `NUMERIC(18,8)` **non chiffré**, à côté de `amount` et `original_amount` (tous deux chiffrés AES-256-GCM). L'invariant métier est `original_amount ≈ amount × exchange_rate` (aux arrondis près).

Cela signifie que les deux colonnes de montants chiffrés sont mathématiquement liées via une colonne publique. Concrètement : une fuite du DEK d'un utilisateur donne accès aux deux montants ; mais aussi, si `amount` venait à fuiter via une voie latérale (mauvaise journalisation, requête `service_role` erronée, exfiltration de backup), `original_amount` devient dérivable gratuitement pour la même ligne. La défense en profondeur sur `amount` est donc aussi celle sur `original_amount` — garder le pipeline de chiffrement des montants étanche est la seule barrière.

Le chiffrement étant par utilisateur (DEK dérivée), ce lien n'est exploitable qu'à l'intérieur des données d'un seul utilisateur.

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
4. Pour une mutation, AuthGuard valide le `key_check` courant avant le contrôleur
5. Le service métier réutilise cette preuve uniquement dans la requête courante
6. DEK = HKDF(clientKey + masterKey, salt)
7. Les montants sont chiffrés/déchiffrés avec cette DEK
8. ClientKeyCleanupInterceptor efface le clientKey de la mémoire (buffer.fill(0))
```

## Changement / reset de mot de passe (auth uniquement)

Le mot de passe Supabase et le code PIN sont **indépendants**. Changer ou réinitialiser le mot de passe ne touche pas au chiffrement. Aucun endpoint encryption n'est appelé et le `clientKey` reste valable.

## Changement de code PIN

Le changement de code PIN re-chiffre toutes les données financières avec une nouvelle DEK dérivée du nouveau PIN.

### Flux

```
1. Frontend dérive oldClientKey (ancien PIN) et newClientKey (nouveau PIN) via PBKDF2
2. Frontend appelle POST /v1/encryption/change-pin { oldClientKey, newClientKey }
3. Backend vérifie oldClientKey via key_check (canary)
4. Toutes les données sont re-chiffrées atomiquement (RPC rekey_user_encrypted_data)
5. key_check est recalculé avec la nouvelle DEK
6. Nouvelle recovery key générée et nouvelle DEK wrappée (inconditionnel)
7. Réponse : { keyCheck: string, recoveryKey: string }
8. Frontend affiche la nouvelle recovery key à l'utilisateur
```

### Recovery key et changement de PIN

Quand l'utilisateur avait une recovery key configurée, le changement de PIN génère une **nouvelle recovery key** et re-wrappe la nouvelle DEK dans le même appel. Le `wrapped_dek` passe directement de l'ancien wrapping au nouveau — il n'est **jamais null**. Le frontend affiche la nouvelle recovery key dans le modal `RecoveryKeyDialog`.

Si le re-wrapping échoue après un re-chiffrement réussi, le `wrapped_dek` est nullifié par sécurité (pour éviter un wrapping stale pointant vers l'ancienne DEK).

### Atomicité et pagination du rekey

Le backend lit d'abord toutes les lignes chiffrées, page par page avec un ordre stable sur `id`. Les filtres contenant des identifiants parents sont découpés pour rester sous les limites d'URL PostgREST. Il construit puis valide ensuite la totalité des payloads avant d'appeler une seule fois `rekey_user_encrypted_data_with_plan_withdrawals`.

Ce RPC met à jour atomiquement les ciphertexts et le nouveau `key_check`. Une erreur de lecture, y compris sur une page après les 1 000 premières lignes, interrompt donc le flux avant toute mutation. Après succès, le canary est lisible avec la nouvelle DEK et rejeté avec l'ancienne.

L'ordre d'écriture est ce qui rend le canary honnête : le cœur partagé re-chiffre les cinq tables historiques **sans** canary, puis `savings_goal_plan_withdrawal` est traitée, et `key_check` n'est écrit qu'en dernier. Deux assertions distinctes gardent cette table, parce qu'elles n'attrapent pas la même chose. Le RPC compte d'abord les lignes de l'utilisateur sous le verrou de table : le backend a lu sa charge utile avant que ce verrou n'existe, donc une ligne validée entre-temps en serait simplement absente, et une vérification identifiant par identifiant passerait pendant que cette ligne garde son ancien chiffrement. Il vérifie ensuite que la mise à jour par identifiant a touché exactement autant de lignes que la charge en portait. Une ligne omise comme une ligne inconnue fait donc échouer toute la transaction avant que la nouvelle clé ne soit certifiée.

La signature historique `rekey_user_encrypted_data`, qui ignore cette table, subsiste uniquement pour un pod encore déployé pendant un rolling deploy. Elle échoue désormais sans aucune mutation dès que l'utilisateur possède au moins une ligne `savings_goal_plan_withdrawal`, sous verrou de table pour qu'une ligne ne puisse pas apparaître entre le contrôle et l'écriture. Preuve : `supabase/tests/rekey_plan_withdrawal_rolling_deploy.sql`.

### Rate limiting

L'endpoint `change-pin` est limité à 5 appels par heure par utilisateur.

### Endpoints

| Endpoint                         | Description                                         |
| -------------------------------- | --------------------------------------------------- |
| `POST /v1/encryption/change-pin` | Ancien + nouveau clientKey → re-chiffrement complet |

## Recovery key

La recovery key permet de récupérer l'accès aux données chiffrées quand le **code PIN** est perdu.

### Architecture

```
Setup initial :
  1. Le client dérive clientKey depuis le nouveau PIN
  2. Le backend confirme que key_check et wrapped_dek sont absents
     et qu'aucune donnée chiffrée n'existe
  3. recoveryKey = randomBytes(32)                      // affiché une fois
  4. wrappedDEK = AES-256-GCM(DEK, recoveryKey)        // DEK chiffrée
  5. Stocker key_check + wrapped_dek dans une même mise à jour conditionnelle

Ajout d'une recovery key à un coffre configuré :
  1. Vérifier clientKey avec le key_check existant
  2. Générer recoveryKey et wrappedDEK
  3. Stocker wrapped_dek seulement s'il est encore absent

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
- Le `wrapped_dek` ne change que lors d'un setup recovery, d'une récupération (recover) ou d'un changement de PIN (re-wrappé)

### Endpoints

| Endpoint                             | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| `POST /v1/encryption/setup-recovery` | Génère une recovery key, wrap la DEK, stocke `wrapped_dek` |
| `POST /v1/encryption/recover`        | Recovery key + nouveau clientKey → rekey complet           |

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

| Événement                          | Action                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| Setup initial (`/setup-recovery`)  | `key_check` et `wrapped_dek` créés atomiquement si le coffre est vide |
| Validation avec `key_check` absent | Refusée sans mutation                                                 |
| Recovery (`/recover`)              | Régénéré avec la nouvelle DEK                                         |
| Changement de PIN (`/change-pin`)  | Régénéré avec la nouvelle DEK                                         |
| Mode démo                          | Initialisé avec la clé démo fixe, hors parcours utilisateur           |

### Rate limiting

L'endpoint `validate-key` est limité à 5 tentatives par minute par utilisateur pour prévenir le brute-force.

### Endpoints

| Endpoint                           | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `POST /v1/encryption/validate-key` | Vérifie le clientKey via le canary key_check |

## Brute-force du code PIN hors ligne (risque accepté)

Le code PIN 4 chiffres comporte 10 000 combinaisons. Si la table `user_encryption_key` fuit (salt + key_check), un attaquant peut brute-forcer la clé client hors ligne en ~16ms avec PBKDF2-600K itérations.

Cependant, l'architecture split-key atténue ce risque : DEK = HKDF(clientKey + masterKey, salt). La clé client seule est inutile — l'attaquant aurait aussi besoin de la `masterKey` (variable d'environnement serveur, jamais stockée en base de données). Une fuite simultanée de la base de données ET des variables d'environnement serveur représente un compromis catastrophique où même un code PIN 6–8 chiffres serait insuffisant.

De plus :

- La table `user_encryption_key` est accessible uniquement au `service_role` (`REVOKE ALL` sur les rôles `authenticated` et `anon`)
- Le brute-force en ligne est bloqué par le rate limiting (5 tentatives/min sur `validate-key`)
- La constante `pinLength` dans `CryptoService` est fixée à 4 chiffres (peut être augmentée si la réglementation l'exige)

## Absence d'AAD sur les ciphertexts de montants (risque accepté)

Les montants sont chiffrés en AES-256-GCM sans _additional authenticated data_. Un attaquant disposant d'un **accès en écriture à la base** peut donc déplacer un ciphertext d'une colonne à une autre : le tag GCM reste valide et l'application affiche le montant déplacé.

Portée réelle de l'attaque, avant d'envisager une correction :

| Variante de relocation                                                                                       | Déjà bloquée ?                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vers un **autre utilisateur**                                                                                | Oui. `DEK = HKDF(clientKey + masterKey, salt, "pulpe-dek-{userId}")` : le sel et l'`info` diffèrent par utilisateur, le tag GCM échoue (couvert par `cross-dek-budget-line.spec.ts`)                                                                    |
| **Ligne → ligne, même colonne** (`budget_line.amount` de A vers `budget_line.amount` de B, même utilisateur) | Non, et une AAD ne peut pas la bloquer ici : les RPC SQL propagent légitimement les ciphertexts `template_line.amount → budget_line.amount`, donc lier l'AAD à la table ou à l'identifiant de ligne casserait la provision d'un budget depuis un modèle |
| **Champ → champ, même utilisateur** (`amount` vers `target_amount`)                                          | Non. C'est la seule variante qu'une AAD `{userId}:{champ}` fermerait                                                                                                                                                                                    |

Une AAD par champ ne fermerait donc que la variante la moins probable, et son coût de mise en œuvre est disproportionné : le contexte `champ` devrait être passé aux **65 sites d'appel** de `encryptAmount`/`decryptAmount`/`tryDecryptAmount` répartis sur 9 fichiers, et le déchiffrement devrait porter en permanence une branche v1/v2 pour rester compatible avec l'existant.

Le facteur décisif est le mode de défaillance. Tous les chemins de lecture passent par `tryDecryptAmount`, qui **ne lève jamais** : un échec de déchiffrement retourne le repli (`0` ou `null`) et n'émet qu'un `warn`. Une seule étiquette de champ erronée parmi les 65 afficherait donc silencieusement `0 €` à la place du montant réel de vrais utilisateurs — exactement le préjudice que la mesure prétend empêcher, mais infligé à tout le monde plutôt qu'à la cible d'un attaquant qui possède déjà la base.

Décision : pas d'AAD pour l'instant. Si elle est implémentée un jour, la conception retenue est fixée — préfixe `v2:`, AAD `{userId}:{champ sémantique}`, jamais la table ni l'identifiant de ligne (à cause de la propagation `template_line → budget_line`), déchiffrement rétrocompatible v1 et migration paresseuse à la prochaine écriture. Prérequis à traiter d'abord : faire échouer bruyamment les chemins de lecture au lieu du repli silencieux à 0.

## Transport du client key via header HTTP (risque accepté)

Le header `X-Client-Key` est envoyé sur tous les endpoints de données (budgets, transactions, templates) car le serveur a besoin de la clé client au moment de la requête pour dériver la DEK. Seuls 4 endpoints utilisent `@SkipClientKey()` (vault-status, salt, validate-key, recover).

Atténuations :

- HTTPS/TLS chiffre les headers en transit
- Le `logRequest` iOS ne journalise que la méthode, le chemin et le code de statut (jamais les headers)
- Le backend ne journalise que des avertissements pour les headers manquants/invalides (jamais la valeur)
- La clé client seule est insuffisante pour le déchiffrement (architecture split-key)

## Sécurité de la table `user_encryption_key`

- RLS activé : seul `service_role` peut lire/écrire
- `REVOKE ALL` sur les rôles `authenticated` et `anon`
- Pas de politique DELETE (suppression uniquement via `ON DELETE CASCADE` depuis `auth.users`)

### Pourquoi le rekey passe par le `service_role`

Entre `20260212100000` et `20260804130000`, `authenticated` disposait de `GRANT SELECT (user_id)` et `GRANT UPDATE (key_check, updated_at)` : le RPC `rekey_user_encrypted_data`, `SECURITY INVOKER`, était appelé avec le JWT de l'utilisateur et avait besoin de ces privilèges pour écrire le canary. Conséquence : un jeton volé pouvait écrire `key_check` directement via PostgREST et rendre le coffre de son propriétaire indéchiffrable.

Depuis `20260804130000`, le rekey est appelé par `SupabaseEncryptionKeyRepository.rekeyUserData()` sur le client `service_role`, comme tous les autres accès à la table. `EXECUTE` sur le RPC est révoqué pour `authenticated` et `anon` : ni l'écriture directe ni l'appel forgé du RPC ne sont possibles avec un JWT utilisateur.

Le cœur qui écrit les cinq tables historiques, `rekey_user_encrypted_data_core`, reste `SECURITY INVOKER`. Il n'est plus soumis au RLS, donc l'appartenance des lignes n'est plus garantie par les politiques : chaque `UPDATE` est explicitement borné à `p_user_id` (directement pour `savings_goal` et `monthly_budget`, via `monthly_budget` pour `budget_line` et `transaction`, via `template` pour `template_line`), et les assertions de nombre de lignes font échouer toute la transaction si un identifiant du payload n'appartient pas à l'utilisateur.

Depuis `20260808170000`, ce cœur n'est atteignable que par ses deux points d'entrée, qui sont eux `SECURITY DEFINER` et possédés par `postgres` : `EXECUTE` est révoqué sur le cœur pour tous les rôles, `service_role` compris. C'est ce qui rend le garde-fou incontournable — sans cela, un appel direct au cœur sauterait la vérification des retraits de plan. Les deux points d'entrée sont eux-mêmes révoqués pour `authenticated` et `anon`, leur `search_path` est vide et leur corps est fixe, borné à `p_user_id` : le privilège supplémentaire ne s'applique qu'à des écritures déjà bornées.

**Ne pas rétablir de `GRANT` sur cette table pour débloquer un flux** : le flux doit passer par le repository `service_role`.

## Stockage du clientKey

### Web (Angular)

Le `clientKey` est stocké côté client via `StorageService` :

- `sessionStorage` : `pulpe-vault-client-key-session` (par défaut)
- `localStorage` : `pulpe-vault-client-key-local` (option « Se souvenir de cet appareil »)

**Propriétés :**

- `sessionStorage` est limité à l'onglet (non partagé entre onglets)
- `localStorage` persiste entre sessions (si l'utilisateur choisit « Se souvenir »)
- Au logout, `clearPreservingDeviceTrust()` efface la clé en mémoire et en `sessionStorage`, mais **préserve** le `localStorage` si l'utilisateur a choisi « Se souvenir de cet appareil »

**Risque accepté :** une vulnérabilité XSS dans l'application permettrait de lire le `clientKey` depuis `sessionStorage`. Ce risque est atténué par :

1. La politique CSP (Content Security Policy) qui limite l'exécution de scripts tiers
2. Le fait qu'une XSS permettrait aussi d'intercepter le code PIN ou le mot de passe directement à la saisie
3. Le `clientKey` seul est insuffisant pour déchiffrer (il faut aussi la `masterKey` serveur)

**Alternative rejetée :** stocker le `clientKey` uniquement en mémoire (signal Angular) imposerait une re-saisie du code PIN à chaque rechargement de page, dégradant fortement l'expérience utilisateur.

#### « Se souvenir de cet appareil » : persistance en localStorage (risque accepté)

Cocher l'option bascule le `clientKey` de `sessionStorage` vers `localStorage`. Ça ne crée pas une nouvelle classe de vulnérabilité — c'est le même vecteur XSS que ci-dessus — mais ça **élargit la fenêtre d'exploitation** sur deux axes :

|                        | Sans « se souvenir » | Avec « se souvenir »                                                               |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| Durée de vie de la clé | L'onglet             | Jusqu'à effacement explicite par l'utilisateur                                     |
| Survie au logout       | Non                  | Oui (`clearPreservingDeviceTrust()` préserve délibérément l'entrée `localStorage`) |

Le scénario complet est le vol **combiné** : une XSS doit exfiltrer à la fois la session Supabase et le `clientKey` pour que l'attaquant déchiffre des montants. L'un sans l'autre ne suffit pas — le backend refuse une requête sans header `X-Client-Key` valide, et le `clientKey` seul ne dérive rien sans la `masterKey` serveur.

**Mitigations en place :**

1. CSP stricte (`vercel.json`) : `script-src 'self'` + deux origines tierces explicites, ni `unsafe-inline` ni `unsafe-eval`. Seul `script-src-attr` porte un `'unsafe-hashes'` limité à un hash `sha256` précis. `frontend/scripts/check-no-inline-scripts.ts` échoue le build si un script inline non prévu apparaît
2. Sanitizer Angular par défaut sur toute interpolation ; aucun `bypassSecurityTrust*` sur du contenu d'origine utilisateur
3. La session Supabase reste soumise à son expiration et à la révocation côté serveur

**Décision produit :** l'option est **conservée**. Un utilisateur sur sa propre machine échange une fenêtre d'exposition plus large contre l'absence de re-saisie du PIN — c'est son arbitrage, pas le nôtre. La contrepartie est de le rendre explicite : les trois écrans vault (`enter-vault-code`, `setup-vault-code`, `recover-vault-code`) affichent sous la case à cocher un avertissement (`auth.vaultCode.rememberDeviceHint`) qui nomme le stockage local de la clé et déconseille l'option sur un ordinateur partagé.

### iOS (SwiftUI)

Le `clientKey` est géré par `ClientKeyManager` (actor) avec trois niveaux de stockage :

| Niveau               | Stockage                                                              | Survit au grace period lock | Survit au logout |
| -------------------- | --------------------------------------------------------------------- | --------------------------- | ---------------- |
| Cache mémoire        | `cachedClientKeyHex` (propriété actor)                                | Non                         | Non              |
| Keychain standard    | `KeychainManager.saveClientKey()`                                     | Oui                         | Non              |
| Keychain biométrique | `KeychainManager.saveBiometricClientKey()` (protégé Face ID/Touch ID) | Oui                         | Non (`clearAll`) |

#### Grace period (verrouillage après `AppConfiguration.backgroundGracePeriod`, 30s actuellement)

```
1. App passe en background → sauvegarde timestamp
2. App revient au foreground après >= 30s (valeur actuelle)
3. clientKeyManager.clearCache() → efface UNIQUEMENT le cache mémoire
4. authState = .needsPinEntry → affiche l'écran PIN
5. PinEntryView détecte biometric disponible (keychain biométrique intacte)
6. Face ID se déclenche automatiquement via .task {}
7. Si Face ID réussit → clientKey récupéré du keychain biométrique → authentifié
8. Si Face ID échoue/annulé → l'utilisateur saisit son PIN manuellement
```

**Choix de design :** `clearCache()` (et non `clearAll()`) préserve intentionnellement la clé biométrique dans le keychain, permettant Face ID comme chemin de ré-entrée rapide après le verrouillage.

#### Nettoyage par événement

| Événement                              | Méthode                                                 | Effet                                                                           |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Grace period (`backgroundGracePeriod`) | `clearCache()`                                          | Cache mémoire effacé, keychain intacts                                          |
| Client key périmé                      | `clearAll()`                                            | Tout effacé (cache + keychain standard + biométrique)                           |
| Logout                                 | `clearSession()`                                        | Cache + keychain standard effacés, biométrique **préservé** pour prochain login |
| Logout (sans biométrie)                | via `clearSession()` puis `clearAll()` dans logout flow | Tout effacé                                                                     |
| Reset mot de passe                     | `clearAll()` + `biometricEnabled = false`               | Tout effacé, biométrie désactivée                                               |

#### Mémoire non-zéroable du clientKey (risque accepté)

Le `clientKey` est transporté et caché sous forme de `String` (hex). Swift `String` est un value type sur le heap avec ARC/COW : mettre la référence à `nil` ne garantit pas le zeroing des bytes sous-jacents avant que l'allocateur ne récupère la page. Des copies transitoires peuvent aussi exister dans `URLRequest`, closures `@Sendable`, stack/registres, etc.

**Risque pratique : LOW dans le threat model iOS standard (appareil non jailbreaké/non rooté).** Le sandbox iOS (isolation mémoire par processus) empêche les lectures inter-processus dans ce modèle. L'architecture split-key rend le `clientKey` seul inutilisable (il faut aussi la `masterKey` serveur).  
**Limite explicite :** sur appareil compromis (jailbreak/root/instrumentation), cette hypothèse ne tient plus et le risque augmente.

**Mitigations :** `clearCache()`/`clearSession()`/`clearAll()` suppriment rapidement les références. Le buffer `[UInt8]` brut de PBKDF2 est zéroé avant conversion en hex. Le keychain utilise `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. Le header `X-Client-Key` transite en HTTPS/TLS en production; en local, des appels `http://localhost` peuvent exister.

**Date de revue :** 2026-02-24 | **Finding :** C1-1

#### Widget (risque accepté)

Le widget iOS stocke les métriques budgétaires (montant `available`) en **clair** dans `UserDefaults(suiteName: "group.app.pulpe.ios")`. WidgetKit s'exécute dans un processus séparé sans accès au keychain ni à Face ID. Le verrouillage de l'app (grace period) ne s'étend pas au widget. Les données widget sont effacées au logout et au reset de mot de passe.

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

### Retraits pilotés depuis le plan d'objectif

Le wire garde le signe (`-4'500` = sortie), mais la persistance chiffre toujours
la valeur absolue positive via `ENCRYPTION_PORT` avant la RPC. Une période ne
stocke le ciphertext que dans une représentation :

- `savings_goal_plan_withdrawal.amount` pour « objectif uniquement » ;
- `budget_line.amount` sur la Prévision Revenu marquée
  `is_savings_goal_plan_adjustment` pour « créer aussi un revenu ».

`apply_savings_goal_plan_with_destinations` effectue suppression et upsert dans
une transaction sous advisory lock. Aucun montant en clair ni contribution
Épargne négative n'est persisté. La nouvelle colonne booléenne et les IDs de
liaison ne sont pas financiers et restent en clair.

### Backend

| Fichier                                                      | Rôle                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `encryption/infrastructure/crypto/aes-gcm.crypto-service.ts` | Dérivation DEK, chiffrement/déchiffrement AES-GCM, wrap/unwrap DEK, cache, re-chiffrement |
| `encryption-key.repository.ts`                               | CRUD de la table `user_encryption_key` (salt, wrapped_dek)                                |
| `encryption.controller.ts`                                   | Endpoints `/salt`, `/validate-key`, `/setup-recovery`, `/recover`, `/change-pin`          |
| `client-key-cleanup.interceptor.ts`                          | Efface le clientKey de la mémoire après chaque requête                                    |
| `auth.guard.ts`                                              | Extrait et valide le `X-Client-Key` du header                                             |

### Frontend (Angular)

| Fichier                  | Rôle                                                 |
| ------------------------ | ---------------------------------------------------- |
| `crypto.utils.ts`        | Dérivation PBKDF2, `DEMO_CLIENT_KEY`                 |
| `client-key.service.ts`  | Gestion du clientKey en sessionStorage               |
| `recovery-key-dialog.ts` | Modal d'affichage et confirmation de la recovery key |

### iOS (SwiftUI)

| Fichier                                    | Rôle                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `Core/Encryption/ClientKeyManager.swift`   | Actor gérant le cycle de vie du clientKey (cache mémoire + keychain + biométrique)                                           |
| `Core/Encryption/CryptoService.swift`      | Dérivation PBKDF2 du clientKey depuis le PIN                                                                                 |
| `Core/Encryption/EncryptionAPI.swift`      | Appels API encryption (`/salt`, `/validate-key`, `/setup-recovery`, `/recover`)                                              |
| `Core/Auth/BiometricService.swift`         | Face ID / Touch ID (LAContext)                                                                                               |
| `Core/Auth/KeychainManager.swift`          | Stockage keychain standard et biométrique                                                                                    |
| `App/AppState.swift`                       | Machine d'état auth, grace period (`backgroundGracePeriod`, 30s actuellement), transitions `needsPinEntry` ↔ `authenticated` |
| `Features/Auth/Pin/PinEntryView.swift`     | Saisie PIN + auto-trigger Face ID                                                                                            |
| `Features/Auth/Pin/PinSetupView.swift`     | Configuration initiale du PIN                                                                                                |
| `Features/Auth/Pin/PinRecoveryView.swift`  | Récupération via recovery key                                                                                                |
| `Features/Auth/Pin/RecoveryKeySheet.swift` | Affichage unique de la recovery key                                                                                          |
