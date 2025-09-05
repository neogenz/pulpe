# Guide de Déploiement - Pulpe

## Prérequis

- Compte Supabase
- Compte Railway (backend)
- Compte Vercel (frontend)
- CLI installées : `supabase`, `railway`, `vercel`

## 1. Base de données (Supabase)

### Créer le projet

1. Sur https://supabase.com/dashboard
2. **New Project** → `pulpe-production` → Region: `eu-central-1`
3. Récupérer les credentials dans **Settings > API** :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Migrer la base

```bash
cd backend-nest
supabase link --project-ref [PROJECT_REF]
supabase db push
```

## 2. Backend (Railway)

### Variables d'environnement

Dans Railway, créer un service avec ces variables :

```env
NODE_ENV=production
RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile
CORS_ORIGIN=https://[FRONTEND_DOMAIN]
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
```

### Déployer

```bash
railway link
railway up
railway domain  # Récupérer l'URL publique
```

## 3. Frontend (Vercel)

### Configuration des variables d'environnement

Le frontend utilise maintenant un système de configuration dynamique basé sur les variables d'environnement. Plus besoin de modifier manuellement les fichiers de configuration !

#### Variables d'environnement à configurer dans Vercel

1. **Dans Vercel Dashboard** → Project Settings → Environment Variables
2. **Configurer ces variables pour Production** :

   | Variable | Valeur | Description |
   |----------|---------|-------------|
   | `PUBLIC_SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` | URL de votre projet Supabase |
   | `PUBLIC_SUPABASE_ANON_KEY` | `[ANON_KEY]` | Clé anonyme Supabase |
   | `PUBLIC_BACKEND_API_URL` | `https://[RAILWAY_URL]/api/v1` | URL de votre backend Railway |
   | `PUBLIC_ENVIRONMENT` | `production` | Environnement actuel |

#### Comment ça fonctionne

Le build Vercel exécute automatiquement le script `frontend/scripts/generate-config.js` qui :
- Lit les variables d'environnement `PUBLIC_*`
- Génère dynamiquement le fichier `config.json`
- Utilise des valeurs par défaut si aucune variable n'est définie

### Déployer

```bash
vercel --prod
```

## 4. Branches de preview (Vercel)

### Configuration pour les branches de preview

Pour tester avec un backend de preview différent, configurez uniquement les variables qui diffèrent de la production :

**Example pour une branch preview** :
- **Name** : `PUBLIC_BACKEND_API_URL`
- **Value** : `https://backend-preview-xyz.railway.app/api/v1`
- **Environment** : Preview

Les autres variables (Supabase) héritent automatiquement des valeurs de production.

## 5. Développement local

### Configuration locale avec .env.local

Pour personnaliser la configuration en local sans modifier le code :

1. **Créer un fichier `.env.local`** dans `frontend/` :
   ```env
   # Configuration locale (optionnel)
   PUBLIC_SUPABASE_URL=http://localhost:54321
   PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   PUBLIC_BACKEND_API_URL=http://localhost:3000/api/v1
   PUBLIC_ENVIRONMENT=local
   ```

2. **Le fichier `.env.local`** est ignoré par Git (pas de risque de commit accidentel)

3. **Générer la configuration** :
   ```bash
   cd frontend
   node scripts/generate-config.js
   ```

**Note** : Si aucun `.env.local` n'existe, le script utilise les valeurs par défaut pour le développement local.

## Checklist

- [ ] Supabase : projet créé + DB migrée
- [ ] Railway : backend déployé + URL récupérée  
- [ ] Vercel : variables d'environnement `PUBLIC_*` configurées
- [ ] Frontend : déployé et fonctionnel

## Troubleshooting

### Backend
**Backend build fail** : Vérifier `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile`

**CORS errors** : Mettre à jour `CORS_ORIGIN` avec la vraie URL Vercel

**DB connection fail** : Vérifier les credentials Supabase dans Railway

### Frontend
**Config.json non généré** : 
- Vérifier que le script `frontend/scripts/generate-config.js` s'exécute bien dans les logs Vercel
- S'assurer que les variables `PUBLIC_*` sont définies dans Vercel

**App utilise mauvaise configuration** :
- Vérifier dans les logs Vercel que les bonnes variables sont utilisées
- Dans le navigateur, aller sur `/config.json` pour voir la config générée

**Variables d'environnement non reconnues** :
- Vérifier que les variables commencent bien par `PUBLIC_`
- S'assurer qu'elles sont définies pour le bon environnement (Production/Preview/Development)
