# PostHog Sourcemaps Upload - Guide de Configuration

Ce document explique comment configurer l'upload automatique des sourcemaps PostHog pour obtenir des stack traces lisibles en production.

## 🔧 Configuration Automatique

L'upload des sourcemaps est **entièrement automatisé** dans le processus de déploiement Vercel. Aucune intervention manuelle n'est nécessaire une fois la configuration initiale effectuée.

## 📋 Prérequis

### 1. Variables d'environnement Vercel

Dans le dashboard Vercel de votre projet, configurez ces variables :

```env
# OBLIGATOIRE: Clé API personnelle PostHog
POSTHOG_PERSONAL_API_KEY=phc_your_personal_api_key_here

# OBLIGATOIRE: ID du projet PostHog (nombre entier)
POSTHOG_CLI_ENV_ID=12345

# OPTIONNEL: URL de l'instance PostHog (défaut: EU)
POSTHOG_HOST=https://eu.i.posthog.com
```

**Important :** Ces variables sont déclarées dans `turbo.json` pour être accessibles au CLI PostHog pendant le build.

### 2. Obtenir la clé API personnelle

1. Connectez-vous à votre dashboard PostHog
2. Allez dans **Settings > Personal API Keys**
3. Créez une nouvelle clé avec les permissions `sourcemap:upload`
4. Copiez la clé (format: `phc_...`)

### 3. Obtenir le Project ID

1. Dans votre dashboard PostHog
2. Allez dans **Settings > Project variables**
3. Trouvez **Project ID** (nombre entier, ex: `12345`)
4. Copiez cette valeur pour `POSTHOG_CLI_ENV_ID`

## ⚙️ Fonctionnement

### Déclenchement automatique

L'upload se déclenche automatiquement lors de chaque déploiement Vercel via le `buildCommand` dans `vercel.json` :

```bash
# Séquence d'exécution:
1. Configuration génération ✅
2. Build Angular avec sourcemaps ✅
3. Upload automatique sourcemaps ✅
4. Déploiement Vercel ✅
```

### Détection d'environnement

Le script détecte automatiquement l'environnement :

- **CI/CD (Vercel)** : Upload obligatoire avec `POSTHOG_PERSONAL_API_KEY`
- **Local** : Upload optionnel (skip si clé manquante)

## 🔍 Vérification

### 1. Logs de build Vercel

Dans les logs de déploiement Vercel, vous devriez voir :

```
🚀 PostHog Source Maps Upload
===============================
Environment: CI/CD
Host: https://eu.i.posthog.com
📊 Found X source map files and Y JS bundles
📝 Step 1: Injecting source map metadata...
✅ Source map metadata injected successfully
✅ ChunkId metadata verified in bundle
☁️ Step 2: Uploading source maps to PostHog...
✅ Source maps uploaded successfully
🎉 PostHog source maps processing completed!
```

### 2. Dashboard PostHog

1. Allez dans **Settings > Error tracking**
2. Vérifiez la présence de nouveaux **Symbol sets**
3. Chaque déploiement crée un nouveau Symbol set (pas d'écrasement)

### 3. Test en production

1. Déclenchez une erreur JavaScript en production
2. Vérifiez dans PostHog que la stack trace est lisible
3. Les noms de fichiers et numéros de ligne doivent être corrects

## 🛠️ Dépannage

### Erreur: "POSTHOG_PERSONAL_API_KEY environment variable is required"

**Cause** : La clé API n'est pas configurée dans Vercel

**Solution** :
1. Vérifiez les variables d'environnement Vercel
2. Assurez-vous que `POSTHOG_PERSONAL_API_KEY` est définie
3. Redéployez le projet

### Erreur: "POSTHOG_CLI_ENV_ID environment variable is required"

**Cause** : L'ID du projet PostHog n'est pas configuré dans Vercel

**Solution** :
1. Récupérez le Project ID depuis PostHog Dashboard > Settings > Project variables
2. Ajoutez `POSTHOG_CLI_ENV_ID` dans les variables d'environnement Vercel
3. Redéployez le projet

### Erreur: "Couldn't load credentials... Have you logged in recently?"

**Cause** : Authentification PostHog CLI échouée (variables manquantes)

**Solution** :
1. Vérifiez que **3 variables** sont configurées dans Vercel :
   - `POSTHOG_PERSONAL_API_KEY`
   - `POSTHOG_CLI_ENV_ID`
   - `POSTHOG_HOST` (optionnel)
2. Vérifiez que l'API key a les bonnes permissions
3. Confirmez que le Project ID correspond à votre projet

### Erreur: "No source map files found"

**Cause** : Les sourcemaps ne sont pas générées

**Solution** :
1. Vérifiez `angular.json` configuration production
2. `sourceMap.scripts` doit être `true`
3. `sourceMap.hidden` doit être `true`

### Stack traces toujours minifiées

**Cause** : Les sourcemaps ne sont pas associées aux erreurs

**Solutions** :
1. Vérifiez que les bundles contiennent `//# chunkId=` après injection
2. Confirmez l'upload dans le dashboard PostHog
3. Attendez quelques minutes pour la propagation

## 📚 Ressources

- **PostHog Error Tracking** : https://posthog.com/docs/error-tracking
- **Symbol Sets Management** : Dashboard PostHog > Settings > Error tracking
- **Script local** : `npm run upload:sourcemaps` (nécessite POSTHOG_PERSONAL_API_KEY)

## 🔐 Sécurité

- ✅ **Sourcemaps cachées** : `hidden: true` - pas exposées publiquement
- ✅ **Upload sécurisé** : API key personnelle requise
- ✅ **Rétention** : Symbol sets conservés 90 jours
- ✅ **Isolation** : Chaque déploiement a ses propres Symbol sets

---

**Note** : Ce système remplace l'ancien script manuel. L'upload est maintenant entièrement automatisé lors des déploiements Vercel.