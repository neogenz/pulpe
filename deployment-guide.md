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

### Configuration production

Mettre à jour `frontend/projects/webapp/public/environments/production/config.json` :

```json
{
  "supabase": {
    "url": "https://[PROJECT_REF].supabase.co",
    "anonKey": "[ANON_KEY]"
  },
  "backend": {
    "apiUrl": "https://[RAILWAY_URL]/api/v1"
  },
  "environment": "production"
}
```

### Déployer

```bash
vercel --prod
```

## Checklist

- [ ] Supabase : projet créé + DB migrée
- [ ] Railway : backend déployé + URL récupérée
- [ ] Vercel : config production mise à jour
- [ ] Frontend : déployé et fonctionnel

## Troubleshooting

**Backend build fail** : Vérifier `RAILWAY_DOCKERFILE_PATH=backend-nest/Dockerfile`

**CORS errors** : Mettre à jour `CORS_ORIGIN` avec la vraie URL Vercel

**DB connection fail** : Vérifier les credentials Supabase dans Railway
