# Plan d'amélioration du Mode Démo - 1 Oct 2025

## Contexte

La branche `backend-demo-ephemeral-users` implémente un mode démo backend-first fonctionnel, mais présente des lacunes en termes d'architecture frontend, state management, et intégration analytics.

La branche `demo-mode` originale contenait d'excellents patterns UI/UX qu'on peut réutiliser avec notre approche backend-first supérieure.

## Objectifs

1. **Fixer les problèmes critiques** d'architecture (duplication Supabase, PostHog)
2. **Améliorer le state management** avec des signals Angular modernes
3. **Rehausser l'UX** avec les patterns visuels de demo-mode
4. **Ajouter des tests E2E** pour assurance qualité

## Approche Technique

### Architecture Choisie
✅ **Backend-first** - On garde cette approche (la bonne décision)
✅ **Signal-based state** - Modern Angular patterns
✅ **Real API calls** - Pas d'interceptor localStorage
✅ **Analytics tagging** - is_demo: true sur tous les événements

### Code à Réutiliser de demo-mode
✅ DemoModeService (signal state management)
✅ Welcome page demo button (gradient purple-pink)
✅ Header demo badge (mat-chip avec exit)
✅ E2E test patterns (adaptés pour backend-first)

### Code à NE PAS Réutiliser
❌ HTTP interceptor (on utilise vraies API calls)
❌ localStorage data storage (on utilise vraie DB)
❌ Client-side data generation (backend le fait)
❌ Fake session management (on utilise vrais JWT)

## Plan d'Implémentation

### Phase 1: Architecture Fixes (Priority 1) - ~2h

#### 1.1 AuthApi.setSession() Method
**Fichier**: `frontend/projects/webapp/src/app/core/auth/auth-api.ts`

**Problème actuel**: DemoInitializerService crée un nouveau client Supabase au lieu d'utiliser celui d'AuthApi.

**Solution**:
```typescript
// Add to AuthApi
async setSession(session: {
  access_token: string;
  refresh_token: string
}): Promise<void> {
  const { error } = await this.#supabaseClient.auth.setSession(session);
  if (error) throw error;
  // authState signal will update automatically
}
```

**Impact**: Élimine la duplication de client, garantit cohérence de l'état auth.

#### 1.2 PostHog Demo Tagging
**Fichiers**:
- `frontend/projects/webapp/src/app/core/analytics/posthog.ts`
- `frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts`

**Problème actuel**: Événements demo polluent les analytics production.

**Solution**:
```typescript
// In posthog.ts before_send callback
if (localStorage.getItem('pulpe-demo-mode') === 'true') {
  captureResult.properties = {
    ...captureResult.properties,
    is_demo: true,
  };
}

// In DemoInitializerService after session created
this.#analytics.identify(`demo_user_anonymous`, {
  is_demo: true,
  demo_session_created_at: new Date().toISOString()
});
```

**Impact**: Analytics propres, facile de filtrer démo data.

### Phase 2: State Management (Priority 1) - ~1h

#### 2.1 Créer DemoModeService
**Fichier**: `frontend/projects/webapp/src/app/core/demo/demo-mode.service.ts`

**Code** (inspiré de demo-mode branch):
```typescript
@Injectable({ providedIn: 'root' })
export class DemoModeService {
  readonly #isDemoMode = signal<boolean>(
    localStorage.getItem('pulpe-demo-mode') === 'true'
  );
  readonly isDemoMode = this.#isDemoMode.asReadonly();

  readonly #demoUserEmail = signal<string | null>(
    localStorage.getItem('pulpe-demo-user-email')
  );
  readonly demoUserEmail = this.#demoUserEmail.asReadonly();

  enableDemoMode(email: string): void {
    localStorage.setItem('pulpe-demo-mode', 'true');
    localStorage.setItem('pulpe-demo-user-email', email);
    this.#isDemoMode.set(true);
    this.#demoUserEmail.set(email);
  }

  disableDemoMode(): void {
    localStorage.removeItem('pulpe-demo-mode');
    localStorage.removeItem('pulpe-demo-user-email');
    this.#isDemoMode.set(false);
    this.#demoUserEmail.set(null);
  }
}
```

**Impact**:
- State réactif avec signals
- Centralisé, injectable partout
- Facile à tester

#### 2.2 Refactor DemoInitializerService
**Fichier**: `frontend/projects/webapp/src/app/core/demo/demo-initializer.service.ts`

**Changements**:
1. Injecter `DemoModeService` et `AuthApi`
2. Utiliser `authApi.setSession()` au lieu de créer nouveau client
3. Utiliser `demoModeService.enableDemoMode()` pour state
4. Supprimer accès direct localStorage

**Avant**:
```typescript
const supabase = createClient(url, key); // ❌ Duplication
localStorage.setItem('pulpe-demo-mode', 'true'); // ❌ Direct access
```

**Après**:
```typescript
await this.#authApi.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token
}); // ✅ Use existing client

this.#demoModeService.enableDemoMode(session.user.email); // ✅ Centralized state
```

### Phase 3: UI Enhancements (Priority 2) - ~2h

#### 3.1 Welcome Page Demo Button
**Fichier**: `frontend/projects/webapp/src/app/feature/onboarding/welcome/welcome.ts`

**Ajouter** (inspiré de demo-mode):
```html
<div class="flex flex-col items-center gap-4">
  <!-- Existing create account button -->

  <div class="flex items-center gap-4 w-full max-w-sm">
    <div class="flex-1 h-px bg-outline-variant"></div>
    <span class="text-body-small text-outline">ou</span>
    <div class="flex-1 h-px bg-outline-variant"></div>
  </div>

  <button
    matButton="filled"
    class="w-full max-w-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg transform transition-all hover:scale-105"
    data-testid="welcome-demo-button"
    (click)="onStartDemo()"
    [disabled]="isLoadingDemo()">
    <mat-icon class="mr-2">play_circle</mat-icon>
    @if (isLoadingDemo()) {
      <span>Préparation de la démo...</span>
    } @else {
      <span>Essayer la démo</span>
    }
  </button>
</div>
```

**TypeScript**:
```typescript
readonly #demoInitializer = inject(DemoInitializerService);
readonly isLoadingDemo = this.#demoInitializer.isInitializing;

async onStartDemo(): Promise<void> {
  try {
    await this.#demoInitializer.startDemoSession();
  } catch (error) {
    this.#logger.error('Demo start failed', { error });
    // Show error snackbar
  }
}
```

#### 3.2 Header Demo Badge
**Fichier**: `frontend/projects/webapp/src/app/layout/main-layout.ts`

**Remplacer** la bannière actuelle par un badge professionnel:
```html
<!-- In toolbar, after breadcrumb -->
@if (demoMode.isDemoMode()) {
  <mat-chip-set class="mr-4">
    <mat-chip
      class="!bg-gradient-to-r !from-purple-600 !to-pink-600 !text-white"
      highlighted
      data-testid="demo-mode-badge">
      <mat-icon matChipAvatar>play_circle</mat-icon>
      Mode Démo
      <button
        matChipRemove
        (click)="exitDemoMode()"
        aria-label="Quitter le mode démo">
        <mat-icon>cancel</mat-icon>
      </button>
    </mat-chip>
  </mat-chip-set>
}
```

**TypeScript**:
```typescript
readonly demoMode = inject(DemoModeService);

async exitDemoMode(): Promise<void> {
  this.demoMode.disableDemoMode();
  await this.authApi.signOut();
  await this.router.navigate(['/']);
}
```

### Phase 4: Testing (Priority 2) - ~2h

#### 4.1 E2E Test: Demo Activation Flow
**Fichier**: `frontend/e2e/tests/features/demo-mode.spec.ts`

**Adapter depuis demo-mode branch**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Demo Mode', () => {
  test('should activate demo mode from welcome page', async ({ page }) => {
    await page.goto('/');

    // Click demo button
    const demoButton = page.getByTestId('welcome-demo-button');
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/app/current-month');

    // Verify demo mode active
    const isDemoMode = await page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-mode') === 'true';
    });
    expect(isDemoMode).toBe(true);

    // Verify demo badge visible
    await expect(page.getByTestId('demo-mode-badge')).toBeVisible();
  });

  test('should exit demo mode successfully', async ({ page }) => {
    // Setup: Activate demo mode first
    await page.goto('/');
    await page.getByTestId('welcome-demo-button').click();
    await page.waitForURL('/app/current-month');

    // Exit demo mode
    const exitButton = page.getByTestId('demo-mode-badge').getByRole('button', { name: /quitter/i });
    await exitButton.click();

    // Should redirect to home
    await expect(page).toHaveURL('/');

    // Verify demo mode inactive
    const isDemoMode = await page.evaluate(() => {
      return localStorage.getItem('pulpe-demo-mode') === 'true';
    });
    expect(isDemoMode).toBe(false);
  });
});
```

#### 4.2 Unit Tests
**Fichier**: `frontend/projects/webapp/src/app/core/demo/demo-mode.service.spec.ts`

```typescript
describe('DemoModeService', () => {
  let service: DemoModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DemoModeService);
    localStorage.clear();
  });

  it('should initialize with demo mode off', () => {
    expect(service.isDemoMode()).toBe(false);
  });

  it('should enable demo mode and set email', () => {
    service.enableDemoMode('demo@pulpe.app');

    expect(service.isDemoMode()).toBe(true);
    expect(service.demoUserEmail()).toBe('demo@pulpe.app');
    expect(localStorage.getItem('pulpe-demo-mode')).toBe('true');
  });

  it('should disable demo mode and clear state', () => {
    service.enableDemoMode('demo@pulpe.app');
    service.disableDemoMode();

    expect(service.isDemoMode()).toBe(false);
    expect(service.demoUserEmail()).toBeNull();
    expect(localStorage.getItem('pulpe-demo-mode')).toBeNull();
  });
});
```

### Phase 5: Documentation (Priority 3) - ~1h

#### 5.1 Mettre à jour DEMO_MODE_IMPLEMENTATION.md
**Ajouter sections**:
- PostHog Integration
- DemoModeService API
- Architecture Diagram

#### 5.2 Mettre à jour frontend/CLAUDE.md
**Ajouter section**: Demo Mode Patterns

#### 5.3 Créer README pour tests
**Fichier**: `frontend/e2e/tests/features/README.md`

## Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Breaking changes dans AuthApi | Moyen | Faible | Ajouter méthode sans modifier existant |
| PostHog dashboards cassés | Élevé | Moyen | Propriété optionnelle, tester dashboards |
| Bugs change detection signals | Moyen | Faible | Tests minutieux, OnPush correct |
| E2E tests trop longs | Faible | Moyen | Limiter aux happy paths critiques |

## Critères de Succès

✅ **Architecture**
- Pas de duplication client Supabase
- State réactif avec signals
- PostHog events taggés is_demo: true

✅ **UX**
- Bouton démo professionnel sur welcome
- Badge démo visible dans header
- Loading states clairs

✅ **Qualité**
- E2E tests passent
- Aucune régression détectée
- Code formatté et linté

✅ **Documentation**
- Plan d'implémentation complet
- README tests à jour
- CLAUDE.md enrichi

## Timeline Estimée

- **Phase 1** (Architecture): 2h
- **Phase 2** (State): 1h
- **Phase 3** (UI): 2h
- **Phase 4** (Tests): 2h
- **Phase 5** (Docs): 1h
- **Total**: ~8h

## Décisions Techniques

### ✅ Décisions Prises
1. Utiliser signals pour state management (modern Angular)
2. Réutiliser UI patterns de demo-mode (professionnels)
3. Implémenter PostHog tagging is_demo (essentiel)
4. Adapter E2E tests pour backend-first (qualité)

### ❌ Hors Scope (YAGNI/Nice-to-have)
1. Session expiration countdown (complexe, faible valeur)
2. Demo guard pour features payantes (pas nécessaire MVP)
3. Storage service abstraction (over-engineering)
4. Error message i18n (faible priorité)

## Validation Finale

Avant merge, vérifier:
- [ ] Tous les tests E2E passent
- [ ] Aucune régression sur tests existants
- [ ] PostHog events contiennent is_demo
- [ ] AuthApi.setSession() fonctionne
- [ ] DemoModeService signals réactifs
- [ ] UI professionnelle et accessible
- [ ] Documentation complète

## Références

- Branch demo-mode: `/Users/maximedesogus/conductor/repo/pulpe/demo-mode`
- PR actuelle: #120
- Documentation: `DEMO_MODE_IMPLEMENTATION.md`
