# Task: Évaluer l'élimination de E2EWindow avec variables d'environnement

**Date:** 2026-01-16
**Objectif:** Évaluer Option 4 (éliminer `E2EWindow` en utilisant des variables d'environnement Angular) vs Option 2 (déplacer vers `core/testing/`)

---

## Executive Summary

**VERDICT: Option 4 est FAISABLE mais NON RECOMMANDÉE pour ce projet**

Le projet utilise un pattern **runtime config.json** plutôt que les variables d'environnement compile-time d'Angular. Le meilleur approach serait **Option 2 améliorée** : garder le pattern E2EWindow mais avec une meilleure organisation.

**Raisons clés:**
1. ✅ Le projet a déjà un système solide: `DOTENV_CONFIG_PATH` → `.env.e2e` → `config.json` → `ApplicationConfiguration`
2. ❌ Option 4 nécessiterait une refonte majeure du système de config existant
3. ✅ Le pattern E2EWindow actuel est bien implémenté avec `page.addInitScript()`
4. ✅ Production safety déjà garantie (code E2E jamais bundlé dans app)

---

## Architecture Actuelle du Projet

### 1. Système de Configuration Runtime

**Flow actuel:**
```
.env.e2e (local/CI)
    ↓
DOTENV_CONFIG_PATH env var
    ↓
scripts/generate-config.ts (build-time)
    ↓
projects/webapp/public/config.json
    ↓
ApplicationConfiguration.initialize() (runtime)
    ↓
Signals: supabaseUrl(), backendApiUrl(), etc.
```

**Fichiers clés:**
- `scripts/generate-config.ts:23-74` - Génère config.json depuis .env
- `application-configuration.ts:113-136` - Charge config.json via HTTP
- `config.schema.ts:49-355` - Double validation Zod (build + runtime)
- `playwright.config.ts:73` - Définit `DOTENV_CONFIG_PATH=.env.e2e`

### 2. Pattern E2EWindow Actuel

**Comment ça marche:**
```typescript
// E2E Test (Playwright)
await setupAuthBypass(page) {
  await page.addInitScript(() => {
    window.__E2E_AUTH_BYPASS__ = true;
    window.__E2E_MOCK_AUTH_STATE__ = { session, user, ... };
  });
}

// Application Code
if ((window as E2EWindow).__E2E_AUTH_BYPASS__) {
  return { success: true }; // Bypass auth
}
```

**Services utilisant E2EWindow:**
- `auth-session.service.ts:220-224` - `#isE2EBypass()`
- `auth-credentials.service.ts:90-95` - `#isE2EBypass()`
- `auth-oauth.service.ts:77-82` - `#isE2EBypass()`
- `demo-initializer.service.ts:48-54` - `__E2E_DEMO_BYPASS__`

**Fichiers de types:**
- `core/auth/e2e-window.ts` - Interface pour auth bypass
- `e2e/types/e2e.types.ts` - Interface complète avec demo bypass

---

## Codebase Context

### Environment Files (Minimalistes)

```typescript
// environment.ts
export const environment = {
  production: true,
};

// environment.development.ts
export const environment = {
  production: false,
};
```

**Usage:** Uniquement pour `enableProdMode()` dans `main.ts:7-9` et niveau de log dans `logger.ts:26-27`.

### Angular.json FileReplacements

```json
// angular.json:111-115
"development": {
  "fileReplacements": [{
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.development.ts"
  }]
}
```

**Constat:** Pas de configuration `e2e` dans fileReplacements → pas utilisé pour E2E.

### Playwright Configuration

```typescript
// playwright.config.ts:71-86
webServer: {
  command: `DOTENV_CONFIG_PATH=${path.resolve(__dirname, '.env.e2e')} pnpm run start:ci`,
  port: 4200,
  reuseExistingServer: !process.env.CI,
  env: {
    NODE_ENV: process.env.NODE_ENV || 'test',
  },
}
```

**Pattern:**
- Charge `.env.e2e` via `DOTENV_CONFIG_PATH`
- `generate-config.ts` lit ces vars et crée `config.json`
- App charge `config.json` au runtime

### E2E Auth Bypass Implementation

```typescript
// e2e/utils/auth-bypass.ts:16-59
export async function setupAuthBypass(
  page: Page,
  options: SetupAuthBypassOptions = {}
): Promise<void> {
  const { includeApiMocks = false, setLocalStorage = false } = options;

  await page.addInitScript((config) => {
    // Inject BEFORE app loads
    window.__E2E_AUTH_BYPASS__ = true;
    window.__E2E_MOCK_AUTH_STATE__ = {
      user: config.USER,
      session: {
        access_token: config.TOKENS.ACCESS_TOKEN,
        refresh_token: config.TOKENS.REFRESH_TOKEN,
        ...
      },
      isLoading: false,
      isAuthenticated: true,
    };
  }, TEST_CONFIG);

  if (setLocalStorage) {
    await page.addInitScript(() => {
      localStorage.setItem('dismiss-product-tour-main', 'true');
      // ... autres flags
    });
  }

  if (includeApiMocks) {
    await setupApiMocks(page);
  }
}
```

**Clés:**
- `page.addInitScript()` injecte AVANT que l'app charge
- Aucun code E2E n'est bundlé dans l'app
- Les services vérifient juste `window.__E2E_AUTH_BYPASS__`

### Config Schema with Test Environment

```typescript
// config.schema.ts:50-53
export const ENVIRONMENT = z.enum([
  'development',
  'production',
  'local',
  'test',  // ← Test environment supporté!
]);
```

**Opportunité:** Le schema supporte déjà `environment: 'test'`.

---

## Documentation Insights

### Angular Environment System

**Concept:** `fileReplacements` dans `angular.json` swap `environment.ts` avec `environment.<config>.ts` au build.

```bash
ng build --configuration e2e
# → Remplace environment.ts par environment.e2e.ts
```

**Limitations pour ce projet:**
1. ❌ Nécessiterait créer `environment.e2e.ts`
2. ❌ Dupliquerait la config déjà dans `.env.e2e` + `config.json`
3. ❌ Mélange compile-time (environment) et runtime (config.json)
4. ❌ Perte de flexibilité CI (changement d'env sans rebuild)

### Playwright Environment Variables

**Ce qui est automatique:**
- `PLAYWRIGHT_TEST=1` ajouté automatiquement par Playwright
- `NODE_ENV=test` peut être set via `webServer.env`

**Pattern recommandé (Angular + Playwright):**
```typescript
// playwright.config.ts
export default defineConfig({
  webServer: {
    command: 'ng serve --configuration e2e',
    env: {
      NODE_ENV: 'test',
      PLAYWRIGHT_TEST: '1',
    },
  },
});
```

**Problème pour notre projet:**
- On utilise déjà `DOTENV_CONFIG_PATH` (plus flexible)
- `--configuration e2e` nécessiterait fileReplacements dans angular.json
- Dupliquerait la logique `.env.e2e` existante

### Build-Time vs Runtime Config

| Aspect | Build-Time (fileReplacements) | Runtime (config.json) |
|--------|-------------------------------|----------------------|
| Quand | Pendant `ng build` | Après bootstrap app |
| Bundlé | Oui, dans le code | Non, HTTP fetch |
| Prod safe | Oui (exclu du build prod) | Oui (pas dans bundle) |
| Flexibilité CI | ❌ Rebuild requis | ✅ Change .env seulement |
| Performance | ✅ Pas de fetch | ❌ Petit overhead |

**Notre projet utilise Runtime** → Cohérent avec l'architecture actuelle.

---

## Research Findings

### Best Practice: Playwright Auth State Reuse

**Pattern recommandé 2025/2026:**
```typescript
// tests/global-setup.ts
export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Authenticate ONCE
  await page.goto('http://localhost:4200/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-btn"]');

  // Save state
  await page.context().storageState({
    path: 'playwright/.auth/user.json',
  });
  await browser.close();
}

// playwright.config.ts
export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  projects: [{
    name: 'authenticated',
    use: { storageState: 'playwright/.auth/user.json' },
  }],
});
```

**Pourquoi c'est mieux que notre E2EWindow:**
- ✅ Pas de code test dans l'app
- ✅ Plus proche du comportement utilisateur réel
- ✅ Moins fragile (teste vraiment l'auth)

**Pourquoi on ne l'utilise PAS:**
- ❌ Nécessite Supabase actif pour chaque test
- ❌ Plus lent (vraie auth vs mock)
- ❌ Complexe avec OAuth (Google signin)
- ❌ Tests actuels utilisent mocks API (`setupApiMocks()`)

**Notre use case:** Tester la **logique métier** pas le **flow auth**, donc mocks appropriés.

### Production Safety: Tree-Shaking

**ngDevMode Pattern (Angular):**
```typescript
import { ngDevMode } from '@angular/core';

if (ngDevMode) {
  console.warn('Dev warning');
  // ← Ce code est SUPPRIMÉ en production build
}
```

**Webpack elimine:**
- Blocs `if (ngDevMode) { ... }` automatiquement
- Imports non utilisés (tree-shaking)
- Dead code après AOT compilation

**Notre E2EWindow est-il tree-shakable?**

❌ **NON** - Voici pourquoi:
```typescript
// auth-session.service.ts
#isE2EBypass(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as E2EWindow).__E2E_AUTH_BYPASS__ === true
  );
}
```

Ce code vérifie une **propriété runtime** (`window.__E2E_AUTH_BYPASS__`), donc le compilateur ne peut pas l'éliminer.

**MAIS** ce n'est pas un problème car:
1. ✅ La propriété n'existe jamais en production (pas de `page.addInitScript()`)
2. ✅ Le code est minimal (1 check booléen)
3. ✅ Pas de secrets/credentials bundlés
4. ✅ Performance impact négligeable

### Alternative: HTTP Interceptor Pattern

**Pattern moderne:**
```typescript
// auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('auth-token');
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
  return next(req);
};
```

**E2E test setup:**
```typescript
await page.evaluate(() => {
  localStorage.setItem('auth-token', 'test-token-123');
});
```

**Avantage:** Aucun code E2E dans l'app.

**Inconvénient pour nous:**
- ❌ Nécessiterait refonte complète de l'auth
- ❌ On utilise Supabase SDK (pas juste HTTP)
- ❌ Mocks déjà en place fonctionnent bien

---

## Options Analysis

### Option 4: Environment Variables (ÉVALUÉ)

#### Approche A: fileReplacements Angular

**Implémentation:**
```typescript
// angular.json
"e2e": {
  "fileReplacements": [{
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.e2e.ts"
  }]
}

// environment.e2e.ts
export const environment = {
  production: false,
  e2eMode: true,  // ← Nouveau flag
};

// auth-session.service.ts
import { environment } from '@env/environment';

#isE2EBypass(): boolean {
  return environment.e2eMode === true;
}
```

**Playwright config:**
```typescript
webServer: {
  command: 'ng serve --configuration e2e',
}
```

**✅ Avantages:**
- Pas de `window` globals
- Code plus "Angular-natif"
- Tree-shakable avec fileReplacements

**❌ Inconvénients:**
- **MAJEUR:** Nécessite rebuild pour changer d'env
- **MAJEUR:** Duplique `.env.e2e` + `config.json` existants
- **MAJEUR:** Mélange compile-time et runtime config
- Perte de flexibilité CI (actuellement change juste DOTENV_CONFIG_PATH)
- Refonte architecture config existante

**Impact:** ~2-3 jours de travail

#### Approche B: Runtime Config with Test Flag

**Implémentation:**
```typescript
// config.schema.ts (DÉJÀ SUPPORTÉ!)
environment: z.enum(['development', 'production', 'local', 'test']),

// .env.e2e
PUBLIC_ENVIRONMENT=test  // ← Change juste ça

// auth-session.service.ts
readonly #config = inject(ApplicationConfiguration);

#isE2EBypass(): boolean {
  return this.#config.environment() === 'test';
}
```

**✅ Avantages:**
- ✅ Utilise l'infra existante
- ✅ Pas de rebuild nécessaire
- ✅ Cohérent avec runtime config pattern
- ✅ Flexibilité CI préservée
- ✅ Schema déjà supporte `test` environment

**⚠️ Inconvénients:**
- Toujours du code dans l'app (check runtime)
- Pas tree-shakable (comme E2EWindow actuel)
- Nécessite inject `ApplicationConfiguration` dans tous les services auth

**Impact:** ~1 jour de travail

#### Approche C: Playwright globalSetup (Best Practice)

**Implémentation:**
```typescript
// tests/global-setup.ts
export default async function() {
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/login');

  // VRAIE auth
  await page.fill('[data-testid="email"]', TEST_CONFIG.USER.EMAIL);
  await page.fill('[data-testid="password"]', 'test-password');
  await page.click('[data-testid="login-btn"]');

  await page.context().storageState({ path: 'playwright/.auth/user.json' });
}

// playwright.config.ts
projects: [{
  use: { storageState: 'playwright/.auth/user.json' },
}]
```

**Supprime:**
- ✅ Tout le code E2E de l'app
- ✅ E2EWindow interface
- ✅ `#isE2EBypass()` methods

**✅ Avantages:**
- ✅✅✅ ZERO code test dans l'app (idéal)
- ✅ Pattern 2025/2026 moderne
- ✅ Plus proche comportement utilisateur
- ✅ Teste vraiment le flow auth

**❌ Inconvénients:**
- **BLOQUANT:** Nécessite Supabase actif pour CHAQUE test
- **BLOQUANT:** Plus lent (vraie auth + vraies API calls)
- **BLOQUANT:** Complexe avec Google OAuth
- **BLOQUANT:** Perd les mocks API (`setupApiMocks()`)
- **BLOQUANT:** Tests actuels reposent sur mocks pour isolation

**Impact:** ~3-5 jours + performance dégradée

---

### Option 2 Améliorée: Déplacer et Améliorer

**Implémentation:**
```typescript
// core/testing/e2e-window.ts (déplacé de core/auth/)
export interface E2EWindow extends Window {
  __E2E_AUTH_BYPASS__?: boolean;
  __E2E_MOCK_AUTH_STATE__?: AuthState;
  __E2E_DEMO_BYPASS__?: boolean;
  __E2E_DEMO_SESSION__?: DemoSession;
}

// Ajouter utilitaire
export function isE2EMode(): boolean {
  return typeof window !== 'undefined' &&
         (window as E2EWindow).__E2E_AUTH_BYPASS__ === true;
}

// auth-session.service.ts
import { isE2EMode } from '@core/testing/e2e-window';

#isE2EBypass(): boolean {
  return isE2EMode();
}
```

**✅ Avantages:**
- ✅ Minimaliste (juste déplacer fichier)
- ✅ Meilleure organisation (testing vs auth)
- ✅ Centralise la logique E2E check
- ✅ Garde pattern actuel qui marche
- ✅ Production-safe (déjà vérifié)

**❌ Inconvénients:**
- Toujours du code dans bundle (mais minimal)
- Cross-domain import (`testing` → `auth`)

**Impact:** ~1-2 heures

---

## Recommendation

### ✅ RECOMMANDÉ: Option 2 Améliorée

**Raisons:**
1. **Minimal effort, maximum clarity** - Juste déplacer + centraliser
2. **Garde ce qui marche** - Pattern E2EWindow éprouvé
3. **Cohérent avec l'archi** - Pas de mélange compile/runtime config
4. **Production-safe** - Déjà vérifié, pas de bundling de secrets
5. **Flexibilité CI** - Garde `DOTENV_CONFIG_PATH` pattern

**Plan d'implémentation:**
1. Créer `core/testing/e2e-window.ts`
2. Déplacer interface `E2EWindow` + ajouter helper `isE2EMode()`
3. Update imports dans tous les services auth
4. Update `e2e/types/e2e.types.ts` pour réutiliser core type
5. Supprimer `core/auth/e2e-window.ts`

**Estimation:** 1-2 heures

### ⚠️ ALTERNATIVE: Option 4B (Runtime Config Flag)

**Si vraiment besoin d'éliminer E2EWindow:**
- Utiliser `ApplicationConfiguration.environment() === 'test'`
- Change juste `PUBLIC_ENVIRONMENT=test` dans `.env.e2e`
- Inject `ApplicationConfiguration` dans services auth

**Estimation:** 1 jour

**Trade-off:**
Pas vraiment plus "propre" que E2EWindow (toujours runtime check), mais plus "Angular-natif".

### ❌ NON RECOMMANDÉ: Option 4A (fileReplacements)

**Raisons:**
- Dupliquerait config existante
- Mélange compile-time et runtime
- Perte de flexibilité CI
- Refonte majeure

### ❌ NON RECOMMANDÉ: Option 4C (globalSetup)

**Raisons:**
- Nécessite Supabase pour tous les tests
- Perd isolation avec mocks API
- Plus lent
- Complexe OAuth

---

## Key Files to Modify (Option 2)

### Create
- `core/testing/e2e-window.ts` - Nouvelle location + helper

### Modify
- `core/auth/auth-session.service.ts:13` - Import path
- `core/auth/auth-credentials.service.ts` - Import path
- `core/auth/auth-oauth.service.ts` - Import path
- `core/demo/demo-initializer.service.ts` - Import path
- `e2e/types/e2e.types.ts` - Réutiliser core type au lieu de dupliquer

### Delete
- `core/auth/e2e-window.ts` - Ancien fichier

---

## Dependencies

Aucune nouvelle dépendance requise pour Option 2.

---

## Risks & Mitigation

**Option 2:**
- **Risque:** Import cross-domain (`testing` → utilisé dans `auth`)
- **Mitigation:** Acceptable car `testing` est un domaine transverse (comme `logging`)

**Option 4B:**
- **Risque:** Inject `ApplicationConfiguration` augmente coupling
- **Mitigation:** Créer service `TestModeDetector` qui wrap la logique

---

## Next Steps

1. **Décision:** Choisir entre Option 2 (recommandé) ou Option 4B
2. **Si Option 2:** Exécuter plan d'implémentation (1-2h)
3. **Si Option 4B:** Créer plan détaillé avec injection pattern
4. **Tests:** Vérifier tous les tests E2E passent après changement
5. **Documentation:** Update CLAUDE.md avec pattern choisi

---

## Sources

- [Angular Environments Documentation](https://angular.dev/tools/cli/environments)
- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
- [Playwright Best Practices 2026](https://www.browserstack.com/guide/playwright-best-practices)
- [Angular Tree Shaking Guide](https://medium.com/connected-things/angular-tree-shaking-a-comprehensive-guide)
- [Modern E2E Testing for Angular](https://angular.love/modern-e2e-testing-for-angular-apps-with-playwright/)
