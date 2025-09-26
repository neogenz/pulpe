# WIP: Architecture CI/CD avec Supabase Branching (2025)

## 🎯 Objectif

Mettre en place un workflow de développement moderne avec des environnements de preview isolés pour chaque PR, en utilisant les branches Supabase Pro et les intégrations natives.

## 📊 Architecture Actuelle vs Cible

### Actuelle (Plan Free)
```
Local Dev → Main → Production
    ↓         ↓
Supabase   Supabase
 Local      Prod
```

### Cible (Plan Pro avec Branches)
```
Local Dev → Feature Branch/PR → Preview Environment → Main → Production
    ↓              ↓                    ↓                ↓
Supabase    Supabase Preview      Auto-synced       Production
 Local       (Auto-created)        Deployments
```

## 🚀 Composants du Système

### Stack & Intégrations
- **Frontend**: Vercel avec intégration Supabase native
- **Backend**: Railway avec preview environments
- **Database**: Supabase Branching (Plan Pro requis)
- **Orchestration**: Intégration GitHub de Supabase + GitHub Actions minimal

## 📋 Plan de Migration

### Phase 1: Configuration Supabase
- [ ] Passer au plan Pro Supabase ($25/mois minimum)
- [ ] Activer l'intégration GitHub dans le dashboard Supabase
- [ ] Activer "Automatic branching" pour créer des branches sur chaque PR
- [ ] Configurer le check "Supabase Preview" comme required dans GitHub

### Phase 2: Configuration des Intégrations

#### Intégration Supabase ↔ GitHub (Automatique)
1. Dans le dashboard Supabase : Settings → Integrations → GitHub
2. Connecter le repository
3. Activer "Automatic branching"
4. Les preview branches seront créées automatiquement à l'ouverture de PR
5. Les migrations dans `./supabase/migrations` seront appliquées automatiquement
6. Le seeding depuis `seed.sql` sera exécuté si présent

#### Intégration Supabase ↔ Vercel
1. Dans le dashboard Vercel : Integrations → Browse Marketplace → Supabase
2. Connecter le projet Supabase
3. Les variables d'environnement seront synchronisées automatiquement pour chaque preview
4. Vercel redéploiera automatiquement si besoin

### Phase 3: Workflows GitHub Actions Minimaux

#### Workflow Backend Preview: `.github/workflows/preview-backend.yml`
```yaml
name: Preview - Backend on Railway

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read

    steps:
      - uses: actions/checkout@v4

      # Attendre que Supabase ait créé la Preview Branch
      - name: Wait for Supabase Preview
        uses: fountainhead/action-wait-for-check@v1.2.0
        id: wait
        with:
          checkName: Supabase Preview
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Supabase CLI
        if: ${{ steps.wait.outputs.conclusion == 'success' }}
        uses: supabase/setup-cli@v1
        with:
          version: latest

      # Récupérer les variables de la branche
      - name: Export Supabase Branch ENV
        if: ${{ steps.wait.outputs.conclusion == 'success' }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
        run: |
          supabase --experimental branches get "$GITHUB_HEAD_REF" -o env >> $GITHUB_ENV

      # Déployer sur Railway avec les variables
      - name: Railway Preview Deploy
        if: ${{ steps.wait.outputs.conclusion == 'success' }}
        uses: ayungavis/railway-preview-deploy@v1.0.2
        with:
          railway_api_token: ${{ secrets.RAILWAY_TOKEN }}
          project_id: ${{ secrets.RAILWAY_PROJECT_ID }}
          environment_name: 'staging'
          preview_environment_name: 'pr-${{ github.event.pull_request.number }}'
          branch_name: ${{ github.head_ref }}
          cleanup: 'false'
          environment_variables: >
            {
              "SUPABASE_URL": "${{ env.SUPABASE_URL }}",
              "SUPABASE_ANON_KEY": "${{ env.SUPABASE_ANON_KEY }}",
              "SUPABASE_SERVICE_ROLE_KEY": "${{ env.SUPABASE_SERVICE_ROLE_KEY }}",
              "POSTGRES_URL_NON_POOLING": "${{ env.POSTGRES_URL_NON_POOLING }}"
            }
```

#### Workflow Cleanup: `.github/workflows/cleanup-preview.yml`
```yaml
name: Cleanup Preview

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Railway cleanup seulement (Supabase supprime automatiquement)
      - name: Cleanup Railway Preview
        uses: ayungavis/railway-preview-deploy@v1.0.2
        with:
          railway_api_token: ${{ secrets.RAILWAY_TOKEN }}
          project_id: ${{ secrets.RAILWAY_PROJECT_ID }}
          environment_name: 'staging'
          preview_environment_name: 'pr-${{ github.event.pull_request.number }}'
          branch_name: ${{ github.head_ref }}
          cleanup: 'true'
```

### Phase 4: Scripts Locaux

Ajouter dans `backend-nest/package.json`:
```json
{
  "scripts": {
    "branch:create": "supabase db branch create $(git branch --show-current)",
    "branch:switch": "supabase db branch switch $(git branch --show-current)",
    "branch:delete": "supabase db branch delete $(git branch --show-current)",
    "branch:list": "supabase db branch list",
    "branch:push": "supabase db push",
    "branch:reset": "supabase db reset"
  }
}
```

> Note: Ces commandes sont principalement pour le développement local ou les branches persistantes. Pour les PR, l'intégration GitHub gère automatiquement la création/suppression.

## 🔄 Workflow de Développement

### 1. Créer une feature branch et ouvrir une PR
```bash
git checkout -b feature/nouvelle-fonctionnalite
git push origin feature/nouvelle-fonctionnalite
# Ouvrir une PR sur GitHub
```

### 2. Automatisation lors de l'ouverture de PR

1. **Supabase** (via intégration GitHub):
   - Crée automatiquement une preview branch
   - Applique les migrations depuis `./supabase/migrations`
   - Exécute le seeding depuis `seed.sql`
   - Ajoute le check "Supabase Preview" sur la PR

2. **Vercel** (via intégration Supabase):
   - Reçoit automatiquement les variables d'environnement de la preview branch
   - Déploie le frontend avec ces variables
   - URL: `https://pulpe-[branch-name].vercel.app`

3. **Railway** (via GitHub Actions):
   - Attend le check "Supabase Preview"
   - Récupère les variables via `supabase --experimental branches get`
   - Déploie le backend avec les bonnes variables
   - URL: `https://pulpe-pr-123.up.railway.app`

### 3. URLs de Preview

- **Frontend**: `https://pulpe-[branch-name].vercel.app`
- **Backend**: `https://pulpe-pr-123.up.railway.app`
- **Database**: Branch Supabase isolée (URL dans les logs)

### 4. Après merge de la PR

Automatiquement:
1. Supabase supprime la preview branch
2. Vercel supprime le preview deployment
3. Railway supprime le preview environment (via workflow cleanup)
4. Production est déployée via le workflow existant

## 📝 Variables & Secrets GitHub

### Secrets requis
- `SUPABASE_ACCESS_TOKEN` (existant)
- `SUPABASE_PROJECT_ID` (remplace PRODUCTION_PROJECT_ID)
- `RAILWAY_TOKEN` (nouveau - depuis dashboard Railway)
- `RAILWAY_PROJECT_ID` (nouveau - depuis dashboard Railway)

> Note: Pas besoin de `VERCEL_TOKEN` car l'intégration Supabase ↔ Vercel gère automatiquement les variables.

## ⚙️ Configuration des Plateformes

### Supabase (Dashboard)
1. **Upgrade vers Pro** : $25/mois minimum
2. **Settings → Integrations → GitHub** : Connecter le repo
3. **Enable Automatic branching** : Création automatique de branches sur PR
4. **Settings → Database → Enable branching** : Activer les branches

### Vercel (Dashboard)
1. **Integrations → Browse Marketplace → Supabase** : Installer l'intégration
2. **Connecter le projet Supabase** : Sélectionner le projet
3. Les variables seront synchronisées automatiquement pour chaque preview

### Railway (Dashboard)
1. **Create project** ou utiliser existant
2. **Settings → Tokens** : Créer un token API
3. **Settings → General** : Récupérer le Project ID

### GitHub (Repository Settings)
1. **Settings → Secrets → Actions** : Ajouter les secrets
2. **Settings → Branches → Protection rules** :
   - Ajouter "Supabase Preview" comme required check
   - Bloquer le merge tant que le check n'est pas passé

## 🎯 Bénéfices

1. **Intégrations natives** : Moins de code custom, plus de fiabilité
2. **Isolation complète** : DB, Auth, Storage isolés par PR
3. **Synchronisation automatique** : Pas de race conditions
4. **Workflow simplifié** : Les intégrations gèrent la complexité
5. **Nettoyage automatique** : Branches supprimées avec la PR

## ⚠️ Points d'attention

### Coûts
- **Plan Pro Supabase** : $25/mois minimum
- **Branches** : Facturées à l'usage (compute/egress/disk)
- **Pas de TTL fixe** : Les preview branches suivent la vie de la PR

### Sécurité
- **Frontend** : Uniquement `anon` key (publique)
- **Backend** : `service_role` key (privée)
- Chaque branche a ses propres clés

### Développement
- Migrations dans `./supabase/migrations`
- Seeding optionnel dans `seed.sql`
- Tester en local avant de pousser
- Convention de nommage alignée sur les branches Git

## 📚 Ressources Clés

- [Supabase Branching](https://supabase.com/docs/guides/deployment/branching)
- [GitHub Integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches)
- [Vercel Integration](https://supabase.com/docs/guides/deployment/branching/integrations)
- [Railway Preview Deploy Action](https://github.com/marketplace/actions/railway-preview-deploy-action)
- [Branching Usage & Billing](https://supabase.com/docs/guides/platform/manage-your-usage/branching)

## 🚧 Checklist de Migration

### Configuration Initiale
- [ ] Upgrade Supabase vers plan Pro
- [ ] Activer l'intégration GitHub dans Supabase
- [ ] Activer "Automatic branching"
- [ ] Installer l'intégration Supabase dans Vercel
- [ ] Créer token API Railway

### GitHub Setup
- [ ] Ajouter les secrets GitHub Actions
- [ ] Créer le workflow `preview-backend.yml`
- [ ] Créer le workflow `cleanup-preview.yml`
- [ ] Configurer "Supabase Preview" comme required check

### Tests
- [ ] Créer une PR de test
- [ ] Vérifier la création automatique de la preview branch
- [ ] Vérifier les deployments Vercel et Railway
- [ ] Tester le cleanup après merge

### Documentation
- [ ] Mettre à jour le README principal
- [ ] Former l'équipe sur le nouveau workflow
- [ ] Documenter les troubleshooting courants

---

*Document de travail - Version alignée avec Supabase 2025 et les meilleures pratiques actuelles*