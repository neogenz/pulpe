# Implementation Plan: Google OAuth Login

## Overview

Ajouter la connexion Google OAuth à l'application Angular avec:
- Bouton Google sur les pages login ET welcome
- Modal d'acceptation CGU après première connexion OAuth
- Redirection vers onboarding simplifié (sans registration) pour créer le budget
- Utilisation de l'implicit flow (pas de `redirectTo`, `onAuthStateChange` gère tout)

## Dependencies

**Ordre d'implémentation:**
1. Infrastructure (icône, config) - pas de dépendances
2. AuthApi (signInWithGoogle) - dépend de config
3. UI boutons - dépend de AuthApi
4. Modal CGU - dépend de AuthApi
5. Flow onboarding OAuth - dépend de modal CGU
6. Tests - dépend de tout le reste

**Configuration externe requise (hors scope code):**
- Google Cloud Console: créer credentials OAuth 2.0
- Supabase Dashboard: activer provider Google, configurer Client ID/Secret

---

## File Changes

### `frontend/projects/webapp/src/assets/icons/google.svg`
- Action: Créer le fichier SVG avec l'icône Google officielle
- Source: Utiliser l'icône Google "G" multicolore standard
- Format: SVG viewBox 24x24, compatible avec mat-icon

### `frontend/projects/webapp/src/app/app.config.ts`
- Action: Enregistrer l'icône Google dans MatIconRegistry
- Pattern: Suivre le pattern existant pour les autres icônes SVG custom
- Ajouter dans la fonction d'initialisation: `iconRegistry.addSvgIcon('google', ...)`

### `backend-nest/supabase/config.toml`
- Action: Ajouter la section `[auth.external.google]` pour le développement local
- Lignes ~274 (après la section Apple): Ajouter configuration Google provider
- Utiliser `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` et `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`
- Ajouter `skip_nonce_check = false`

### `backend-nest/.env.example`
- Action: Ajouter les variables d'environnement Google OAuth en exemple
- Ajouter: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` et `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`

---

### `frontend/projects/webapp/src/app/core/auth/auth-api.ts`
- Action 1: Ajouter méthode `signInWithGoogle(): Promise<void>`
  - Utiliser `this.#supabase.auth.signInWithOAuth({ provider: 'google' })`
  - Implicit flow (pas de `redirectTo`)
  - Gérer erreur et localiser via `#authErrorLocalizer`
  - Pattern: Similaire à `signInWithEmail` (lignes 171-204)

- Action 2: Ajouter méthode `isNewOAuthUser(): boolean`
  - Vérifier si `session.user.app_metadata.provider === 'google'`
  - Vérifier si c'est la première connexion (pas de budget existant ou flag)
  - Utilisé pour déclencher modal CGU et flow onboarding

- Action 3: Ajouter méthode `hasAcceptedTerms(): boolean`
  - Vérifier `session.user.user_metadata.terms_accepted` ou similaire
  - Retourner true si terms déjà acceptés

- Action 4: Ajouter méthode `acceptTerms(): Promise<void>`
  - Appeler `this.#supabase.auth.updateUser({ data: { terms_accepted: true, terms_accepted_at: new Date().toISOString() } })`
  - Mettre à jour la session locale

### `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts`
- Action: Ajouter traductions pour erreurs OAuth dans `errorTranslations` (lignes 9-46)
- Erreurs à ajouter:
  - `'OAuth error'` → `'Erreur de connexion avec Google'`
  - `'Provider error'` → `'Erreur du fournisseur d\'authentification'`
  - `'Popup closed'` → `'La fenêtre de connexion a été fermée'`
  - `'Access denied'` → `'Accès refusé par Google'`

---

### `frontend/projects/webapp/src/app/feature/auth/login/login.ts`
- Action 1: Ajouter import de `AuthApi.signInWithGoogle` si pas déjà injecté
- Action 2: Dans le template (lignes 50-153), ajouter après le formulaire:
  - Séparateur visuel avec texte "ou"
  - Bouton Google avec `mat-stroked-button`, icône `google`, texte "Continuer avec Google"
  - Lier au click handler `signInWithGoogle()`
  - Désactiver si `isLoading()`
- Action 3: Ajouter méthode `signInWithGoogle()` dans la classe
  - Appeler `this.#authApi.signInWithGoogle()`
  - Gérer erreurs avec toast ou affichage inline
- Pattern: Suivre le style du bouton existant "Se connecter"

### `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts`
- Action 1: Dans le template (lignes 89-160), ajouter:
  - Séparateur visuel après le bouton "Commencer"
  - Bouton Google avec même style que login.ts
- Action 2: Injecter `AuthApi` et ajouter méthode `signInWithGoogle()`
- Consider: Placement UX - le bouton Google permet de sauter l'onboarding email

---

### `frontend/projects/webapp/src/app/shared/components/terms-acceptance-dialog/`
- Action: Créer nouveau composant dialog pour acceptation CGU
- Fichiers à créer:
  - `terms-acceptance-dialog.ts` (composant standalone)
  - Template inline avec:
    - Titre "Conditions d'utilisation"
    - Texte explicatif avec lien vers CGU complètes
    - Checkbox "J'accepte les conditions d'utilisation"
    - Bouton "Continuer" (disabled tant que checkbox non cochée)
  - Utiliser `MatDialogModule`, `MatCheckboxModule`, `MatButtonModule`
- Pattern: Suivre style des autres dialogs de l'app
- Pas de bouton fermer/annuler (acceptation obligatoire)

### `frontend/projects/webapp/src/app/shared/components/terms-acceptance-dialog/index.ts`
- Action: Créer barrel export pour le composant

### `frontend/projects/webapp/src/app/shared/components/index.ts`
- Action: Ajouter export du nouveau composant dialog

---

### `frontend/projects/webapp/src/app/core/auth/oauth-onboarding-guard.ts`
- Action: Créer nouveau guard pour gérer le flow OAuth
- Logique:
  - Si utilisateur OAuth ET pas de terms acceptés → ouvrir modal CGU, bloquer navigation
  - Si utilisateur OAuth ET terms acceptés ET pas de budget → rediriger vers `/onboarding/personal-info`
  - Sinon → laisser passer
- Injecter: `AuthApi`, `MatDialog`, `Router`, `BudgetApi` (pour vérifier si budget existe)
- Pattern: Suivre `auth-guard.ts` (lignes 15-31)

### `frontend/projects/webapp/src/app/core/auth/auth-providers.ts`
- Action: Exporter le nouveau guard `oauthOnboardingGuard`

### `frontend/projects/webapp/src/app/app.routes.ts`
- Action: Ajouter `oauthOnboardingGuard` aux routes protégées `/app/*`
- Le guard s'exécute après `authGuard` pour les utilisateurs authentifiés

---

### `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts`
- Action 1: Ajouter méthode `submitOAuthOnboarding(): Promise<boolean>`
  - Similaire à `submitRegistration` (lignes 167-264) MAIS:
  - Skip l'étape 1 (création compte) - l'utilisateur est déjà authentifié
  - Créer directement le template et le budget
  - Activer PostHog après création
  - Nettoyer storage

- Action 2: Ajouter computed `isOAuthUser`
  - Vérifier via `AuthApi` si l'utilisateur courant est OAuth
  - Utilisé pour adapter le flow

### `frontend/projects/webapp/src/app/feature/onboarding/steps/registration.ts`
- Action: Modifier pour détecter utilisateur OAuth
- Si OAuth user:
  - Ne pas afficher le formulaire email/password
  - Afficher message "Finaliser la configuration"
  - Appeler `onboardingStore.submitOAuthOnboarding()` au lieu de `submitRegistration()`
- Pattern: Utiliser `@if` pour conditionner l'affichage

### `frontend/projects/webapp/src/app/feature/onboarding/onboarding.routes.ts`
- Action: Vérifier que les routes permettent d'accéder directement à `personal-info`
- Le guard OAuth redirigera les users OAuth directement vers cette étape

---

## Testing Strategy

### Tests à créer

#### `frontend/projects/webapp/src/app/core/auth/auth-api.spec.ts`
- Ajouter tests pour `signInWithGoogle()`
  - Test: Appelle `signInWithOAuth` avec provider 'google'
  - Test: Gère erreur et la localise
  - Test: Set isLoading pendant l'appel
- Ajouter tests pour `isNewOAuthUser()`, `hasAcceptedTerms()`, `acceptTerms()`

#### `frontend/projects/webapp/src/app/feature/auth/login/login.spec.ts`
- Ajouter test: Bouton Google présent et fonctionnel
- Ajouter test: Click sur bouton appelle `signInWithGoogle()`
- Ajouter test: Bouton disabled quand isLoading

#### `frontend/projects/webapp/src/app/shared/components/terms-acceptance-dialog/terms-acceptance-dialog.spec.ts`
- Test: Dialog s'affiche avec checkbox et bouton
- Test: Bouton disabled tant que checkbox non cochée
- Test: Ferme dialog avec résultat true quand accepté

#### `frontend/projects/webapp/src/app/core/auth/oauth-onboarding-guard.spec.ts`
- Test: Laisse passer utilisateur non-OAuth
- Test: Ouvre modal CGU pour OAuth user sans terms
- Test: Redirige vers onboarding pour OAuth user sans budget
- Test: Laisse passer OAuth user avec terms et budget

### Tests à mettre à jour

#### `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.spec.ts`
- Ajouter tests pour `submitOAuthOnboarding()`

---

## Documentation

### `backend-nest/.env.example`
- Documenter les nouvelles variables Google OAuth avec commentaires

### Pas de README/CHANGELOG
- Selon les règles projet, pas de création de fichiers doc

---

## Rollout Considerations

### Configuration requise avant déploiement
1. Créer credentials dans Google Cloud Console
2. Configurer provider Google dans Supabase Dashboard (production)
3. Ajouter variables d'env sur le serveur de prod

### Pas de migration DB nécessaire
- `user_metadata` est géré par Supabase Auth (JSONB flexible)
- Pas de nouvelle table requise

### Rétrocompatibilité
- Les utilisateurs existants (email/password) ne sont pas affectés
- Le flow actuel reste identique pour eux

### Feature flag (optionnel)
- Si besoin de rollout progressif, ajouter `ENABLE_GOOGLE_OAUTH` dans config
- Conditionner l'affichage du bouton Google sur ce flag
