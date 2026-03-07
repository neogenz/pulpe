# 📚 Documentation Pulpe - Navigation

> **Point d'entrée unique** pour toute la documentation opérationnelle du projet Pulpe

## 🚨 Urgences & Actions Rapides

| Situation | Action | Fichier |
|-----------|--------|---------|
| 🚀 **Déployer en production** | Processus release complet | → [DEPLOYMENT.md](./DEPLOYMENT.md) |
| 🔥 **Problème en production** | Solutions problèmes courants | → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| ⚡ **Setup rapide projet** | Commandes essentielles | → [QUICKSTART.md](./QUICKSTART.md) |

## 📋 Par Type de Tâche

### 🏗️ Opérationnel (Usage quotidien)
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Comment déployer ? Processus de release
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Solutions aux problèmes fréquents
- **[QUICKSTART.md](./QUICKSTART.md)** - Commandes essentielles + setup rapide

### ⚙️ Configuration (Setup & maintenance)
- **[CI.md](./CI.md)** - Architecture CI GitHub Actions (jobs, cache, parallélisation)
- **[FRONTEND_CONFIG.md](./FRONTEND_CONFIG.md)** - Configuration Angular + variables E2E + tests
- **[VERCEL_ROUTING.md](./VERCEL_ROUTING.md)** - Routing Vercel (2 projets : landing Next.js + Angular SPA sur sous-domaines séparés)
- **[MONITORING.md](./MONITORING.md)** - PostHog sourcemaps + error tracking complet
- **[BACKEND_PRACTICES.md](./BACKEND_PRACTICES.md)** - Error handling + guidelines NestJS
- **[VERSIONING.md](./VERSIONING.md)** - Versioning produit unifié (SemVer, tags, releases)
- **[IOS_VERSIONING.md](./IOS_VERSIONING.md)** - Versioning iOS selon standards Apple


### 🔒 Sécurité
- **[ENCRYPTION.md](./ENCRYPTION.md)** - Chiffrement AES-256-GCM des montants financiers (split-key, stockage clientKey web + iOS)
- **[SCENARIOS.md](./SCENARIOS.md)** - Scénarios métier Web App + iOS (auth, biométrie, grace period, widget)

## 🎯 Par Problème Spécifique

### Infrastructure & Déploiement
- **Railway ne démarre pas** → [TROUBLESHOOTING.md#railway](./TROUBLESHOOTING.md#railway)
- **Vercel build fail** → [TROUBLESHOOTING.md#vercel](./TROUBLESHOOTING.md#vercel)
- **Vercel routing (2 projets, sous-domaines)** → [VERCEL_ROUTING.md](./VERCEL_ROUTING.md)
- **Supabase migration** → [DEPLOYMENT.md#supabase](./DEPLOYMENT.md#supabase)

### Configuration Frontend
- **Variables E2E tests** → [FRONTEND_CONFIG.md#e2e-env](./FRONTEND_CONFIG.md#e2e-env)
- **Config Angular dynamique** → [FRONTEND_CONFIG.md#config-generation](./FRONTEND_CONFIG.md#config-generation)
- **Tests Playwright setup** → [FRONTEND_CONFIG.md#e2e-env](./FRONTEND_CONFIG.md#e2e-env)

### Monitoring & Erreurs
- **PostHog sourcemaps** → [MONITORING.md#sourcemaps](./MONITORING.md#sourcemaps)
- **Error tracking setup** → [MONITORING.md#error-tracking](./MONITORING.md#error-tracking)
- **Stack traces illisibles** → [MONITORING.md#troubleshooting](./MONITORING.md#troubleshooting)

### Backend & API
- **Error handling patterns** → [BACKEND_PRACTICES.md#error-patterns](./BACKEND_PRACTICES.md#error-patterns)
- **Logging structured** → [BACKEND_PRACTICES.md#logging](./BACKEND_PRACTICES.md#logging)
- **Auth & security** → [BACKEND_PRACTICES.md#auth](./BACKEND_PRACTICES.md#auth)

## 🔗 Liens Externes Utiles

- **[Memory Bank (AI Context)](../memory-bank/)** - Documentation pour contexte AI/AIDD
- **[CLAUDE.md (Projet)](../CLAUDE.md)** - Instructions générales projet
- **[Frontend CLAUDE.md](../frontend/CLAUDE.md)** - Instructions spécifiques frontend
- **[Backend CLAUDE.md](../backend-nest/CLAUDE.md)** - Instructions spécifiques backend
- **[iOS CLAUDE.md](../ios/CLAUDE.md)** - Instructions spécifiques iOS

---

## 📝 Convention de Navigation

Chaque fichier suit la structure :
```
🚀 TLDR - Actions Rapides
📋 Étapes Détaillées
🔧 Troubleshooting
📚 Références/Détails
```

**Règle d'or** : En 30 secondes, vous devez pouvoir trouver comment faire ce que vous cherchez.