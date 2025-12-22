# Task: Align remaining stores (OnboardingStore, TemplateStore, AuthApi)

## Problem

Trois stores utilisent des noms de signals non standards:
- `OnboardingStore`: `isSubmitting` au lieu de `isLoading`
- `TemplateStore`: `isLoadingTemplates` au lieu de `isLoading`
- `AuthApi`: manque `hasValue` et `error`

## Proposed Solution

Aligner ces stores sur l'API standard:
- Renommer les signals pour cohérence
- Ajouter les signals manquants
- Mettre à jour les composants consommateurs

## Dependencies

- Aucune (peut démarrer immédiatement)

## Context

- `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts` - L77-78
- `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/services/template-store.ts` - L55-58
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts` - L32-42
- **Breaking changes**: Rechercher usages de `isSubmitting` et `isLoadingTemplates`

## Success Criteria

- Tous les stores exposent `isLoading`, `hasValue`, `error`
- Nommage cohérent partout
- Composants consommateurs mis à jour
- Tests mis à jour
- `pnpm quality` passe
