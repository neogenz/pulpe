# Pulpe Budget - Backend API

Backend API pour l'application de gestion de budget personnel, construite avec Hono et Supabase.

## 🚀 Démarrage rapide

```bash
# Installation des dépendances
bun install

# Démarrage en mode développement
bun run dev

# Génération des types TypeScript depuis Supabase
bun run types:generate
```

## 🏗️ Architecture

### Structure des dossiers

```
src/
├── domains/          # Domaines métier (auth, user, budget)
├── models/           # Types et modèles
│   └── types/        # Types générés par Supabase
├── supabase/         # Configuration et clients Supabase
└── index.ts          # Point d'entrée principal
```

### Technologies utilisées

- **[Hono](https://hono.dev/)** - Framework web rapide et léger
- **[Supabase](https://supabase.com/)** - Backend-as-a-Service (PostgreSQL, Auth, API)
- **[Bun](https://bun.sh/)** - Runtime JavaScript ultra-rapide
- **TypeScript** - Typage statique strict

## 🔐 Authentification

### Configuration Supabase

Variables d'environnement requises :

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... # Clé publique
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Clé privée admin
```

### Endpoints d'authentification

- `POST /api/auth/signup` - Inscription utilisateur
- `POST /api/auth/signin` - Connexion utilisateur
- `POST /api/auth/signout` - Déconnexion utilisateur

### Middleware d'authentification

Deux middlewares disponibles :

- `authMiddleware` - Authentification obligatoire
- `optionalAuthMiddleware` - Authentification optionnelle

## 📊 API Budget

### Endpoints disponibles

- `GET /api/budget` - Lister tous les budgets de l'utilisateur
- `POST /api/budget` - Créer un nouveau budget
- `GET /api/budget/:id` - Récupérer un budget spécifique

### Modèle de données

```typescript
interface Budget {
  id: string;
  month: number;
  year: number;
  description: string;
  created_at: string;
  updated_at: string;
}
```

## 👤 API Utilisateur

### Endpoints disponibles

- `GET /api/user/me` - Profil de l'utilisateur connecté
- `PUT /api/user/profile` - Mise à jour du profil
- `GET /api/user/public-info` - Informations publiques

## 🛠️ Types et modèles

### Types générés automatiquement

Les types TypeScript sont générés automatiquement depuis la base Supabase :

```bash
bun run types:generate
```

### Utilisation des types

```typescript
import type { Budget, BudgetInsert, Transaction } from "../supabase/client";

// Types disponibles :
// - Budget, BudgetInsert, BudgetUpdate
// - Transaction, TransactionInsert, TransactionUpdate
// - ExpenseType, TransactionType
```

## 🔧 Configuration avancée

### TypeScript

Configuration TypeScript stricte avec :

- Types stricts activés
- Vérifications exhaustives
- Imports de types sécurisés

### CORS

Configuration CORS pour le frontend Angular :

```typescript
origin: ["http://localhost:4200"];
credentials: true;
```

### Logging

Middleware de logging Hono activé pour le débogage.

## 🧪 Tests et validation

### Endpoints de santé

- `GET /` - Status de l'API
- `GET /health` - Santé du service

### Test rapide

```bash
# Tester l'API
curl http://localhost:3000/health

# Réponse attendue
{"status":"healthy"}
```

## 📝 Bonnes pratiques appliquées

### Sécurité

- ✅ Tokens JWT validés
- ✅ Cookies sécurisés (httpOnly, secure)
- ✅ CORS configuré strictement
- ✅ Row Level Security (RLS) avec Supabase

### Code

- ✅ Types TypeScript stricts
- ✅ Architecture par domaines
- ✅ Middleware d'authentification centralisé
- ✅ Gestion d'erreurs cohérente
- ✅ Validation des entrées

### Base de données

- ✅ Types générés automatiquement
- ✅ Client Supabase centralisé
- ✅ Migrations via Supabase Dashboard
- ✅ Utilisation des `user_metadata` pour les profils

## 🚀 Déploiement

Pour déployer en production :

1. Configurer les variables d'environnement
2. Builder l'application : `bun run build`
3. Démarrer : `bun start`

## 📖 Documentation API complète

Voir le fichier `API.md` pour la documentation détaillée des endpoints.
