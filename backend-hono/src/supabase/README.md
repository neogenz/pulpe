# Guide des Clients Supabase

## 🎯 Clients disponibles

### 1. `createSupabaseClient(authToken?: string)`

**Usage** : Requêtes authentifiées avec un token utilisateur

```typescript
import { createSupabaseClient } from "./client";

// Avec token d'authentification
const supabase = createSupabaseClient(userToken);
const { data: budgets } = await supabase.from("budgets").select("*");

// Sans token (requêtes publiques)
const supabase = createSupabaseClient();
```

**Cas d'usage** :

- ✅ Middleware d'authentification
- ✅ Requêtes pour un utilisateur spécifique
- ✅ Opérations avec RLS (Row Level Security)

### 2. `supabaseAdmin`

**Usage** : Opérations privilégiées côté serveur

```typescript
import { supabaseAdmin } from "./client";

// Créer un utilisateur
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: "user@example.com",
  password: "password",
});

// Requêtes admin (bypass RLS)
const { data: allUsers } = await supabaseAdmin.from("budgets").select("*");
```

**Cas d'usage** :

- ✅ Création/suppression d'utilisateurs
- ✅ Opérations admin (bypass RLS)
- ✅ Migrations de données
- ❌ **JAMAIS** côté client

### 3. `supabaseAnon`

**Usage** : Requêtes publiques sans authentification

```typescript
import { supabaseAnon } from "./client";

// Données publiques uniquement
const { data: publicData } = await supabaseAnon
  .from("public_table")
  .select("*");
```

**Cas d'usage** :

- ✅ Données publiques
- ✅ Endpoints sans authentification
- ✅ Pages de landing

## 🔒 Sécurité

### Variables d'environnement requises

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... # Clé publique
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Clé privée admin
```

### ⚠️ Règles de sécurité

1. **Service Role Key** = **JAMAIS** côté client
2. **Admin client** = **UNIQUEMENT** côté serveur
3. **Tokens utilisateur** = **TOUJOURS** valider

## 📋 Exemples d'usage

### Middleware d'authentification

```typescript
import { createSupabaseClient } from "../supabase/client";

const supabase = createSupabaseClient(userToken);
const {
  data: { user },
} = await supabase.auth.getUser();
```

### Route d'inscription

```typescript
import { supabaseAdmin } from "../supabase/client";

const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  user_metadata: { firstName, lastName },
});
```

### Route utilisateur authentifiée

```typescript
// Le client est déjà configuré dans le middleware
const supabase = c.get("supabase");
const { data } = await supabase.from("budgets").select("*");
```

## 🚫 Anti-patterns à éviter

❌ **Créer plusieurs clients dans différents fichiers**

```typescript
// Ne pas faire ça !
const supabase = createClient(url, key, options);
```

❌ **Utiliser le service role côté client**

```typescript
// DANGER - Exposition de la clé admin !
const client = createClient(url, serviceRoleKey);
```

❌ **Dupliquer la configuration**

```typescript
// Ne pas répéter la config !
const customClient = createClient(url, key, {
  auth: { autoRefreshToken: false },
});
```

## ✅ Bonnes pratiques

✅ **Utiliser les clients centralisés**
✅ **Un seul fichier de configuration**
✅ **Types TypeScript pour la sécurité**
✅ **Documentation des cas d'usage**
