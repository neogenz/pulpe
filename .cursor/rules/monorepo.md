---
description: Règles générales pour le monorepo pulpe-workspace
---

## Structure du Monorepo

### Organisation

```
pulpe-workspace/
├── frontend/    # Angular 20 - Application web
├── backend/     # Node.js/Hono - API REST
├── mobile/      # Flutter - Application mobile
└── .vscode/     # Configuration Cursor/VSCode centralisée
```

### Workflow de développement

- Un seul repo Git pour tous les projets
- Configuration ESLint centralisée dans `frontend/` avec working directories
- Utiliser le bon gestionnaire de paquets par projet (pnpm pour frontend)

### Communication entre projets

- Les APIs doivent être documentées et typées
- Partager les types TypeScript entre frontend et backend si possible
- Éviter les dépendances directes entre projets

### Conventions de commit

- Préfixer par le projet : `frontend:`, `backend:`, `mobile:`
- Exemple : `frontend: add new layout component`

### ESLint et Linting

- Configuration flat config ESLint dans `frontend/eslint.config.js`
- Working directories configurés dans `.vscode/settings.json`
- Chaque projet peut avoir ses propres rules spécifiques
