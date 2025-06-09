# API d'Authentification - Backend Hono + Supabase

Cette API fournit un système d'authentification complet utilisant Hono et Supabase avec gestion des cookies sécurisés.

## 🔐 Endpoints d'Authentification

### POST `/api/auth/signup`

Créer un nouveau compte utilisateur.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "motdepasse123",
  "firstName": "Jean",
  "lastName": "Dupont"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Compte créé avec succès",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jean",
    "lastName": "Dupont"
  }
}
```

**Erreurs possibles:**

- `400`: Champs manquants ou invalides
- `409`: Email déjà utilisé
- `500`: Erreur serveur

---

### POST `/api/auth/signin`

Se connecter avec email/mot de passe.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "motdepasse123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Connexion réussie",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jean",
    "lastName": "Dupont"
  },
  "session": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresAt": 1234567890
  }
}
```

**Cookies définies:**

- `sb-access-token`: Token d'accès (HttpOnly, 7 jours)
- `sb-refresh-token`: Token de rafraîchissement (HttpOnly, 30 jours)

**Erreurs possibles:**

- `400`: Email/mot de passe manquant ou format invalide
- `401`: Identifiants incorrects
- `404`: Profil utilisateur introuvable
- `500`: Erreur serveur

---

### POST `/api/auth/signout`

Se déconnecter (supprime les cookies).

**Response (200):**

```json
{
  "success": true,
  "message": "Déconnexion réussie"
}
```

## 👤 Endpoints Utilisateur

### GET `/api/user/me` 🔒

Récupérer les informations de l'utilisateur connecté.

**Headers requis:**

```
Authorization: Bearer <access_token>
```

_Ou cookie `sb-access-token` automatiquement envoyé_

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jean",
    "lastName": "Dupont"
  }
}
```

---

### PUT `/api/user/profile` 🔒

Mettre à jour le profil utilisateur.

**Request Body:**

```json
{
  "firstName": "Jean-Pierre",
  "lastName": "Martin"
}
```

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jean-Pierre",
    "lastName": "Martin"
  }
}
```

---

### GET `/api/user/public-info`

Endpoint public qui s'adapte selon l'authentification.

**Response (utilisateur connecté):**

```json
{
  "success": true,
  "message": "Bonjour Jean !",
  "authenticated": true
}
```

**Response (utilisateur non connecté):**

```json
{
  "success": true,
  "message": "Bonjour visiteur !",
  "authenticated": false
}
```

## 🛡️ Middlewares

### `authMiddleware`

- Vérifie la présence et validité du token d'accès
- Récupère les informations utilisateur depuis Supabase
- Ajoute `user` et `supabase` au contexte Hono
- Retourne 401 si non authentifié

### `optionalAuthMiddleware`

- Fonctionne comme `authMiddleware` mais n'échoue pas si non authentifié
- Utilisé pour les endpoints qui fonctionnent avec ou sans authentification

## 🔧 Configuration

### Variables d'environnement requises

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=development|production
```

### Table Supabase `profiles`

```sql
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 🚀 Avantages de cette implémentation

### ✅ Sécurité

- **Cookies HttpOnly**: Protection contre XSS
- **Tokens Supabase natifs**: Pas de JWT custom à maintenir
- **Validation stricte**: Email, mot de passe, noms
- **Gestion d'erreurs**: Messages explicites

### ✅ Developer Experience

- **Types TypeScript stricts**: Interfaces explicites
- **Middleware réutilisable**: Protection facile des routes
- **Gestion automatique**: Supabase gère le refresh des tokens
- **CORS configuré**: Support frontend local

### ✅ Évolutivité

- **Architecture modulaire**: Routes séparées par domaine
- **Middleware flexible**: Authentification obligatoire ou optionnelle
- **Intégration Supabase**: RLS, permissions, etc.
- **Pas de logique refresh**: Supabase gère automatiquement

## 📝 Exemples d'utilisation côté client

### JavaScript/TypeScript

```javascript
// Signup
const signup = async (userData) => {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });
  return response.json();
};

// Signin
const signin = async (credentials) => {
  const response = await fetch("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Important pour les cookies
    body: JSON.stringify(credentials),
  });
  return response.json();
};

// Protected request
const getProfile = async () => {
  const response = await fetch("/api/user/me", {
    credentials: "include", // Envoie automatiquement les cookies
  });
  return response.json();
};
```

### Angular (avec HttpClient)

```typescript
// Configuration pour inclure les cookies
this.http
  .post("/api/auth/signin", credentials, {
    withCredentials: true,
  })
  .subscribe((response) => {
    // Connexion réussie
  });
```

Cette implémentation vous donne une base solide pour l'authentification dans votre application, en suivant les meilleures pratiques de sécurité et en s'intégrant parfaitement avec l'écosystème Supabase ! 🎉
