# Task: Google OAuth & Onboarding Improvements

## Résumé de la Review Précédente

Ce document complète la review architecture/UX effectuée sur l'onboarding et l'intégration Google OAuth.

---

## Codebase Context

### 1. checkExistingBudgets() - PROBLÈME CRITIQUE

**Fichier:** `complete-profile-store.ts:108-133`

La méthode existe et est testée, mais **n'est jamais appelée** dans `CompleteProfilePage`.

```typescript
// complete-profile-store.ts:108
async checkExistingBudgets(): Promise<boolean> {
  this.#state.update((s) => ({ ...s, isCheckingExistingBudget: true }));
  // ... vérifie si l'utilisateur a déjà des budgets
}
```

**Impact:** Un utilisateur qui revient sur `/app/complete-profile` (par navigation directe ou refresh) peut créer un doublon de budget.

**Grep result:** Aucun appel trouvé dans `complete-profile-page.ts`.

---

### 2. Largeurs Containers Auth - Incohérences

| Fichier | Classe utilisée |
|---------|-----------------|
| `welcome-page.ts:40` | `max-w-3xl` (896px) |
| `login.ts:44` | `max-w-md` (448px) |
| `signup.ts:69` | `max-w-md` (448px) |
| `complete-profile-page.ts:41` | `max-w-2xl` (672px) |
| `settings-page.ts:42` | `max-w-2xl` (672px) |

**Observation:**
- Login/Signup: cohérents (`max-w-md`)
- Welcome: plus large car contient animation Lottie
- Complete-profile et Settings: `max-w-2xl`

**Recommandation:** Complete-profile pourrait être `max-w-md` pour cohérence avec signup.

---

### 3. Déconnexion sur complete-profile

**Fichier:** `main-layout.ts:265-290`

Le bouton de déconnexion existe dans le menu utilisateur de la toolbar, accessible via :
```html
<button mat-menu-item (click)="onLogout()" data-testid="logout-button">
```

**Mais:** L'utilisateur sur complete-profile a accès à ce menu car il est dans le `main-layout`. ✅ Pas de blocage.

**UX consideration:** Sur mobile, le menu est accessible via le user menu en haut à droite. Cela fonctionne.

---

### 4. Analytics PostHog - État Actuel

**Fichier:** `posthog.ts:115-124`

```typescript
captureEvent(event: string, properties?: Properties): void {
  if (!this.#canCapture()) return;
  posthog.capture(event, properties);
}
```

**Utilisation actuelle dans l'app:** Très limité, principalement pour les exceptions.

**Events de funnel manquants:**
- `signup_started` (email vs Google)
- `signup_completed`
- `profile_step1_completed`
- `profile_step2_skipped` / `profile_step2_completed`
- `first_budget_created`

---

### 5. Tests E2E Authentication

**Fichier:** `e2e/tests/features/authentication.spec.ts`

Tests existants:
- ✅ Protection routes non-authentifiées
- ✅ Formulaire login avec champs requis
- ✅ Session maintenue après refresh
- ✅ Logout correct

**Manquant:**
- ❌ Flow Google OAuth (complexe car redirection externe)
- ❌ Flow signup complet
- ❌ Flow complete-profile

---

## Key Files

| Purpose | Path | Line |
|---------|------|------|
| Google OAuth Button | `pattern/google-oauth/google-oauth-button.ts` | - |
| Auth API (OAuth) | `core/auth/auth-api.ts` | 253-278 |
| Complete Profile Page | `feature/complete-profile/complete-profile-page.ts` | - |
| Complete Profile Store | `feature/complete-profile/complete-profile-store.ts` | 108 |
| Main Layout (logout) | `layout/main-layout.ts` | 265-290 |
| PostHog Service | `core/analytics/posthog.ts` | 115 |
| E2E Auth Tests | `e2e/tests/features/authentication.spec.ts` | - |
| Routes Config | `app.routes.ts` | 46-53 |

---

## Patterns to Follow

### Store Pattern (existant)
```typescript
// complete-profile-store.ts
readonly #state = signal<CompleteProfileState>(createInitialState());
readonly isCheckingExistingBudget = computed(() => this.#state().isCheckingExistingBudget);
```

### Analytics Event Pattern
```typescript
// Exemple de ce qui devrait être fait
this.#postHogService.captureEvent('profile_completed', {
  signup_method: 'google', // ou 'email'
  has_pay_day: state.payDayOfMonth !== null,
  charges_count: this.#countOptionalCharges(state)
});
```

---

## Dependencies

### Pour checkExistingBudgets
- `BudgetApi.getAllBudgets$()` - déjà injecté dans le store
- `Router` pour redirection si budget existe

### Pour Analytics
- `PostHogService` - déjà disponible globalement
- Nécessite identification user avec `identify()`

### Pour E2E OAuth
- Supabase mock ou auth bypass
- Configuration des redirects dans l'environnement de test

---

## Issues Identifiées - Liste Complète

### 🔴 Priorité Haute

1. **Appeler checkExistingBudgets() au init de CompleteProfilePage**
   - Fichier: `complete-profile-page.ts`
   - Action: Ajouter `afterNextRender()` ou `effect()` pour appeler `store.checkExistingBudgets()`
   - Si retourne `true` → rediriger vers dashboard
   - **Risque:** Création de budgets en doublon

2. **Pré-remplir le prénom pour OAuth**
   - Fichier: `complete-profile-store.ts` (createInitialState)
   - Fichier: `complete-profile-page.ts` (init)
   - Contexte: `session.user.user_metadata.full_name` ou `given_name` disponible après OAuth
   - **Impact UX:** L'utilisateur Google doit re-saisir son prénom alors qu'il est déjà connu

### 🟡 Priorité Moyenne

3. **Absence de feedback CGU pour OAuth**
   - Fichier: `signup.ts:193-228` - Checkbox `acceptTerms` obligatoire
   - Fichier: `welcome-page.ts` - Pas de checkbox CGU avant Google
   - **Question légale:** L'acceptation CGU est-elle implicite via OAuth ?
   - **Action possible:** Ajouter mention CGU sur complete-profile OU dans welcome avant OAuth

4. **Bouton "Créer un compte" sur Login → /welcome (détour)**
   - Fichier: `login.ts:154`
   - Actuel: `routerLink="/welcome"` puis l'utilisateur doit cliquer vers signup
   - **Suggestion:** Lien direct vers `/signup`

5. **Standardiser largeurs containers auth**
   - Fichier: `complete-profile-page.ts:41` → `max-w-2xl`
   - Login/Signup utilisent `max-w-md`
   - **Décision:** Garder `max-w-2xl` car stepper plus large, OU uniformiser

6. **Pas de `redirectTo` explicite dans signInWithOAuth**
   - Fichier: `auth-api.ts:260-261`
   ```typescript
   await this.#supabaseClient!.auth.signInWithOAuth({
     provider: 'google',
     // ❌ Manque: options: { redirectTo: window.location.origin }
   });
   ```
   - **Risque:** Dépend de la config Supabase dashboard, pas explicite dans le code

7. **Gestion du refus OAuth non explicite**
   - Fichier: `auth-api.ts:264-268`
   - Si l'utilisateur annule sur le popup Google, l'erreur Supabase est affichée mais peut être obscure
   - **Suggestion:** Localiser le message d'erreur pour "user_cancelled" ou équivalent

### ✅ Validé (pas d'action)

8. **Déconnexion accessible sur complete-profile**
   - Menu utilisateur disponible dans toolbar du `main-layout`
   - L'utilisateur peut se déconnecter

9. **Labels Google cohérents**
   - "Continuer avec Google" utilisé partout (welcome, login, signup)
   - ✅ Standard respecté

10. **État loading OAuth correct**
    - `isLoading` reste `true` après succès car OAuth redirige vers Google
    - Documenté dans les tests (ligne 106-112)
    - ✅ Comportement intentionnel

### 🟢 Nice-to-have

11. **Analytics funnel conversion**
    - Ajouter events aux étapes clés du signup/onboarding
    - Events suggérés:
      - `signup_started` (method: 'google' | 'email')
      - `signup_completed`
      - `profile_step1_completed`
      - `profile_step2_skipped` / `profile_step2_completed`
      - `first_budget_created`
    - Fichiers concernés: `welcome-page.ts`, `signup.ts`, `complete-profile-store.ts`

12. **Test E2E flow complet**
    - OAuth: Difficile (redirection externe Google)
    - Possible: Tester flow email signup + complete-profile
    - Fichier existant: `e2e/tests/features/authentication.spec.ts`

---

## Recommandation Plan

### Phase 1 - Critique (🔴)
1. Fix `checkExistingBudgets()` - évite doublons budget
2. Pré-remplir prénom depuis OAuth user_metadata

### Phase 2 - UX/Légal (🟡)
3. Clarifier acceptation CGU pour OAuth
4. Lien direct Login → Signup
5. Décision sur largeurs containers
6. Ajouter `redirectTo` explicite dans OAuth
7. Améliorer message erreur refus OAuth

### Phase 3 - Amélioration Continue (🟢)
8. Analytics funnel conversion
9. Étendre tests E2E (flow email signup + complete-profile)
