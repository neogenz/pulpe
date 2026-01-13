# Tasks: 27-add-google-oauth-login

## Overview

Ajouter la connexion Google OAuth à l'application Angular avec:
- Bouton Google sur les pages login et welcome
- Modal d'acceptation CGU après première connexion OAuth
- Redirection vers onboarding simplifié pour créer le budget
- Implicit flow Supabase (onAuthStateChange gère tout)

## Task List

- [ ] **Task 1**: Infrastructure - Icône Google et Config Supabase - `task-01.md`
- [ ] **Task 2**: AuthApi signInWithGoogle - `task-02.md` (dépend de Task 1)
- [ ] **Task 3**: AuthApi CGU + Modal - `task-03.md` (parallèle à Task 2)
- [ ] **Task 4**: UI Boutons Google - `task-04.md` (dépend de Tasks 1, 2)
- [ ] **Task 5**: Guard OAuth + Onboarding Flow - `task-05.md` (dépend de Task 3)
- [ ] **Task 6**: Tests Complets - `task-06.md` (dépend de toutes les tâches)

## Execution Order

```
Task 1 (Infrastructure)
    ├── Task 2 (signInWithGoogle) ──┐
    │                               ├── Task 4 (UI Boutons)
    └── Task 3 (CGU + Modal) ───────┤
                                    └── Task 5 (Guard + Onboarding)
                                              │
                                              └── Task 6 (Tests)
```

### Parallélisation possible

1. **Phase 1** (parallèle): Task 1
2. **Phase 2** (parallèle): Tasks 2 et 3 peuvent être faites simultanément
3. **Phase 3** (parallèle): Tasks 4 et 5 peuvent être faites simultanément (dépendances différentes)
4. **Phase 4**: Task 6 (tests) à faire en dernier

### Estimation par tâche

| Task | Estimation | Complexité |
|------|------------|------------|
| Task 1 | 30 min | Faible |
| Task 2 | 45 min | Faible |
| Task 3 | 1h | Moyenne |
| Task 4 | 45 min | Faible |
| Task 5 | 1h30 | Moyenne |
| Task 6 | 1h30 | Moyenne |
| **Total** | **~6h** | - |

## Configuration Externe (hors code)

Avant déploiement en production:
1. Créer credentials OAuth 2.0 dans Google Cloud Console
2. Activer provider Google dans Supabase Dashboard
3. Configurer Client ID/Secret dans Supabase
4. Ajouter variables d'env sur le serveur

## Notes

- Utilisation de l'**implicit flow** (pas de redirectTo, onAuthStateChange gère le retour)
- Les **CGU sont obligatoires** pour les users OAuth (modal sans bouton fermer)
- Les users OAuth passent par un **onboarding simplifié** (skip welcome et registration)
