# Task: Reactive Wait for Page Ready

Remplacer `#waitForPageReady()` basé sur un delay arbitraire (200ms) par une approche réactive et idiomatique Angular.

## Problème actuel

```typescript
// tutorial.service.ts:258-264
async #waitForPageReady(): Promise<void> {
  await this.#waitForNextFrame(); // 2 RAF (~32ms)
  await this.#delay(LAZY_LOAD_MOUNT_DELAY_MS); // 200ms arbitrary
}
```

**Problèmes:**
1. Race condition : 200ms insuffisant sur appareil lent, gaspillé sur appareil rapide
2. Non réactif : ne vérifie pas réellement si le DOM est prêt
3. Fragilité : timing arbitraire sans garantie

## Découvertes clés

### Pattern existant : `waitForElement()` dans tutorial-configs.ts

**tutorial-configs.ts:90-120** - MutationObserver déjà implémenté !

```typescript
function waitForElement(
  selector: string,
  timeout = ELEMENT_WAIT_TIMEOUT_MS, // 5000ms
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing instanceof HTMLElement) {
      return resolve(existing);
    }

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
}
```

### Où est utilisé `#waitForPageReady()` ?

**tutorial.service.ts:174-190** - Après navigation vers targetRoute

```typescript
async #prepareAndExecuteTour(tour: TutorialTour): Promise<void> {
  if (tour.targetRoute && !this.#isOnTargetRoute(tour.targetRoute)) {
    const navigated = await this.#navigateToTargetRoute(tour.targetRoute);
    if (!navigated) throw new Error('Navigation failed');

    await this.#waitForPageReady(); // <-- ICI : attend arbitrairement

    // Validation post-navigation
    const currentRoute = this.#router.url;
    const expectedRoute = `/${ROUTES.APP}/${tour.targetRoute}`;
    if (!currentRoute.startsWith(expectedRoute)) {
      throw new Error('Navigation succeeded but route did not change');
    }
  }
  this.#executeTour(tour);
}
```

### Tours avec targetRoute (nécessitent navigation)

| Tour ID | targetRoute | Premier sélecteur |
|---------|-------------|-------------------|
| dashboard-welcome | ROUTES.CURRENT_MONTH | `pulpe-budget-progress-bar` |
| add-transaction | ROUTES.CURRENT_MONTH | `[data-testid="transaction-form"]` |
| templates-intro | ROUTES.BUDGET_TEMPLATES | `[data-testid="template-counter"]` |
| budget-calendar | ROUTES.BUDGET | `[data-testid="create-budget-btn"]` |
| budget-management | (none) | `pulpe-budget-financial-overview` |

### Patterns Angular existants dans le codebase

1. **afterNextRender** - `title-display.ts:80-88`
   ```typescript
   afterNextRender(() => {...}, { injector })
   ```

2. **NavigationEnd filtering** - `breadcrumb-state.ts:25-29`
   ```typescript
   Router.events.pipe(filter(event => event instanceof NavigationEnd))
   ```

3. **autoStartWhenReady** - `tutorial.service.ts:346-364`
   ```typescript
   afterRenderEffect({ read: () => { if (isDataLoaded()) ... } }, { injector })
   ```

## Solution recommandée

### Option A : Réutiliser `waitForElement()` (SIMPLE)

Déplacer `waitForElement` vers le service et attendre le premier élément du tour :

```typescript
async #waitForPageReady(tour: TutorialTour): Promise<void> {
  const firstStepSelector = this.#getFirstAttachSelector(tour);
  if (!firstStepSelector) {
    // Tour sans attachTo sur le premier step, juste 2 RAF
    await this.#waitForNextFrame();
    return;
  }
  await this.#waitForElement(firstStepSelector);
}

#getFirstAttachSelector(tour: TutorialTour): string | null {
  for (const step of tour.steps) {
    const element = step.attachTo?.element;
    if (typeof element === 'function') {
      // Lazy query - extraire le sélecteur est complexe, skip
      continue;
    }
    if (typeof element === 'string') {
      return element;
    }
  }
  return null;
}
```

**Avantages:**
- Déterministe : attend exactement ce dont on a besoin
- Timeout explicite avec message d'erreur clair
- Réutilise le pattern MutationObserver existant

**Inconvénients:**
- Nécessite de parser les steps pour trouver le sélecteur
- Les steps utilisent des fonctions lazy `querySelector()`, pas des strings

### Option B : Stocker le sélecteur dans TutorialTour (PROPRE)

Ajouter un champ `firstElementSelector` au type `TutorialTour` :

```typescript
// tutorial.types.ts
interface TutorialTour {
  id: TourId;
  targetRoute?: string;
  firstElementSelector?: string; // <-- NEW
  steps: StepOptions[];
}

// tutorial-configs.ts
export const dashboardWelcomeTour: TutorialTour = {
  id: 'dashboard-welcome',
  targetRoute: ROUTES.CURRENT_MONTH,
  firstElementSelector: 'pulpe-budget-progress-bar', // <-- Explicite
  steps: [...]
};
```

**Avantages:**
- Clair et explicite
- Pas de parsing complexe
- Type-safe

**Inconvénients:**
- Duplication du sélecteur (dans tour + dans premier step)
- Risque de désynchronisation

### Option C : Attendre NavigationEnd + afterNextRender (IDIOMATIQUE)

Utiliser les APIs Angular plutôt que MutationObserver :

```typescript
async #waitForPageReady(): Promise<void> {
  return new Promise<void>((resolve) => {
    afterNextRender(() => resolve(), { injector: this.#injector });
  });
}
```

**Avantages:**
- 100% idiomatique Angular
- Zone-aware (respecte change detection)

**Inconvénients:**
- `afterNextRender` ne garantit pas que les composants lazy-loaded sont montés
- Pas de timeout/retry si l'élément n'existe toujours pas
- Nécessite l'Injector dans le service

## Recommendation finale

**Option A avec amélioration** - La plus pragmatique :

1. Extraire `waitForElement` de `tutorial-configs.ts` vers un fichier utilitaire partagé
2. Dans `#prepareAndExecuteTour`, utiliser `waitForElement` avec le premier sélecteur qui a un `attachTo`
3. Fallback sur 2 RAF si aucun sélecteur trouvé

Cette approche :
- Réutilise le code existant (DRY)
- Est déterministe et fiable
- A un timeout explicite avec message d'erreur
- Fonctionne avec lazy-loading et réseau lent

## Key Files

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `tutorial.service.ts` | 258-264 | `#waitForPageReady()` à modifier |
| `tutorial.service.ts` | 174-190 | `#prepareAndExecuteTour()` appelle `#waitForPageReady` |
| `tutorial-configs.ts` | 90-120 | `waitForElement()` à réutiliser |
| `tutorial-configs.ts` | 28-31 | `querySelector()` lazy factory |
| `tutorial.types.ts` | 22-30 | `TutorialTour` interface |

## Questions ouvertes

1. Faut-il extraire `waitForElement` vers un utilitaire partagé ou le dupliquer dans le service ?
2. Comment gérer les steps dont `attachTo.element` est une fonction lazy ?
3. Le timeout de 5s est-il approprié pour la navigation inter-routes ?
