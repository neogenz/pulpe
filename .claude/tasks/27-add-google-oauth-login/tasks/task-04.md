# Task: UI - Boutons Google sur Login et Welcome

## Problem

Les utilisateurs doivent pouvoir cliquer sur un bouton "Continuer avec Google" pour se connecter via OAuth. Ce bouton doit être présent sur:
1. La page de login (`/login`)
2. La page welcome de l'onboarding (`/onboarding/welcome`)

## Proposed Solution

Sur les deux pages, ajouter:
- Un séparateur visuel avec texte "ou"
- Un bouton Material `mat-stroked-button` avec l'icône Google
- Un handler qui appelle `AuthApi.signInWithGoogle()`
- Gestion du loading state

## Dependencies

- Task 01: Infrastructure (icône Google disponible)
- Task 02: AuthApi signInWithGoogle (méthode disponible)

## Context

- Page login: `login.ts:50-153` contient le template, `signIn()` aux lignes 209-248
- Page welcome: `welcome.ts:89-160` contient le template avec boutons "Commencer" et "Demo"
- Style: Utiliser `mat-stroked-button` pour cohérence avec le design existant
- Icône: Utiliser `<mat-icon svgIcon="google">`

Fichiers concernés:
- `frontend/projects/webapp/src/app/feature/auth/login/login.ts`
- `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts`

## Success Criteria

- [ ] Bouton Google visible sur la page login avec séparateur "ou"
- [ ] Bouton Google visible sur la page welcome avec séparateur "ou"
- [ ] Click sur bouton déclenche la connexion Google
- [ ] Boutons disabled pendant le loading
- [ ] `pnpm quality` passe sans erreurs
- [ ] Tests: bouton présent et fonctionnel sur les deux pages
