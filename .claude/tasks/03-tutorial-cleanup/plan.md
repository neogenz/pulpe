# Implementation Plan: Tutorial System Cleanup

## Overview

Améliorer la qualité du code du système de tutoriel après le bugfix des event listeners :
1. Remplacer les `console.*` par le service `Logger`
2. Intégrer PostHog pour le tracking analytics
3. Extraire le magic number `setTimeout(800ms)` en constante

**Hors scope :** Le Help Menu reste statique (décision utilisateur).

## Dependencies

**Ordre d'implémentation :**
1. `tutorial.service.ts` - Logger + Analytics (cœur des changements)
2. `tutorial-configs.ts` - Logger pour les erreurs
3. `current-month.ts` - Extraction constante

Aucune nouvelle dépendance externe requise.

---

## File Changes

### `frontend/projects/webapp/src/app/core/tutorial/tutorial.service.ts`

**Action 1 : Injecter Logger et Analytics**
- Ajouter `import { Logger } from '@core/logging/logger';`
- Ajouter `import { Analytics } from '@core/analytics/analytics';`
- Ajouter `readonly #logger = inject(Logger);` après l'injection de ShepherdService
- Ajouter `readonly #analytics = inject(Analytics);` après Logger

**Action 2 : Remplacer console.error (5 occurrences)**
- Ligne 82-84 : `console.error('[TutorialService] Cannot register...')` → `this.#logger.error('Cannot register events: tourObject is null')`
- Ligne 147-150 : `console.error('[TutorialService] Failed to start tour...')` → `this.#logger.error('Failed to start tour', { tourId, error })`
- Ligne 171 : `console.error('[TutorialService] Error during tour cancellation...')` → `this.#logger.error('Error during tour cancellation', error)`
- Ligne 314-316 : `console.error('[TutorialService] Failed to load state...')` → `this.#logger.error('Failed to load state from localStorage', error)`
- Ligne 340-343 : `console.error('[TutorialService] Failed to save state...')` → `this.#logger.error('Failed to save state to localStorage', error)`

**Action 3 : Remplacer console.warn (1 occurrence)**
- Ligne 105 : `console.warn('[TutorialService] Tour not found...')` → `this.#logger.warn('Tour not found', { tourId })`

**Action 4 : Remplacer console.info (3 occurrences)**
- Ligne 111 : `console.info('[TutorialService] Tour already completed...')` → `this.#logger.info('Tour already completed', { tourId })`
- Ligne 117-119 : `console.info('[TutorialService] Tutorials are disabled...')` → `this.#logger.info('Tutorials are disabled by user preference')`
- Ligne 353 : `console.info('[TutorialService] Event:...')` → `this.#logger.debug('Tutorial event', event)` (debug car très verbeux)

**Action 5 : Intégrer PostHog dans #trackEvent()**
- Remplacer le TODO par l'appel Analytics
- Utiliser `this.#analytics.captureEvent()` avec mapping des actions :
  - `'started'` → `'tutorial_started'`
  - `'completed'` → `'tutorial_completed'`
  - `'cancelled'` → `'tutorial_cancelled'`
  - `'step_viewed'` → `'tutorial_step_viewed'`
- Garder le try-catch existant
- Remplacer `console.warn` du catch par `this.#logger.warn`

**Action 6 : Supprimer le commentaire TODO**
- Ligne 352 : Supprimer `// TODO: Integrate with PostHog or your analytics service`

---

### `frontend/projects/webapp/src/app/core/tutorial/tutorial-configs.ts`

**Action 1 : Importer Logger**
- Ce fichier contient des fonctions pures, pas un service injectable
- **Alternative :** Garder `console.error` pour ce fichier car :
  - Les erreurs ici sont critiques (element not found)
  - Injecter un service dans des fonctions utilitaires casserait le pattern
  - Ces erreurs indiquent des problèmes de DOM, pas de logique métier

**Décision :** Ne pas modifier ce fichier. Les `console.error` dans `waitForElement` et `createSafeBeforeShowPromise` sont appropriés pour des erreurs DOM de bas niveau.

---

### `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

**Action 1 : Extraire la constante**
- Ajouter en haut du fichier (après les imports, avant la classe) :
  ```
  /** Delay before starting tutorial to allow page to fully render */
  const TUTORIAL_START_DELAY_MS = 800;
  ```

**Action 2 : Utiliser la constante**
- Ligne 255 : Remplacer `setTimeout(() => { ... }, 800);` par `setTimeout(() => { ... }, TUTORIAL_START_DELAY_MS);`

**Action 3 : Supprimer le commentaire inline**
- Ligne 265 : Supprimer `// Delay to allow page to fully render` (redondant avec le nom de la constante)

---

## Testing Strategy

### Tests Existants
- Exécuter `pnpm test -- --filter tutorial.service` pour vérifier non-régression
- Les tests existants ne dépendent pas de console.* donc devraient passer

### Tests à Modifier

**`tutorial.service.spec.ts`**

- **Action :** Ajouter les mocks pour Logger et Analytics dans `createService()`
  - Ajouter mock Logger : `{ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }`
  - Ajouter mock Analytics : `{ captureEvent: vi.fn() }`
  - Ajouter dans providers du TestBed

- **Action :** Ajouter test pour vérifier l'appel Analytics
  - Test : "should track tutorial_completed event via Analytics when tour completes"
  - Capturer le handler complete, l'invoquer, vérifier `analytics.captureEvent` appelé avec `'tutorial_completed'`

### Vérification Manuelle
1. Démarrer l'app en mode dev
2. Ouvrir la console navigateur
3. Compléter un tour depuis le Help Menu
4. Vérifier : logs formatés avec timestamp (Logger)
5. Vérifier dans PostHog : événement `tutorial_completed` reçu

---

## Documentation

Aucune mise à jour requise. Changements internes sans impact API.

---

## Rollout Considerations

- **Breaking changes :** Aucun
- **Migration :** Aucune
- **Feature flags :** Non requis
- **Risque :** Faible - refactoring interne, tests existants couvrent la logique

---

## Summary Checklist

- [ ] Injecter Logger et Analytics dans TutorialService
- [ ] Remplacer 9 appels console.* par Logger dans tutorial.service.ts
- [ ] Implémenter PostHog tracking dans #trackEvent()
- [ ] Supprimer TODO comment
- [ ] Extraire TUTORIAL_START_DELAY_MS dans current-month.ts
- [ ] Ajouter mocks Logger/Analytics dans tests
- [ ] Ajouter test pour Analytics captureEvent
- [ ] Exécuter tests et vérification manuelle
