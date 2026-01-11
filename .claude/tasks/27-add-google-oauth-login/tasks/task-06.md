# Task: Tests Complets Google OAuth

## Problem

Toutes les fonctionnalités Google OAuth sont implémentées mais nécessitent une couverture de tests complète pour garantir la qualité et la non-régression.

## Proposed Solution

Créer et mettre à jour les tests unitaires pour couvrir:
1. AuthApi: signInWithGoogle, hasAcceptedTerms, acceptTerms, isOAuthUser
2. Login component: bouton Google présent et fonctionnel
3. Welcome component: bouton Google présent et fonctionnel
4. TermsAcceptanceDialog: comportement checkbox/bouton
5. oauthOnboardingGuard: tous les scénarios de redirection
6. OnboardingStore: submitOAuthOnboarding

## Dependencies

- Toutes les tâches précédentes (01-05) doivent être complétées

## Context

- Framework test: Vitest avec TestBed Angular
- Pattern AAA: Arrange, Act, Assert
- Mocking: Utiliser `vi.fn()` pour les mocks Supabase
- Fichiers tests existants à étendre: `auth-api.spec.ts`, `login.spec.ts`, `onboarding-store.spec.ts`

Fichiers concernés:
- `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts`
- `frontend/projects/webapp/src/app/feature/auth/login/login.spec.ts`
- `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.spec.ts`
- `frontend/projects/webapp/src/app/shared/components/terms-acceptance-dialog/terms-acceptance-dialog.spec.ts` (créer)
- `frontend/projects/webapp/src/app/core/auth/oauth-onboarding-guard.spec.ts` (créer)
- `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.spec.ts`

## Success Criteria

- [ ] Tests signInWithGoogle: appel correct, gestion erreur, loading state
- [ ] Tests hasAcceptedTerms/acceptTerms: lecture/écriture user_metadata
- [ ] Tests isOAuthUser: détection correcte du provider
- [ ] Tests UI login: bouton présent, click handler, disabled state
- [ ] Tests UI welcome: bouton présent, click handler, disabled state
- [ ] Tests TermsAcceptanceDialog: checkbox toggle, bouton enabled/disabled, retour true
- [ ] Tests oauthOnboardingGuard: tous les cas (non-OAuth, OAuth sans terms, OAuth sans budget, OAuth complet)
- [ ] Tests submitOAuthOnboarding: création template/budget sans compte
- [ ] `pnpm test` passe sans erreurs
- [ ] Couverture des nouveaux fichiers >= 80%
