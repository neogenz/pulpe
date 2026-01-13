# Task: AuthApi - Méthodes CGU et Modal d'Acceptation

## Problem

Les utilisateurs OAuth doivent accepter les CGU lors de leur première connexion. Il faut:
1. Pouvoir détecter si un utilisateur a accepté les CGU
2. Permettre d'enregistrer l'acceptation
3. Afficher une modal obligatoire pour l'acceptation

## Proposed Solution

Dans AuthApi, ajouter:
- `hasAcceptedTerms(): boolean` - vérifie user_metadata.terms_accepted
- `acceptTerms(): Promise<void>` - met à jour user_metadata via supabase.auth.updateUser()
- `isOAuthUser(): boolean` - vérifie si l'utilisateur courant est connecté via OAuth

Créer un nouveau composant dialog `TermsAcceptanceDialog`:
- Modal Material avec checkbox et bouton "Continuer"
- Pas de bouton fermer (acceptation obligatoire)
- Retourne true quand accepté

## Dependencies

- Aucune dépendance directe - peut être fait en parallèle de Task 02

## Context

- Supabase update user: `supabase.auth.updateUser({ data: { terms_accepted: true } })`
- Pattern dialog: Voir autres dialogs existants dans l'app
- Provider info: `session.user.app_metadata.provider` contient 'google' pour OAuth users

Fichiers concernés:
- `frontend/projects/webapp/src/app/core/auth/auth-api.ts`
- `frontend/projects/webapp/src/app/shared/components/terms-acceptance-dialog/` (créer)
- `frontend/projects/webapp/src/app/shared/components/index.ts`

## Success Criteria

- [ ] Méthodes `hasAcceptedTerms()`, `acceptTerms()`, `isOAuthUser()` ajoutées dans AuthApi
- [ ] Composant TermsAcceptanceDialog créé avec checkbox et bouton
- [ ] Bouton disabled tant que checkbox non cochée
- [ ] Dialog exporté dans barrel exports
- [ ] `pnpm quality` passe sans erreurs
- [ ] Tests unitaires pour les nouvelles méthodes AuthApi
- [ ] Tests unitaires pour TermsAcceptanceDialog
