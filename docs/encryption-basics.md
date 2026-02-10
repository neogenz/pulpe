# Chiffrement Pulpe — Vue d'ensemble

> Guide pédagogique du système de chiffrement. Pour les détails d'implémentation, voir [ENCRYPTION.md](./ENCRYPTION.md).

---

## Mot de passe vs Code coffre-fort

Pulpe utilise **deux secrets distincts** :

| Secret | Rôle | Géré par | Stockage |
|--------|------|----------|----------|
| **Mot de passe** | Authentification (login) | Supabase Auth | Hashé (bcrypt) dans `auth.users` |
| **Code coffre-fort** | Chiffrement des données | Pulpe | Jamais stocké — dérivé en `clientKey` côté frontend |

**Pourquoi ?** Le backend ne voit jamais le mot de passe — Supabase renvoie un JWT. Le code coffre-fort est un secret séparé, dérivé côté frontend via PBKDF2, envoyé via header `X-Client-Key`.

---

## Glossaire

| Terme | Définition |
|-------|------------|
| **Salt** | Valeur aléatoire unique par user (16 bytes), stockée en DB |
| **clientKey** | Clé dérivée du code coffre-fort via PBKDF2 (256 bits) |
| **masterKey** | Secret serveur (variable d'env), jamais exposé |
| **DEK** | Data Encryption Key — combine clientKey + masterKey via HKDF |
| **PBKDF2** | Password-Based Key Derivation Function — 600k itérations pour ralentir le brute-force |
| **HKDF** | HMAC-based KDF — dérive la DEK depuis clientKey + masterKey + salt |
| **AES-256-GCM** | Algorithme de chiffrement authentifié (confidentialité + intégrité) |
| **IV** | Initialization Vector — 12 bytes aléatoires par opération |
| **key_check** | Canary chiffré pour valider le code coffre-fort sans exposer les données |
| **wrappedDEK** | DEK chiffrée avec la recovery key |

---

## Où est stocké quoi ?

| Donnée | Emplacement | Persistance |
|--------|-------------|-------------|
| Mot de passe (hashé) | Supabase `auth.users` | Permanent |
| Salt | DB `user_encryption_key.salt` | Permanent, jamais modifié |
| kdf_iterations | DB `user_encryption_key.kdf_iterations` | Permanent (600 000) |
| key_check | DB `user_encryption_key.key_check` | Mis à jour si DEK change |
| wrappedDEK | DB `user_encryption_key.wrapped_dek` | Mis à jour si recovery key régénérée |
| clientKey | Frontend `sessionStorage` | Volatile (effacé au logout/fermeture onglet) |
| masterKey | Variable d'env serveur | Permanent |
| DEK | Cache mémoire backend (5 min TTL) | Volatile, recalculée à chaque requête si absente |
| Recovery key | Chez l'utilisateur uniquement | Jamais stockée côté serveur |

---

## Dérivation des clés

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                │
│                                                                         │
│   code coffre-fort ──► PBKDF2(code, salt, 600k) ──► clientKey (256 bits)│
│                                                                         │
│   Envoi via header: X-Client-Key: {clientKey en hex}                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ BACKEND                                                                 │
│                                                                         │
│   DEK = HKDF-SHA256(                                                    │
│     ikm: clientKey || masterKey,    // 64 bytes                         │
│     salt: salt_from_db,             // 16 bytes                         │
│     info: "pulpe-dek-{userId}"                                          │
│   ) → 256 bits                                                          │
│                                                                         │
│   La DEK chiffre/déchiffre les montants avec AES-256-GCM                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Split-key** : il faut clientKey (user) + masterKey (serveur) pour dériver la DEK. Vol de l'un sans l'autre = inutile.

---

## Chiffrement d'un montant

```
Entrée: 150 (CHF)

1. iv = randomBytes(12)
2. cipher = AES-256-GCM(DEK, iv)
3. encrypted = cipher.update("150") + cipher.final()
4. authTag = cipher.getAuthTag()  // 16 bytes

Stockage DB:
  amount = 0                              // masqué
  amount_encrypted = base64(iv || authTag || encrypted)
```

---

## Workflows

### Inscription

1. User crée compte (email + mot de passe) → géré par Supabase Auth
2. User saisit son code coffre-fort
3. Frontend: `GET /v1/encryption/salt` → backend génère et stocke le salt
4. Frontend: `clientKey = PBKDF2(code, salt, 600k)`
5. Requêtes avec header `X-Client-Key`
6. Backend: dérive DEK, chiffre les montants

### Reconnexion

1. Login Supabase Auth → JWT
2. Frontend: `GET /v1/encryption/salt` → récupère salt existant
3. Frontend: dérive clientKey
4. Frontend: `POST /v1/encryption/validate-key` → backend valide via key_check
5. Si OK → accès autorisé

### Recovery (code oublié)

1. User saisit recovery key + nouveau code coffre-fort
2. Frontend: `GET /v1/encryption/salt` → récupère salt existant
3. Frontend: `newClientKey = PBKDF2(nouveauCode, salt, 600k)`
4. Backend:
   - Déchiffre wrappedDEK avec recovery key → oldDEK
   - Dérive newDEK avec newClientKey
   - Re-chiffre toutes les données
   - Met à jour key_check et wrappedDEK

---

## Sécurité en cas de fuite

| Scénario | Impact |
|----------|--------|
| Fuite DB seule | Montants illisibles (chiffrés) |
| Fuite masterKey seule | Inutile sans clientKey |
| Fuite clientKey seule | Inutile sans masterKey |
| Fuite masterKey + clientKey | Données de l'utilisateur concerné déchiffrables |
