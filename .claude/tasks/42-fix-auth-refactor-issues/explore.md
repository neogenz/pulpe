# Task: Correction des Issues de Refactorisation Auth

**Date**: 2026-01-16
**Context**: Corriger les anti-patterns identifiés dans la refactorisation du module auth

---

## Issues à Traiter

### Issues Prioritaires
1. ✅ **Issue 1**: Fuite mémoire - Listener non nettoyé (auth-session.service.ts:80)
2. ✅ **Issue 3**: Race condition - État mutable dans singleton (auth-cleanup.service.ts:22-47)
3. ✅ **Issue 4**: Catch silencieux - Perte d'information (auth-credentials.service.ts:45, 80)
4. ✅ **Issue 7**: Duplication cleanup non cohérente (auth-session.service.ts:192-211)
5. ✅ **Issue 10**: Barrel export trop large (index.ts)

### Issues Validées
- **Issue 6**: `#setupMockStateObserver()` - **N'existe PAS sur main** → À RETIRER
- **Issue 8**: Responsabilité floue AuthSessionService - **Accepté** (ne pas sur-découper)
- **Issue 2**: Code dupliqué `#isE2EBypass()` - **Accepté** (osef)
- **Issue 5**: SSR non sécurisé - **À explorer** (doc Angular en priorité)

---

## 1. Codebase Context - Patterns Établis

### 1.1. DestroyRef Usage - Components Only

**Constat Critique**: DestroyRef est utilisé UNIQUEMENT dans les **components**, JAMAIS dans les services `@Injectable root`.

**Exemple Trouvé**:
```typescript
// frontend/projects/webapp/src/app/feature/current-month/current-month.ts:254-271
readonly #destroyRef = inject(DestroyRef);

// Cleanup dans component
this.#destroyRef.onDestroy(() => {
  this.#loadingIndicator.setLoading(false);
});

// Avec takeUntilDestroyed
pipe(takeUntilDestroyed(this.#destroyRef))
```

**Pattern Service Root avec Cleanup Explicite**:
```typescript
// frontend/projects/webapp/src/app/core/analytics/analytics.ts:22-106
export class AnalyticsService implements OnDestroy {
  #authEffect?: EffectRef;

  ngOnDestroy() {
    this.destroy();
  }

  destroy(): void {
    this.#authEffect?.destroy();
    // cleanup explicite
  }
}
```

**Conclusion**: Les services root n'ont PAS de lifecycle destroy automatique. Pour cleanup explicite:
- ✅ Implémenter `OnDestroy` + `destroy()` method (pattern AnalyticsService)
- ❌ PAS de DestroyRef dans services root (utilisé uniquement pour components)

---

### 1.2. Logger Error Pattern - Catch Blocks

**Pattern Consistant** trouvé partout dans le projet:

```typescript
// posthog.ts:85, demo-initializer.ts:103, auth-session.ts:70
try {
  await operation();
} catch (error) {
  this.#logger.error('Contextual message describing the operation', error);
  // Optional: return fallback or rethrow
}
```

**Exemples du Projet**:
- `posthog.ts:85` - `this.#logger.error('Failed to initialize PostHog', error)`
- `demo-initializer.ts:103` - `this.#logger.error('Failed to start demo session', { error })`
- `auth-session.ts:205` - `this.#logger.error('Erreur lors de la déconnexion:', error)`

**Convention**:
- ✅ Message descriptif en 1ère position
- ✅ Error object en 2ème position (ou dans objet `{ error }`)
- ✅ Messages en anglais (sauf exceptions comme auth-session qui garde français)
- ❌ JAMAIS de catch silencieux sans logging

**Exception Identifiée**: `auth-credentials.service.ts` n'a PAS de logging dans catch blocks car délègue à `AuthErrorLocalizer` pour messages utilisateur.

---

### 1.3. Boolean Flags - Race Condition Prevention

**Deux Patterns Distincts Identifiés**:

**Pattern 1: Signal Boolean** (pour état exposé/réactif)
```typescript
// demo-initializer.ts:33
readonly #isInitializing = signal(false);

// Guard pattern
if (this.#isInitializing()) {
  return;
}
this.#isInitializing.set(true);
try {
  // operation
} finally {
  this.#isInitializing.set(false);
}
```

**Pattern 2: Property Boolean** (pour guards internes)
```typescript
// auth-cleanup.service.ts:22-47
#cleanupInProgress = false;

performCleanup() {
  if (this.#cleanupInProgress) {
    this.#logger.debug('Cleanup already in progress, skipping');
    return;
  }

  this.#cleanupInProgress = true;
  try {
    // cleanup operations
  } finally {
    setTimeout(() => {
      this.#cleanupInProgress = false;
    }, CLEANUP_RESET_DELAY_MS);
  }
}
```

**Quand Utiliser Quoi**:
- ✅ **Signal**: État exposé publiquement, utilisé dans computed/effects, affiché dans templates
- ✅ **Property**: Guards internes, pas d'utilisation réactive

**Exemples du Projet**:
- Signal: `demo-initializer.ts:33` (#isInitializing), `posthog.ts:27` (#isInitialized)
- Property: `auth-cleanup.ts:22` (#cleanupInProgress), `analytics.ts:29` (#trackingEnabledForSession)

---

### 1.4. E2E Bypass Pattern - Source de Vérité

**Source Centralisée**: `frontend/projects/webapp/src/app/core/auth/e2e-window.ts`

```typescript
// e2e-window.ts:12-24
export interface E2EWindow extends Window {
  __E2E_AUTH_BYPASS__?: boolean;
  __E2E_MOCK_AUTH_STATE__?: AuthState;
  __E2E_DEMO_BYPASS__?: boolean;
  __E2E_DEMO_SESSION__?: DemoSession;
}

export function isE2EMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as E2EWindow).__E2E_AUTH_BYPASS__ === true
  );
}
```

**Pattern d'Usage Cohérent**:
```typescript
// 1. Import helper
import { isE2EMode } from './e2e-window';

// 2. Méthode privée check
#isE2EBypass(): boolean {
  return isE2EMode();
}

// 3. Early return dans méthodes publiques
async signIn() {
  if (this.#isE2EBypass()) {
    this.#logger.info('🎭 Mode test E2E: Simulation signin');
    return { success: true };
  }
  // ... vraie implémentation
}
```

**Services Utilisant ce Pattern**:
- `auth-session.service.ts:50, 196, 224`
- `auth-credentials.service.ts:22, 59, 90`
- `auth-oauth.service.ts:48, 77`
- `demo-initializer.service.ts:48-55`
- `turnstile.service.ts:41-45, 110-115`

**Emoji Convention**: `🎭` pour identifier logs E2E

---

### 1.5. Barrel Exports Conventions

**Analyse des Exports du Projet**:

**Wildcard Exports** (services publics du domain):
```typescript
// auth/index.ts
export * from './auth-api';
export * from './auth-state.service';
export * from './auth-session.service';
export * from './e2e-window';  // E2E types exportés

// budget/index.ts
export * from './budget-api';
export * from './budget-calculator';
```

**Named Exports** (contrôle API explicite):
```typescript
// demo/index.ts
export { DemoInitializerService } from './demo-initializer.service';
export { DemoModeService } from './demo-mode.service';
```

**Testing Utilities Exportées**:
```typescript
// testing/index.ts
export * from './test-utils';  // Légitime pour usage dans tests
```

**Convention Identifiée**:
- ✅ E2E et testing utilities SONT exportés (usage cross-domain légitime)
- ✅ Jamais de `.spec.ts` exportés
- ✅ Wildcard pour simplicité OU named pour contrôle explicite

---

### 1.6. Try-Catch-Finally Pattern

**Pattern Standard Observé**:
```typescript
// demo-initializer.ts:62-126
async initialize() {
  if (this.#isInitializing()) return;  // Guard

  this.#isInitializing.set(true);
  try {
    const result = await operation();
    // handle success
  } catch (error) {
    this.#logger.error('Operation failed', { error });
    // handle error
  } finally {
    this.#isInitializing.set(false);  // Reset flag
  }
}
```

**Variante avec setTimeout** (cleanup service):
```typescript
// auth-cleanup.service.ts:44-47
finally {
  setTimeout(() => {
    this.#cleanupInProgress = false;
  }, CLEANUP_RESET_DELAY_MS);  // 100ms delay
}
```

**Pourquoi setTimeout?** Éviter que le flag soit reset immédiatement et qu'un double-call puisse passer.

---

## 2. Documentation Insights - Angular Best Practices

### 2.1. DestroyRef API - Cleanup Moderne

**Source**: Angular Official API v21

**Concepts Clés**:
- `DestroyRef` = abstraction Angular moderne pour cleanup
- Fonctionne dans services `providedIn: 'root'`, composants, directives
- Retourne une fonction `unregister()` pour annuler cleanup si besoin
- Signal `destroyed` indique si contexte déjà détruit

**Usage dans Services Root**:
```typescript
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private destroyRef = inject(DestroyRef);
  private authSubscription: (() => void) | null = null;

  constructor() {
    // Register cleanup callback
    this.destroyRef.onDestroy(() => {
      if (this.authSubscription) {
        this.authSubscription();
        this.authSubscription = null;
      }
    });
  }

  setupAuthListener() {
    const { data } = this.supabase.auth.onAuthStateChange(callback);

    // Store unsubscribe function
    this.authSubscription = data.subscription.unsubscribe;
  }
}
```

**Comparaison OnDestroy vs DestroyRef**:
| Feature | OnDestroy | DestroyRef |
|---------|-----------|-----------|
| Interface | ✅ | ❌ (injection) |
| Contexte | Components/Directives | Partout |
| Multiple cleanups | ❌ (1 méthode) | ✅ (callbacks multiples) |
| Unregister | ❌ | ✅ |
| Modern | Legacy | ✅ Recommandé |

---

### 2.2. Signals - State Management

**Pattern Strict**:
```typescript
// 1. Private writable signal
readonly #state = signal<T>(initial);

// 2. Public readonly
readonly state = this.#state.asReadonly();

// 3. Computed pour dérivations
readonly derived = computed(() => transform(this.#state()));

// 4. Public mutation methods
setState(value: T) {
  this.#state.set(value);
}
```

**Pour Boolean Flags**:
```typescript
// Signal si exposé/réactif
readonly #isLoading = signal(false);
readonly isLoading = this.#isLoading.asReadonly();

// Property si guard interne
#processingRequest = false;
```

**Race Conditions avec Signals**:
- ⚠️ Signals sont synchrones - PAS de support natif async overlap
- ✅ Combiner signals avec RxJS (exhaustMap) pour async operations
- ✅ Vérifier `destroyRef.destroyed` avant set dans async callbacks

---

### 2.3. SSR Safe Patterns

**JAMAIS `isPlatformBrowser()` dans Templates** (hydration mismatch):
```typescript
// ❌ INCORRECT
template: `<div>{{ isPlatformBrowser(platformId) ? 'Browser' : 'Server' }}</div>`

// ✅ CORRECT - Service logic
canUseLocalStorage(): boolean {
  return isPlatformBrowser(this.#platformId);
}
```

**afterNextRender pour Browser-Only Code**:
```typescript
@Injectable({ providedIn: 'root' })
export class AuthOAuthService {
  constructor() {
    afterNextRender(() => {
      // Ce code s'exécute UNIQUEMENT côté client
      const origin = window.location.origin;
    });
  }
}
```

**Safe Window Access**:
```typescript
getWindow(): Window | null {
  return typeof window !== 'undefined' ? window : null;
}
```

---

### 2.4. Error Handling Standards

**Global ErrorHandler** (pattern Angular):
```typescript
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggingService);

  handleError(error: Error | any): void {
    this.logger.error('Uncaught error', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

// app.config.ts
providers: [
  { provide: ErrorHandler, useClass: GlobalErrorHandler }
]
```

**Service Error Logging**:
```typescript
try {
  await operation();
} catch (error) {
  this.logger.error('Operation failed', {
    context: 'ServiceName.methodName',
    error: error instanceof Error ? error.message : String(error)
  });
  return null;  // Fallback
}
```

---

## 3. Research Findings - Web Best Practices 2026

### 3.1. DestroyRef vs takeUntilDestroyed

**takeUntilDestroyed** = opérateur RxJS bâti sur DestroyRef:
```typescript
// Pattern moderne recommandé pour RxJS
this.authService.authState$
  .pipe(takeUntilDestroyed())
  .subscribe(state => { /* handle */ });

// DestroyRef pour cleanup non-RxJS
destroyRef.onDestroy(() => {
  window.removeEventListener('resize', handler);
});
```

**Recommandation**:
- ✅ `takeUntilDestroyed()` pour subscriptions RxJS
- ✅ `DestroyRef.onDestroy()` pour autres cleanups

---

### 3.2. RxJS exhaustMap - Prevent Concurrent Calls

**exhaustMap** ignore requêtes tant que précédente pending:
```typescript
signOut$ = this.signOutClick$.pipe(
  exhaustMap(() => {
    this.isSigningOut.set(true);
    return this.authApi.signOut().pipe(
      finalize(() => this.isSigningOut.set(false)),
      catchError(err => this.handleError(err))
    );
  }),
  takeUntilDestroyed()
);
```

**Comparaison Operators**:
- `switchMap`: cancel précédente au profit de nouvelle
- `concatMap`: queue en séquence
- `mergeMap`: parallèle (race conditions!)
- `exhaustMap`: ignore spam ✅

---

### 3.3. Barrel Exports - Problématiques

**Problèmes Identifiés 2026**:
- ❌ Cycles circulaires (modules import barrel du même dossier)
- ❌ Performance dev (charge synchrone, empile bundle)
- ❌ Tree-shaking difficile

**Recommandations**:
- ✅ Barrels UNIQUEMENT pour bibliothèques (public API)
- ❌ Éviter barrels dans code applicatif
- ✅ Testing files: imports directs, PAS via barrel

**Convention Projet**: Barrels OK pour domains (auth, budget) car servent de public API interne. E2E exports légitimes.

---

## 4. Key Files à Modifier

### Issue 1: Fuite Mémoire Listener
**Fichier**: `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts:80-101`
```typescript
// AVANT (ligne 80):
this.#supabaseClient.auth.onAuthStateChange((event, session) => {
  // listener jamais nettoyé
});

// APRÈS (à implémenter):
const { data: { subscription } } = this.#supabaseClient.auth.onAuthStateChange(...);
this.#destroyRef.onDestroy(() => subscription.unsubscribe());
```

---

### Issue 3: Race Condition Cleanup
**Fichier**: `frontend/projects/webapp/src/app/core/auth/auth-cleanup.service.ts:22-47`
```typescript
// AVANT:
#cleanupInProgress = false;  // Property mutable

// APRÈS (option 1 - garder property):
// Pattern OK car guard interne, pas exposé publiquement
// Juste améliorer avec destroyRef pour cancel setTimeout

// APRÈS (option 2 - signal):
readonly #cleanupInProgress = signal(false);
```

**Décision**: Garder property boolean (pattern établi), mais ajouter cleanup du setTimeout.

---

### Issue 4: Catch Silencieux
**Fichiers**:
- `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts:45-52`
- `frontend/projects/webapp/src/app/core/auth/auth-credentials.service.ts:80-87`

```typescript
// AVANT (ligne 45):
} catch {  // ❌ Error non loggée
  return { success: false, error: AUTH_ERROR_MESSAGES.UNEXPECTED_LOGIN_ERROR };
}

// APRÈS:
} catch (error) {
  this.#logger.error('Unexpected login error', { error });
  return { success: false, error: AUTH_ERROR_MESSAGES.UNEXPECTED_LOGIN_ERROR };
}
```

---

### Issue 6: Méthode Vide
**Fichier**: `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts:218-222`
```typescript
// À RETIRER (n'existe pas sur main):
#setupMockStateObserver(): void {
  this.#logger.debug('🎭 E2E mock auth state applied');
}
```

**Vérification**: `git show main:...` → NOT_FOUND ✅

---

### Issue 7: Cleanup Cohérence
**Fichier**: `frontend/projects/webapp/src/app/core/auth/auth-session.service.ts:192-211`

**Problème**: Flow différent E2E vs prod
```typescript
async signOut(): Promise<void> {
  if (this.#isE2EBypass()) {
    this.#cleanup.performCleanup(userId);  // ✅ Cleanup explicite
  }

  await this.getClient().auth.signOut();
  // ❌ Cleanup via event listener SIGNED_OUT (race possible)
}
```

**Solution**: Toujours faire cleanup explicite après signOut, même en prod.

---

### Issue 10: Barrel Export E2E
**Fichier**: `frontend/projects/webapp/src/app/core/auth/index.ts:14`
```typescript
// ACCEPTÉ (légitime):
export * from './e2e-window';
```

**Raison**: E2E types utilisés par `demo-initializer.service.ts` et `turnstile.service.ts` (cross-domain).

---

## 5. Patterns to Follow

### Pattern 1: DestroyRef Cleanup (Issue 1)
```typescript
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  readonly #destroyRef = inject(DestroyRef);
  #authSubscription: (() => void) | null = null;

  async initializeAuthState() {
    const { data } = this.#supabaseClient.auth.onAuthStateChange(handler);
    this.#authSubscription = () => data.subscription.unsubscribe();

    this.#destroyRef.onDestroy(() => {
      this.#authSubscription?.();
    });
  }
}
```

### Pattern 2: Logger dans Catch (Issue 4)
```typescript
try {
  await operation();
} catch (error) {
  this.#logger.error('Descriptive operation message', {
    error,
    context: 'ServiceName.methodName'
  });
  return fallback;
}
```

### Pattern 3: Cleanup Cohérent (Issue 7)
```typescript
async signOut(): Promise<void> {
  const userId = this.#state.user()?.id;

  try {
    if (!this.#isE2EBypass()) {
      await this.getClient().auth.signOut();
    }
  } finally {
    // ✅ Cleanup TOUJOURS exécuté (E2E + prod)
    this.#updateAuthState(null);
    this.#cleanup.performCleanup(userId);
  }
}
```

### Pattern 4: setTimeout Cleanup (Issue 3)
```typescript
performCleanup() {
  this.#cleanupInProgress = true;

  const timeoutId = setTimeout(() => {
    this.#cleanupInProgress = false;
  }, 100);

  // ✅ Cancel timeout si service destroy
  this.#destroyRef.onDestroy(() => clearTimeout(timeoutId));
}
```

---

## 6. Dependencies & Prerequisites

**Services à Modifier**:
1. `auth-session.service.ts` - Issues 1, 6, 7
2. `auth-cleanup.service.ts` - Issue 3
3. `auth-credentials.service.ts` - Issue 4
4. `auth/index.ts` - Issue 10 (AUCUNE modification - accepté)

**Imports Nécessaires**:
```typescript
import { DestroyRef, inject } from '@angular/core';
```

**Tests Impactés**:
- `auth-session.service.spec.ts` - Vérifier cleanup listener
- `auth-cleanup.service.spec.ts` - Vérifier setTimeout cleanup
- `auth-credentials.service.spec.ts` - Vérifier error logging

**Dépendances Existantes**:
- Logger service (déjà injecté partout)
- DestroyRef (Angular core, aucune dépendance externe)

---

## 7. Test Strategy - Ne Pas Casser les Tests

### Tests Existants à Préserver

**Pattern Mock Supabase**:
```typescript
// test-utils.ts - Déjà établi
export interface MockSupabaseAuth {
  signOut: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
  // ...
}
```

**Tests à Adapter** (Issue 1):
```typescript
// auth-session.service.spec.ts
it('should cleanup subscription on destroy', () => {
  const unsubscribeSpy = vi.fn();
  mockClient.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: unsubscribeSpy } }
  });

  service.initializeAuthState();

  // Trigger destroy
  TestBed.inject(DestroyRef).destroy();  // ⚠️ À vérifier

  expect(unsubscribeSpy).toHaveBeenCalled();
});
```

**Tests à Adapter** (Issue 4):
```typescript
// auth-credentials.service.spec.ts
it('should log error when signIn fails unexpectedly', async () => {
  const loggerSpy = vi.spyOn(logger, 'error');
  mockClient.auth.signInWithPassword.mockRejectedValue(new Error('Network'));

  await service.signInWithEmail('test@test.com', 'pass');

  expect(loggerSpy).toHaveBeenCalledWith(
    'Unexpected login error',
    expect.objectContaining({ error: expect.any(Error) })
  );
});
```

---

## 8. Next Steps

1. **Créer Plan d'Implémentation**: `/workflow:epct:plan 42-fix-auth-refactor-issues`
2. **Ordre des Fixes**:
   - Issue 6 (supprimer méthode vide) - Simple, sans risque
   - Issue 4 (logger dans catch) - Impact tests minimal
   - Issue 1 (cleanup listener) - Nécessite tests cleanup
   - Issue 3 (setTimeout cleanup) - Vérifier pattern avec DestroyRef
   - Issue 7 (cleanup cohérence) - Modifier flow signOut
3. **Validation**: Lancer `pnpm test` après chaque fix

---

## 9. Concerns & Blockers

### Préoccupations

**Issue 3 (Race Condition)**:
- Le pattern setTimeout + boolean flag est établi et cohérent dans le projet
- Faut-il vraiment le changer en signal? (pas exposé publiquement)
- **Décision**: Garder property, juste cleanup du setTimeout

**Issue 7 (Cleanup Cohérence)**:
- Modifier flow signOut peut impacter tests E2E
- Besoin de vérifier que cleanup explicite ne casse pas le flow event listener
- **Mitigation**: Tests rigoureux après modification

**Issue 10 (Barrel Exports)**:
- E2E exports sont légitimes selon conventions projet
- **Décision**: Aucune modification

### Blockers

Aucun blocker identifié. Tous les patterns et outils nécessaires sont disponibles dans le projet.

---

## Sources

### Codebase
- `current-month.ts:254` - DestroyRef component pattern
- `analytics.ts:22-106` - OnDestroy service pattern
- `demo-initializer.ts:62-126` - Try-catch-finally reference
- `auth-cleanup.service.ts:22-47` - Boolean flag pattern
- `e2e-window.ts` - E2E bypass source de vérité

### Angular Documentation
- [DestroyRef API](https://angular.dev/api/core/DestroyRef)
- [Signals Guide](https://angular.dev/guide/signals)
- [Error Handling Best Practices](https://angular.dev/best-practices/error-handling)
- [SSR Guide](https://angular.dev/guide/ssr)

### Web Research 2026
- [takeUntilDestroyed vs DestroyRef](https://dev.to/davo_man/efficiently-destroying-observables-in-angular-2p64)
- [RxJS exhaustMap](https://www.learnrxjs.io/learn-rxjs/operators/transformation/exhaustmap)
- [Barrel Files Problems](https://tkdodo.eu/blog/please-stop-using-barrel-files)
