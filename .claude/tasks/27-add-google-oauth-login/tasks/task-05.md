# Task: Guard OAuth et Flow Onboarding Simplifié

## Problem

Après connexion OAuth, les utilisateurs doivent:
1. Accepter les CGU via modal (si pas encore fait)
2. Compléter l'onboarding simplifié pour créer leur budget (si pas de budget)
3. Être redirigés vers l'app normale (si budget existe)

Actuellement, il n'y a pas de mécanisme pour gérer ce flow spécifique aux utilisateurs OAuth.

## Proposed Solution

Créer un guard `oauthOnboardingGuard` qui:
- Détecte les utilisateurs OAuth
- Ouvre la modal CGU si terms non acceptés
- Redirige vers `/onboarding/personal-info` si pas de budget
- Laisse passer sinon

Adapter l'onboarding pour les utilisateurs OAuth:
- Ajouter `submitOAuthOnboarding()` dans OnboardingStore (skip création compte)
- Modifier `registration.ts` pour détecter OAuth et appeler la bonne méthode

## Dependencies

- Task 03: AuthApi CGU methods + Modal CGU

## Context

- Guard pattern: `auth-guard.ts:15-31` pour le pattern de guard
- OnboardingStore: `submitRegistration()` aux lignes 167-264 crée compte + template + budget
- Pour OAuth: Skip étape 1 (compte déjà créé), faire seulement template + budget
- STEP_ORDER: `['welcome', 'personal-info', 'income', ...]` - OAuth users sautent welcome et registration

Fichiers concernés:
- `frontend/projects/webapp/src/app/core/auth/oauth-onboarding-guard.ts` (créer)
- `frontend/projects/webapp/src/app/core/auth/auth-providers.ts`
- `frontend/projects/webapp/src/app/app.routes.ts`
- `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts`
- `frontend/projects/webapp/src/app/feature/onboarding/steps/registration.ts`

## Success Criteria

- [ ] Guard `oauthOnboardingGuard` créé et appliqué aux routes `/app/*`
- [ ] Modal CGU s'affiche pour nouveaux OAuth users
- [ ] Redirection vers onboarding si pas de budget
- [ ] `submitOAuthOnboarding()` crée template et budget sans créer de compte
- [ ] Page registration détecte OAuth et adapte l'affichage
- [ ] `pnpm quality` passe sans erreurs
- [ ] Tests unitaires pour le guard et submitOAuthOnboarding()
