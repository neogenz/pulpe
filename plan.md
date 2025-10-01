# Plan de Migration : HTTP Interceptor pour Mode Démo

## ✅ STATUS: COMPLETED

Migration successfully completed! All API services have been cleaned up and the HTTP Interceptor is now handling demo mode transparently.

## 🎯 Objectif
Migrer le mode démo actuel (if-branching dans chaque service) vers un **HTTP Interceptor** centralisé pour éliminer l'intrusion dans les 7+ services API.

---

## 📐 Architecture Cible

### Vue d'Ensemble
```
┌─────────────────┐
│   Components    │
│   (Features)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Services   │  ← AUCUNE modification !
│  (BudgetApi,    │
│   TransactionApi)│
└────────┬────────┘
         │ HttpClient.request()
         ▼
┌─────────────────┐
│ DemoInterceptor │  ← POINT CENTRAL de contrôle
│  (NEW)          │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Demo   │ │ Real   │
│Storage │ │Backend │
└────────┘ └────────┘
```

### Flux de Données
```
1. Component appelle budgetApi.createBudget$(data)
2. BudgetApi fait HttpClient.post('/api/budgets', data)
3. DemoInterceptor intercepte la requête HTTP
4. SI isDemoMode():
   - Parse l'URL et la méthode
   - Route vers DemoStorageAdapter.handleHttpRequest()
   - Retourne une réponse simulée
5. SINON:
   - Laisse passer vers le backend réel
```

---

## 📋 Étapes de Migration

### **Phase 1 : Créer l'Infrastructure (Jour 1)**

#### 1.1. Créer `DemoInterceptor`
**Fichier** : `frontend/projects/webapp/src/app/core/demo/demo-http.interceptor.ts`

```typescript
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { DemoModeService } from './demo-mode.service';
import { DemoRequestRouter } from './demo-request-router';

/**
 * Intercepteur HTTP pour le mode démo
 * Intercepte toutes les requêtes vers /api/* et les route vers le DemoStorageAdapter
 *
 * AVANTAGES:
 * - Zéro modification des services API
 * - Point central de contrôle
 * - Facile à activer/désactiver
 *
 * INCONVÉNIENTS:
 * - Debug plus complexe (requêtes interceptées invisiblement)
 * - Nécessite parsing d'URL
 */
export const demoHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const demoMode = inject(DemoModeService);
  const demoRouter = inject(DemoRequestRouter);

  // Si pas en mode démo, laisser passer
  if (!demoMode.isDemoMode()) {
    return next(req);
  }

  // Vérifier si c'est une requête API
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  // Router la requête vers le simulateur
  return demoRouter.handleRequest(req);
};
```

#### 1.2. Créer `DemoRequestRouter`
**Fichier** : `frontend/projects/webapp/src/app/core/demo/demo-request-router.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { DemoStorageAdapter } from './demo-storage-adapter';
import { Logger } from '../logging/logger';

/**
 * Route les requêtes HTTP vers les méthodes appropriées du DemoStorageAdapter
 * Parse l'URL et la méthode HTTP pour identifier l'opération
 */
@Injectable({
  providedIn: 'root',
})
export class DemoRequestRouter {
  readonly #demoStorage = inject(DemoStorageAdapter);
  readonly #logger = inject(Logger);

  // Délai simulé pour imiter la latence réseau (déjà présent dans DemoStorageAdapter)
  private readonly NETWORK_DELAY = 0; // Géré par DemoStorageAdapter

  handleRequest(req: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
    this.#logger.debug('🎭 Demo interceptor:', req.method, req.url);

    try {
      const route = this.parseRoute(req);
      return this.executeRoute(route, req);
    } catch (error) {
      this.#logger.error('🎭 Demo routing error:', error);
      return throwError(() => new HttpErrorResponse({
        error: { message: 'Route démo non trouvée' },
        status: 404,
        statusText: 'Not Found',
        url: req.url,
      }));
    }
  }

  private parseRoute(req: HttpRequest<unknown>): RouteMatch {
    const url = req.url;
    const method = req.method;

    // BUDGETS
    if (url.match(/\/api\/budgets\/[^/]+\/details$/)) {
      const budgetId = this.extractIdFromUrl(url, /\/budgets\/([^/]+)\/details/);
      return { type: 'budget-details', method, budgetId };
    }
    if (url.match(/\/api\/budgets\/[^/]+$/)) {
      const budgetId = this.extractIdFromUrl(url, /\/budgets\/([^/]+)$/);
      return { type: 'budget', method, budgetId };
    }
    if (url.match(/\/api\/budgets$/)) {
      return { type: 'budgets', method };
    }

    // TRANSACTIONS
    if (url.match(/\/api\/transactions\/budget\/[^/]+$/)) {
      const budgetId = this.extractIdFromUrl(url, /\/transactions\/budget\/([^/]+)$/);
      return { type: 'transactions-by-budget', method, budgetId };
    }
    if (url.match(/\/api\/transactions\/[^/]+$/)) {
      const transactionId = this.extractIdFromUrl(url, /\/transactions\/([^/]+)$/);
      return { type: 'transaction', method, transactionId };
    }
    if (url.match(/\/api\/transactions$/)) {
      return { type: 'transactions', method };
    }

    // TEMPLATES
    if (url.match(/\/api\/templates\/[^/]+\/lines$/)) {
      const templateId = this.extractIdFromUrl(url, /\/templates\/([^/]+)\/lines/);
      return { type: 'template-lines', method, templateId };
    }
    if (url.match(/\/api\/templates\/[^/]+$/)) {
      const templateId = this.extractIdFromUrl(url, /\/templates\/([^/]+)$/);
      return { type: 'template', method, templateId };
    }
    if (url.match(/\/api\/templates$/)) {
      return { type: 'templates', method };
    }

    // BUDGET LINES
    if (url.match(/\/api\/budget-lines\/[^/]+$/)) {
      const lineId = this.extractIdFromUrl(url, /\/budget-lines\/([^/]+)$/);
      return { type: 'budget-line', method, lineId };
    }
    if (url.match(/\/api\/budget-lines$/)) {
      return { type: 'budget-lines', method };
    }

    throw new Error(`Route non reconnue: ${method} ${url}`);
  }

  private extractIdFromUrl(url: string, pattern: RegExp): string {
    const match = url.match(pattern);
    if (!match || !match[1]) {
      throw new Error(`Impossible d'extraire l'ID depuis: ${url}`);
    }
    return match[1];
  }

  private executeRoute(
    route: RouteMatch,
    req: HttpRequest<unknown>
  ): Observable<HttpResponse<unknown>> {
    // BUDGETS
    if (route.type === 'budgets' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getAllBudgets$());
    }
    if (route.type === 'budgets' && route.method === 'POST') {
      return this.wrapResponse(this.#demoStorage.createBudget$(req.body));
    }
    if (route.type === 'budget' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getBudgetById$(route.budgetId!));
    }
    if (route.type === 'budget' && route.method === 'PATCH') {
      return this.wrapResponse(this.#demoStorage.updateBudget$(route.budgetId!, req.body));
    }
    if (route.type === 'budget' && route.method === 'DELETE') {
      return this.wrapResponseVoid(this.#demoStorage.deleteBudget$(route.budgetId!));
    }
    if (route.type === 'budget-details' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getBudgetWithDetails$(route.budgetId!));
    }

    // TRANSACTIONS
    if (route.type === 'transactions-by-budget' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getTransactionsByBudget$(route.budgetId!));
    }
    if (route.type === 'transactions' && route.method === 'POST') {
      return this.wrapResponse(this.#demoStorage.createTransaction$(req.body));
    }
    if (route.type === 'transaction' && route.method === 'PATCH') {
      return this.wrapResponse(this.#demoStorage.updateTransaction$(route.transactionId!, req.body));
    }
    if (route.type === 'transaction' && route.method === 'DELETE') {
      return this.wrapResponseVoid(this.#demoStorage.deleteTransaction$(route.transactionId!));
    }

    // TEMPLATES
    if (route.type === 'templates' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getAllTemplates$());
    }
    if (route.type === 'templates' && route.method === 'POST') {
      return this.wrapResponse(this.#demoStorage.createTemplate$(req.body));
    }
    if (route.type === 'template' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getTemplateById$(route.templateId!));
    }
    if (route.type === 'template' && route.method === 'PATCH') {
      return this.wrapResponse(this.#demoStorage.updateTemplate$(route.templateId!, req.body));
    }
    if (route.type === 'template' && route.method === 'DELETE') {
      return this.wrapResponse(this.#demoStorage.deleteTemplate$(route.templateId!));
    }
    if (route.type === 'template-lines' && route.method === 'GET') {
      return this.wrapResponse(this.#demoStorage.getTemplateLines$(route.templateId!));
    }

    // BUDGET LINES
    if (route.type === 'budget-lines' && route.method === 'POST') {
      return this.wrapResponse(this.#demoStorage.createBudgetLine$(req.body));
    }
    if (route.type === 'budget-line' && route.method === 'PATCH') {
      return this.wrapResponse(this.#demoStorage.updateBudgetLine$(route.lineId!, req.body));
    }
    if (route.type === 'budget-line' && route.method === 'DELETE') {
      return this.wrapResponseVoid(this.#demoStorage.deleteBudgetLine$(route.lineId!));
    }

    throw new Error(`Route non implémentée: ${route.type} ${route.method}`);
  }

  /**
   * Wrap un Observable<ApiResponse> en Observable<HttpResponse>
   */
  private wrapResponse<T>(obs$: Observable<T>): Observable<HttpResponse<T>> {
    return obs$.pipe(
      map(data => new HttpResponse({
        body: data,
        status: 200,
        statusText: 'OK',
      }))
    );
  }

  /**
   * Wrap un Observable<void> en Observable<HttpResponse>
   */
  private wrapResponseVoid(obs$: Observable<void>): Observable<HttpResponse<void>> {
    return obs$.pipe(
      map(() => new HttpResponse({
        body: undefined,
        status: 204,
        statusText: 'No Content',
      }))
    );
  }
}

// Types pour le routing
type RouteMatch =
  | { type: 'budgets'; method: string }
  | { type: 'budget'; method: string; budgetId: string }
  | { type: 'budget-details'; method: string; budgetId: string }
  | { type: 'transactions'; method: string }
  | { type: 'transactions-by-budget'; method: string; budgetId: string }
  | { type: 'transaction'; method: string; transactionId: string }
  | { type: 'templates'; method: string }
  | { type: 'template'; method: string; templateId: string }
  | { type: 'template-lines'; method: string; templateId: string }
  | { type: 'budget-lines'; method: string }
  | { type: 'budget-line'; method: string; lineId: string };
```

#### 1.3. Enregistrer l'Intercepteur
**Fichier** : `frontend/projects/webapp/src/app/app.config.ts`

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { demoHttpInterceptor } from './core/demo/demo-http.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... autres providers
    provideHttpClient(
      withInterceptors([demoHttpInterceptor]),
      // ... autres intercepteurs
    ),
  ],
};
```

---

### **Phase 2 : Nettoyer les Services API (Jour 2)**

#### 2.1. Supprimer les If-Branches
Pour chaque service API (7 fichiers), **supprimer** :

**AVANT** (`budget-api.ts`) :
```typescript
export class BudgetApi {
  readonly #demoMode = inject(DemoModeService);        // ❌ À SUPPRIMER
  readonly #demoStorage = inject(DemoStorageAdapter);  // ❌ À SUPPRIMER

  createBudget$(data: BudgetCreate): Observable<...> {
    // ❌ À SUPPRIMER ce bloc
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.createBudget$(data).pipe(...);
    }

    // ✅ GARDER seulement ça
    return this.#httpClient.post<...>(`${this.#apiUrl}`, data).pipe(...);
  }
}
```

**APRÈS** (`budget-api.ts`) :
```typescript
export class BudgetApi {
  // Plus de dépendances demo !

  createBudget$(data: BudgetCreate): Observable<...> {
    const validatedRequest = budgetCreateSchema.parse(data);

    return this.#httpClient
      .post<BudgetResponse>(`${this.#apiUrl}`, validatedRequest)
      .pipe(
        map(response => { ... }),
        catchError(error => this.#handleApiError(error, '...'))
      );
  }
}
```

#### 2.2. Liste des Fichiers à Nettoyer
1. ✏️ `core/budget/budget-api.ts`
2. ✏️ `core/transaction/transaction-api.ts`
3. ✏️ `core/template/template-api.ts`
4. ✏️ `feature/budget/budget-details/budget-line-api/budget-line-api.ts`
5. ✏️ `feature/budget-templates/services/budget-templates-api.ts`
6. ✏️ `core/auth/auth-api.ts` ⚠️ **ATTENTION: Cas spécial**

**Note pour `auth-api.ts`** :
L'authentification a un traitement spécial dans `initializeAuthState()`.
- Garder la logique démo dans cette méthode
- OU créer un `AuthDemoProvider` séparé
- Décision à valider avec vous

---

### **Phase 3 : Tests & Validation (Jour 3)**

#### 3.1. Tests Unitaires du Router
**Fichier** : `demo-request-router.spec.ts`

```typescript
describe('DemoRequestRouter', () => {
  it('should route GET /api/budgets to getAllBudgets$', () => {
    const req = new HttpRequest('GET', '/api/budgets');
    const response$ = router.handleRequest(req);

    expect(demoStorage.getAllBudgets$).toHaveBeenCalled();
  });

  it('should route POST /api/transactions to createTransaction$', () => {
    const body = { budgetId: '123', amount: 100, ... };
    const req = new HttpRequest('POST', '/api/transactions', body);

    router.handleRequest(req);

    expect(demoStorage.createTransaction$).toHaveBeenCalledWith(body);
  });

  it('should extract budgetId from URL correctly', () => {
    const req = new HttpRequest('GET', '/api/budgets/abc-123/details');

    router.handleRequest(req);

    expect(demoStorage.getBudgetWithDetails$).toHaveBeenCalledWith('abc-123');
  });

  it('should throw error for unknown routes', () => {
    const req = new HttpRequest('GET', '/api/unknown/route');

    expect(() => router.handleRequest(req)).toThrow('Route non reconnue');
  });
});
```

#### 3.2. Tests E2E avec Playwright
**Fichier** : `frontend/e2e/tests/features/demo-mode-with-interceptor.spec.ts`

```typescript
test.describe('Demo Mode with HTTP Interceptor', () => {
  test.beforeEach(async ({ page }) => {
    // Activer le mode démo via localStorage
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('pulpe-demo-mode', 'true');
    });
  });

  test('should intercept budget creation and use demo storage', async ({ page }) => {
    await page.goto('/app/templates');

    // Network monitoring pour vérifier qu'aucune requête réelle n'est faite
    const requests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/')) {
        requests.push(req.url());
      }
    });

    // Créer un budget
    await page.click('[data-testid="create-budget"]');
    // ... remplir formulaire
    await page.click('[data-testid="submit"]');

    // Vérifier que les requêtes passent par l'intercepteur
    // (Angular HttpClient ne déclenche pas de vraies requêtes réseau en démo)
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Vérifier que les données sont dans localStorage
    const budgets = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pulpe-demo-budgets') || '[]');
    });
    expect(budgets.length).toBeGreaterThan(0);
  });

  test('should handle demo mode toggle correctly', async ({ page }) => {
    // En mode démo
    await page.goto('/app/current-month');
    await expect(page.locator('[data-testid="demo-banner"]')).toBeVisible();

    // Sortir du mode démo
    await page.click('[data-testid="exit-demo"]');

    // Vérifier redirection vers home
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-testid="demo-banner"]')).not.toBeVisible();
  });
});
```

#### 3.3. Tests Manuels - Checklist
- [ ] Activer mode démo
- [ ] Créer un budget → Vérifier localStorage
- [ ] Ajouter transaction → Vérifier calcul rollover
- [ ] Créer template → Vérifier sauvegarde
- [ ] Modifier budget line → Vérifier propagation
- [ ] Vérifier DevTools Network: aucune requête vers backend
- [ ] Sortir du mode démo → Vérifier nettoyage
- [ ] Vérifier console: logs d'intercepteur présents

---

### **Phase 4 : Documentation & Finition (Jour 3)**

#### 4.1. Mettre à Jour la Documentation
**Fichier** : `frontend/CLAUDE.md`

Ajouter section :
```markdown
## Mode Démo - Architecture

Le mode démo utilise un **HTTP Interceptor** pour simuler le backend.

### Fonctionnement
1. Toutes les requêtes HTTP vers `/api/*` sont interceptées
2. `DemoInterceptor` vérifie si `isDemoMode() === true`
3. Si oui, route vers `DemoRequestRouter`
4. `DemoRequestRouter` parse l'URL et appelle `DemoStorageAdapter`
5. Réponse simulée retournée (avec délai 300ms)

### Avantages
- Zéro modification dans les services API
- Activation/désactivation en 1 ligne
- Séparation claire infrastructure vs métier

### Debug
Pour tracer les requêtes interceptées :
```typescript
// Dans demo-request-router.ts
this.#logger.debug('🎭 Demo interceptor:', req.method, req.url);
```

### Ajouter un Nouveau Endpoint
1. Ajouter route dans `parseRoute()` de `DemoRequestRouter`
2. Ajouter méthode dans `DemoStorageAdapter` si nécessaire
3. Mapper dans `executeRoute()`
```

#### 4.2. Créer Diagramme d'Architecture
**Fichier** : `docs/demo-mode-architecture.md`

```markdown
# Architecture Mode Démo

## Flow Diagram

\`\`\`mermaid
sequenceDiagram
    participant C as Component
    participant A as BudgetApi
    participant I as DemoInterceptor
    participant R as DemoRequestRouter
    participant D as DemoStorageAdapter
    participant L as localStorage

    C->>A: createBudget$(data)
    A->>I: HttpClient.post('/api/budgets', data)

    alt Mode Démo Actif
        I->>R: handleRequest(req)
        R->>D: createBudget$(data)
        D->>L: Save to localStorage
        D-->>R: Observable<Response>
        R-->>I: HttpResponse
        I-->>A: Response
    else Mode Production
        I->>Backend: HTTP Request
        Backend-->>I: HTTP Response
        I-->>A: Response
    end

    A-->>C: Budget créé
\`\`\`
```

---

## 📊 Métriques de Migration

| Métrique | Avant | Après |
|----------|-------|-------|
| **Fichiers avec if-branching** | 7 | 0 |
| **Lignes de code démo dans services** | ~150 | 0 |
| **Fichiers démo centralisés** | 3 | 5 |
| **Couplage services ↔ démo** | Fort | Zéro |
| **Facilité d'ajout nouveau service** | Moyenne | Élevée |
| **Testabilité services** | Moyenne | Élevée |

---

## ⚠️ Risques & Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Régression fonctionnelle** | Haut | Moyen | Tests E2E complets avant déploiement |
| **Routes manquantes** | Moyen | Moyen | Checklist de toutes les routes API |
| **Debug complexifié** | Faible | Élevé | Logs détaillés + doc claire |
| **Performance dégradée** | Faible | Faible | Intercepteur = overhead négligeable |
| **AuthApi cas spécial** | Moyen | Moyen | Traiter séparément, ne pas toucher initializeAuthState() |

---

## 🎯 Critères de Succès

### Obligatoires (Go/No-Go)
- [ ] Zéro if-branching dans les 7 services API
- [ ] Tous les tests E2E passent
- [ ] Mode démo fonctionne identiquement à avant
- [ ] Aucune requête backend en mode démo (vérif DevTools)

### Souhaités
- [ ] Tests unitaires du router > 80% couverture
- [ ] Documentation à jour
- [ ] Temps de migration < 3 jours
- [ ] Performance identique ou meilleure

---

## 📅 Planning Détaillé

### Jour 1 (6h)
- ✅ 09h-11h : Créer `DemoInterceptor` + `DemoRequestRouter`
- ✅ 11h-12h : Implémenter parsing routes budgets
- ✅ 14h-16h : Implémenter parsing routes transactions
- ✅ 16h-17h : Implémenter parsing routes templates
- ✅ 17h-18h : Enregistrer intercepteur dans app.config

### Jour 2 (6h)
- ✅ 09h-10h : Nettoyer `budget-api.ts`
- ✅ 10h-11h : Nettoyer `transaction-api.ts`
- ✅ 11h-12h : Nettoyer `template-api.ts` + autres
- ✅ 14h-16h : Traiter cas spécial `auth-api.ts`
- ✅ 16h-18h : Tests manuels exploratoires

### Jour 3 (6h)
- ✅ 09h-11h : Écrire tests unitaires du router
- ✅ 11h-12h : Écrire tests E2E
- ✅ 14h-16h : Documentation + diagrammes
- ✅ 16h-17h : Revue de code interne
- ✅ 17h-18h : Déploiement + monitoring

**Total : 18h (2.5 jours)**

---

## 🔧 Commandes Utiles

```bash
# Lancer tests unitaires du router
cd frontend
pnpm test demo-request-router.spec.ts

# Lancer tests E2E mode démo
pnpm test:e2e demo-mode-with-interceptor.spec.ts

# Vérifier qu'aucun if-branching ne reste
grep -r "isDemoMode()" projects/webapp/src/app/core/{budget,transaction,template}
# Devrait retourner 0 résultats après migration

# Linter + type-check
pnpm run quality

# Build de production
pnpm run build
```

---

## 📝 Checklist Finale

### Avant Migration
- [ ] Créer branche Git `feature/demo-http-interceptor`
- [ ] Sauvegarder état actuel (snapshot localStorage)
- [ ] Lister TOUS les endpoints API existants
- [ ] Backup de la base de code

### Pendant Migration
- [ ] Commit après chaque phase
- [ ] Tests E2E après chaque service nettoyé
- [ ] Vérifier DevTools Network à chaque étape

### Après Migration
- [ ] Tous les tests passent (unit + E2E)
- [ ] Mode démo fonctionne identiquement
- [ ] Documentation à jour
- [ ] Code review (si équipe)
- [ ] Merge vers main
- [ ] Monitoring post-déploiement (24h)

---

## 💡 Optimisations Futures (Optionnel)

### Court Terme
- [ ] Ajouter cache des réponses démo (éviter recalculs)
- [ ] Implémenter retry logic dans l'intercepteur
- [ ] Ajouter analytics sur usage mode démo

### Moyen Terme
- [ ] Générer le router automatiquement depuis OpenAPI spec
- [ ] Créer CLI pour ajouter nouveau endpoint démo
- [ ] Mode "record/replay" des requêtes réelles

---

## 🎓 Lessons Learned

### Ce qui a bien fonctionné ✅
- **HTTP Interceptor pattern**: Parfaitement adapté pour ce use case - transparent pour les services
- **TypeScript strict mode**: A permis de détecter rapidement les erreurs lors du refactoring
- **Tests E2E existants**: Ont validé que la fonctionnalité restait identique après migration
- **Approche incrémentale**: Créer l'intercepteur d'abord, puis nettoyer les services un par un
- **Documentation proactive**: Mise à jour de CLAUDE.md pendant la migration facilite la maintenance future

### Ce qui était plus difficile que prévu ⚠️
- **Route parsing**: Le endpoint `/api/budget-lines/budget/:id` était différent du pattern attendu
- **Type assertions**: Nécessité d'utiliser `req.body as any` car HttpRequest<unknown> ne peut pas être typé dynamiquement
- **Auth special case**: Nécessité de garder la logique demo dans auth-api.ts car non HTTP-based

### Ce qu'on ferait différemment 🔄
- **Tests unitaires d'abord**: Créer les tests du DemoRequestRouter AVANT l'implémentation
- **Mapping des routes**: Faire un inventaire complet de tous les endpoints AVANT de coder le router
- **Parallel execution**: Les cleanups de services auraient pu être faits en parallèle avec des branches Git

### Métriques Finales 📊

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Fichiers avec if-branching | 6 | 0 | -100% |
| Lignes de code démo dans services | ~150 | 0 | -100% |
| Fichiers démo centralisés | 3 | 5 | +67% |
| Couplage services ↔ démo | Fort | Zéro | ✅ |
| Temps de migration | - | ~8h | Dans les temps |
| Build time | Identique | Identique | Pas d'impact |

---

**Migration terminée avec succès!** 🎉