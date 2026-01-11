# Task: Ajouter la connexion Google OAuth

## Objectif
Permettre aux utilisateurs de se connecter avec leur compte Google sur l'application Angular frontend.

---

## Codebase Context

### Architecture Auth Actuelle

L'application utilise **Supabase Auth** pour l'authentification email/password. Aucun provider OAuth n'est configuré actuellement.

#### Fichiers Clés

| Fichier | Rôle | Lignes Importantes |
|---------|------|-------------------|
| `frontend/projects/webapp/src/app/core/auth/auth-api.ts` | Service auth central | L64-143: init, L171-204: signInWithEmail |
| `frontend/projects/webapp/src/app/feature/auth/login/login.ts` | Page de connexion | L50-153: Template, L209-248: signIn() |
| `frontend/projects/webapp/src/app/core/auth/auth-error-localizer.ts` | Traduction erreurs | L9-46: errorTranslations map |
| `frontend/projects/webapp/src/app/feature/onboarding/steps/welcome.ts` | Page d'accueil onboarding | L89-97: Bouton "Commencer" |
| `frontend/projects/webapp/src/app/feature/onboarding/onboarding-store.ts` | Gestion état onboarding | L167-264: submitRegistration() |
| `backend-nest/supabase/config.toml` | Config Supabase locale | L260-274: Exemple provider Apple (disabled) |

### Patterns Existants

1. **State Management Signals**: `AuthApi` expose des signaux réactifs (`session`, `isLoading`, `isAuthenticated`)
2. **Supabase Client**: Initialisé dans `AuthApi.initializeAuthState()` après chargement de la config
3. **Auth Listener**: `onAuthStateChange` gère SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT
4. **Guards**: `authGuard` et `publicGuard` utilisent RxJS pour attendre l'état auth
5. **Interceptor HTTP**: Injection automatique du token Bearer, refresh sur 401

### Code Pattern - Auth Listener Actuel

```typescript
// auth-api.ts:116-135
this.#supabase.auth.onAuthStateChange((event, newSession) => {
  switch (event) {
    case 'SIGNED_IN':
    case 'TOKEN_REFRESHED':
      this.#session.set(newSession);
      break;
    case 'SIGNED_OUT':
      this.handleSignOut();
      break;
    case 'USER_UPDATED':
      this.#session.set(newSession);
      break;
  }
});
```

---

## Documentation Insights

### Supabase signInWithOAuth API

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent', // Force consent pour obtenir refresh token
    },
  },
});
```

### User Metadata après OAuth

```typescript
session.user.user_metadata = {
  avatar_url: string;
  email_verified: boolean;
  email: string;
  full_name: string;
  name: string;
  picture: string;
  provider_id: string;
};
```

### Auth Events OAuth

| Event | Description |
|-------|-------------|
| `SIGNED_IN` | Utilisateur authentifié (inclut OAuth) |
| `SIGNED_OUT` | Déconnexion |
| `TOKEN_REFRESHED` | Token rafraîchi automatiquement |

---

## Research Findings

### Configuration Google Cloud Console

1. Créer credentials OAuth 2.0 (type "Web application")
2. **Authorized JavaScript Origins**:
   - Production: `https://yourdomain.com`
   - Dev: `http://localhost:4200`
3. **Authorized Redirect URIs**:
   - Production: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Dev local: `http://127.0.0.1:54321/auth/v1/callback`

### Configuration Supabase Dashboard

1. Authentication → Providers → Enable Google
2. Coller Client ID et Client Secret
3. URL Configuration → Add redirect URLs

### Configuration Supabase Local (config.toml)

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
skip_nonce_check = false
```

### Choix du Flow OAuth (IMPORTANT)

**Deux options pour Angular SPA:**

| Flow | Avantages | Inconvénients | Recommandé pour |
|------|-----------|---------------|-----------------|
| **Implicit** (sans `redirectTo`) | Simple, `onAuthStateChange` gère tout | Moins sécurisé, tokens dans URL | Apps SPA simples |
| **PKCE** (avec `redirectTo`) | Plus sécurisé, code exchange serveur | Nécessite endpoint backend | Apps avec SSR/backend |

**Pour cette app** (Angular SPA + NestJS backend):
- **Option recommandée**: Implicit flow côté frontend
- Le listener `onAuthStateChange` existant dans `auth-api.ts` gérera automatiquement le `SIGNED_IN`
- Pas besoin de route callback dédiée

**Implicit Flow - Code simplifié:**
```typescript
// Pas de redirectTo = implicit flow
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
});
// L'utilisateur est redirigé vers Google
// Au retour, onAuthStateChange détecte SIGNED_IN automatiquement
```

### Security Best Practices

- **State Parameter**: Géré automatiquement par Supabase (protection CSRF)
- **Redirect Mode**: Préféré au popup (meilleur support mobile, pas bloqué)
- **Provider tokens**: Non stockés en DB par défaut (sécurité)

---

## Key Files à Modifier

| Fichier | Modification |
|---------|-------------|
| `auth-api.ts` | Ajouter méthode `signInWithGoogle()` |
| `login.ts` | Ajouter bouton "Connexion avec Google" |
| `welcome.ts` | Optionnel: bouton Google sur page accueil |
| `auth-error-localizer.ts` | Ajouter traductions erreurs OAuth |
| `config.toml` | Configurer provider Google pour dev local |
| `app.routes.ts` | Potentiellement route `/auth/callback` (optionnel) |

---

## Patterns à Suivre

### 1. Méthode signInWithGoogle (à ajouter dans auth-api.ts)

```typescript
async signInWithGoogle(): Promise<void> {
  this.#isLoading.set(true);

  // Implicit flow - pas de redirectTo, onAuthStateChange gère le retour
  const { error } = await this.#supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  if (error) {
    this.#isLoading.set(false);
    throw new Error(this.#authErrorLocalizer.localizeError(error.message));
  }
  // Note: L'utilisateur est redirigé vers Google
  // Au retour, onAuthStateChange (ligne 116-135) détecte SIGNED_IN
  // et met à jour la session automatiquement
}
```

### 2. Bouton Google (style Material)

```html
<button mat-stroked-button
        class="w-full"
        (click)="signInWithGoogle()"
        [disabled]="isLoading()">
  <mat-icon svgIcon="google"></mat-icon>
  <span>Continuer avec Google</span>
</button>
```

### 3. Callback Handling

Le listener `onAuthStateChange` existant gère déjà `SIGNED_IN` - le flow OAuth fonctionnera automatiquement après redirect.

---

## Dependencies

### Configuration Requise

1. **Google Cloud Console**:
   - Créer projet ou utiliser existant
   - Configurer OAuth consent screen
   - Créer credentials OAuth 2.0

2. **Supabase Dashboard (Production)**:
   - Activer provider Google
   - Configurer Client ID/Secret
   - Ajouter redirect URLs

3. **Supabase Local (config.toml)**:
   - Ajouter section `[auth.external.google]`
   - Variables d'env pour credentials

### Variables d'Environnement Nécessaires

```bash
# Pour config.toml local
GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxx
```

---

## Questions Ouvertes

1. **Onboarding OAuth users**: Les utilisateurs OAuth n'ont pas de budget initial. Options:
   - Créer budget vide automatiquement
   - Rediriger vers onboarding simplifié (sans registration step)
   - Détecter nouvel utilisateur OAuth et afficher wizard budget

2. **CGU/Acceptation**: Comment gérer l'acceptation des CGU pour les utilisateurs OAuth?
   - Modal après première connexion?
   - Considérer que connexion = acceptation?

3. **Icône Google**: Existe-t-elle déjà dans les assets? Sinon, ajouter SVG.

4. **Double compte**: Que faire si l'email Google existe déjà avec un compte password?
   - Supabase gère le linking automatiquement si même email

---

## Estimation Complexité

**Niveau**: Moyen

**Composants**:
- Frontend: ~2h (bouton + méthode + tests)
- Configuration: ~1h (Google Console + Supabase + config.toml)
- Onboarding flow: ~1-2h (gestion nouveaux users OAuth)

**Risques**:
- Configuration OAuth complexe (redirect URLs)
- Gestion users OAuth sans budget (flow onboarding)
