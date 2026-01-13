# Task: AuthApi - Méthode signInWithGoogle et Erreurs Localisées

## Problem

L'AuthApi ne supporte actuellement que la connexion email/password. Il faut ajouter la possibilité de se connecter via Google OAuth en utilisant l'implicit flow de Supabase.

## Proposed Solution

Ajouter la méthode `signInWithGoogle()` dans AuthApi qui:
- Utilise `supabase.auth.signInWithOAuth({ provider: 'google' })` (implicit flow)
- Gère les erreurs via AuthErrorLocalizer
- Met à jour isLoading pendant le processus

Ajouter les traductions françaises des erreurs OAuth dans auth-error-localizer.ts.

## Dependencies

- Task 01: Infrastructure (config Supabase doit être en place)

## Context

- Pattern existant: `signInWithEmail()` dans `auth-api.ts:171-204`
- Implicit flow: Pas de `redirectTo`, le listener `onAuthStateChange` (lignes 116-135) gère automatiquement le `SIGNED_IN`
- ErrorLocalizer: `auth-error-localizer.ts:9-46` contient le dictionnaire de traductions

Fichiers concernés:
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts`
- `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts`

## Success Criteria

- [ ] Méthode `signInWithGoogle()` ajoutée dans AuthApi
- [ ] Erreurs OAuth traduites en français (OAuth error, Provider error, Popup closed, Access denied)
- [ ] `pnpm quality` passe sans erreurs
- [ ] Tests unitaires pour signInWithGoogle() passent
