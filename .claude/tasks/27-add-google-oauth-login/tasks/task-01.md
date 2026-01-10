# Task: Infrastructure - Icône Google et Configuration Supabase

## Problem

Pour implémenter Google OAuth, il faut d'abord mettre en place l'infrastructure de base:
- L'icône Google SVG n'existe pas dans les assets
- Le provider Google n'est pas configuré dans Supabase local (config.toml)
- Les variables d'environnement pour les credentials Google ne sont pas documentées

## Proposed Solution

Ajouter les éléments d'infrastructure nécessaires:
1. Créer le fichier SVG de l'icône Google "G" multicolore
2. Enregistrer l'icône dans MatIconRegistry pour utilisation avec mat-icon
3. Configurer le provider Google dans config.toml pour le dev local
4. Documenter les variables d'environnement dans .env.example

## Dependencies

- Aucune dépendance - cette tâche peut démarrer immédiatement

## Context

- Pattern icônes SVG: Voir comment les autres icônes custom sont enregistrées dans `app.config.ts`
- Config Supabase: `backend-nest/supabase/config.toml` contient un exemple avec Apple (disabled) aux lignes ~260-274
- Variables env: Utiliser format `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` dans config.toml

Fichiers concernés:
- `frontend/projects/webapp/src/assets/icons/google.svg` (créer)
- `frontend/projects/webapp/src/app/app.config.ts` (modifier)
- `backend-nest/supabase/config.toml` (modifier)
- `backend-nest/.env.example` (modifier)

## Success Criteria

- [ ] Icône Google SVG créée (viewBox 24x24, compatible mat-icon)
- [ ] Icône enregistrée dans MatIconRegistry et utilisable via `<mat-icon svgIcon="google">`
- [ ] Section `[auth.external.google]` ajoutée dans config.toml
- [ ] Variables `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` et `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` documentées dans .env.example
- [ ] `pnpm quality` passe sans erreurs
