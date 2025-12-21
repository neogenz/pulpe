# Architecture Analysis: Systeme de Tutoriel Pulpe

> **Issue**: #109 - Tutorial System
> **Branche**: `feature/109-tutorial-system`

## Vue d'ensemble

Le systeme de tutoriel est implemente avec **Shepherd.js** via `angular-shepherd` et suit l'architecture Angular standalone avec signals. L'architecture est bien structuree, respectant les principes du projet (KISS, YAGNI, isolation des features).

---

## Diagramme d'Architecture Global

```
+-----------------------------------------------------------------------------+
|                           LAYER: Core (eager-loaded)                        |
|                                                                              |
|   +----------------------------------------------------------------------+  |
|   |                    core/tutorial/                                     |  |
|   |                                                                       |  |
|   |  +---------------------+   +---------------------+                   |  |
|   |  | tutorial.service.ts |   | tutorial.types.ts   |                   |  |
|   |  |                     |   |                     |                   |  |
|   |  | - Signal state      |   | - TourId type       |                   |  |
|   |  | - startTour()       |   | - TutorialState     |                   |  |
|   |  | - cancelTour()      |   | - TutorialTour      |                   |  |
|   |  | - hasSeenTour()     |   | - TutorialEvent     |                   |  |
|   |  | - localStorage      |   | - TOUR_IDS array    |                   |  |
|   |  | - PostHog tracking  |   |                     |                   |  |
|   |  +----------+----------+   +---------------------+                   |  |
|   |             |                                                          |  |
|   |             v                                                          |  |
|   |  +---------------------+                                             |  |
|   |  | tutorial-configs.ts |                                             |  |
|   |  |                     |                                             |  |
|   |  | - dashboardWelcome  |                                             |  |
|   |  | - addTransaction    |                                             |  |
|   |  | - templatesIntro    |                                             |  |
|   |  | - budgetManagement  |                                             |  |
|   |  | - budgetCalendar    |                                             |  |
|   |  | - defaultStepOptions|                                             |  |
|   |  +---------------------+                                             |  |
|   +----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
                                     |
                                     | inject()
                                     v
+-----------------------------------------------------------------------------+
|                       LAYER: Layout (eager-loaded)                          |
|                                                                              |
|   +----------------------------------------------------------------------+  |
|   |                    layout/main-layout.ts                              |  |
|   |                                                                       |  |
|   |  - Help Menu avec helpMenuItems array dynamique                      |  |
|   |  - tutorialService.startTour('tour-id', { force: true })             |  |
|   |  - tutorialService.resetAllTours()                                   |  |
|   |  - Toggle auto-start tutorials preference                            |  |
|   +----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
                                     |
                                     | router-outlet
                                     v
+-----------------------------------------------------------------------------+
|                       LAYER: Feature (lazy-loaded)                          |
|                                                                              |
|   +----------------------------------------------------------------------+  |
|   |                 feature/current-month/current-month.ts                |  |
|   |                                                                       |  |
|   |  constructor() {                                                      |  |
|   |    afterRenderEffect(() => {                                         |  |
|   |      if (hasLoadedData && !hasSeenTour('dashboard-welcome')) {       |  |
|   |        this.#tutorialService.startTour('dashboard-welcome');         |  |
|   |      }                                                                |  |
|   |    });                                                               |  |
|   |  }                                                                    |  |
|   +----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
                                     |
                                     | data-testid selectors
                                     v
+-----------------------------------------------------------------------------+
|                       LAYER: Styles (global)                                |
|                                                                              |
|   +----------------------------------------------------------------------+  |
|   |            styles/components/_shepherd-theme.scss                     |  |
|   |                                                                       |  |
|   |  - Material Design 3 theming                                         |  |
|   |  - CSS variables (--mat-sys-*, --tutorial-*)                         |  |
|   |  - Responsive mobile/desktop                                         |  |
|   |  - Accessibility (reduced motion, focus states)                      |  |
|   |  - Dark theme support                                                |  |
|   +----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

---

## Patterns Architecturaux Identifies

### 1. Signal-Based State Management

Le `TutorialService` utilise des Angular signals pour la gestion d'etat reactive.

**Ou**: `core/tutorial/tutorial.service.ts:72-77`

```typescript
@Injectable({ providedIn: 'root' })
export class TutorialService {
  readonly #state = signal<TutorialState>(this.#loadState());
  readonly state = this.#state.asReadonly();  // Expose read-only

  // Update state immutably
  this.#state.update((state) => ({
    ...state,
    isActive: true,
    currentTour: tourId,
  }));
}
```

**Pourquoi**:
- Coherent avec la strategie Angular moderne (zoneless + OnPush)
- Etat encapsule avec `#private` + exposition en lecture seule
- Reactivite fine sans RxJS

---

### 2. Zod Validation avec Versioning et Migration

Validation du localStorage avec Zod et support de migration.

**Ou**: `core/tutorial/tutorial.service.ts:39-49`

```typescript
const TutorialStateSchemaV1 = z.object({
  version: z.literal(1).default(1),
  completedTours: z.array(z.string()).default([]),
  skippedTours: z.array(z.string()).default([]),
  preferences: z
    .object({
      enabled: z.boolean().default(true),
      autoStart: z.boolean().default(true),
    })
    .default({}),
});
```

**Pourquoi**:
- Protection contre les donnees corrompues
- Migration automatique des donnees legacy (sans version)
- Filtrage des tour IDs invalides via `TOUR_IDS` set

---

### 3. Configuration-Based Tour Definition

Tours definis de maniere declarative avec options standardisees.

**Ou**: `core/tutorial/tutorial-configs.ts:204-282`

```typescript
export const dashboardWelcomeTour: TutorialTour = {
  id: 'dashboard-welcome',
  name: 'Decouverte du tableau de bord',
  description: 'Apprenez a utiliser votre dashboard budgetaire',
  triggerOn: 'first-visit',
  targetRoute: ROUTES.CURRENT_MONTH,
  steps: [
    {
      id: 'welcome',
      title: 'Bienvenue dans Pulpe !',
      text: `<p>Pulpe vous aide a planifier...</p>`,
      buttons: [buttons.cancel, buttons.next],
    },
    {
      id: 'budget-progress',
      attachTo: {
        element: () => document.querySelector('pulpe-budget-progress-bar'),
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise('pulpe-budget-progress-bar'),
      // ...
    },
  ],
};
```

**Pourquoi**:
- Separation configuration/logique
- Reutilisabilite des boutons standardises
- Lazy evaluation des elements DOM
- Support de la navigation automatique via `targetRoute`

---

### 4. Error-Resilient Step Handling

Gestion gracieuse des elements DOM manquants.

**Ou**: `core/tutorial/tutorial-configs.ts:129-146`

```typescript
function createSafeBeforeShowPromise(
  selector: string,
  timeout = EXTENDED_WAIT_TIMEOUT_MS,
): () => Promise<HTMLElement | void> {
  return async function (this: { tour?: Tour }) {
    try {
      return await waitForElement(selector, timeout);
    } catch (error) {
      console.error('[Tutorial] Step skipped - element not found:', {
        selector,
        error,
      });
      // Cancel the tour gracefully instead of leaving it in a broken state
      this.tour?.cancel();
      throw error;
    }
  };
}
```

**Pourquoi**:
- Robustesse face aux timing issues Angular
- Evite les tours bloques sur elements manquants
- Log d'erreur explicite pour debugging

---

### 5. Help Menu Integration (Layout Layer)

Integration dans le layout principal avec menu dynamique.

**Ou**: `layout/main-layout.ts:436-467`

```typescript
protected readonly helpMenuItems = [
  {
    tourId: 'dashboard-welcome' as const,
    label: 'Tour du tableau de bord',
    icon: 'explore',
    testId: 'help-menu-dashboard-tour',
  },
  {
    tourId: 'budget-calendar' as const,
    label: 'Calendrier des budgets',
    icon: 'calendar_month',
    testId: 'help-menu-calendar-tour',
  },
  // ... autres tours
] as const satisfies readonly HelpMenuItem[];
```

Template:
```html
<mat-menu #helpMenu="matMenu" xPosition="before">
  @for (item of helpMenuItems; track item.tourId) {
    <button mat-menu-item
      (click)="tutorialService.startTour(item.tourId, { force: true })"
      [attr.data-testid]="item.testId">
      <mat-icon matMenuItemIcon>{{ item.icon }}</mat-icon>
      <span>{{ item.label }}</span>
    </button>
  }
  <!-- Toggle auto-start + Reset buttons -->
</mat-menu>
```

**Pourquoi**:
- Accessible depuis n'importe quelle page
- Menu dynamique via `helpMenuItems` array (DRY)
- Option `force: true` pour rejouer les tours completes
- Toggle auto-start preference
- Reset des tutoriels pour les tests

---

### 6. Auto-Start on First Visit

Demarrage automatique conditionnel via `afterRenderEffect()`.

**Ou**: `feature/current-month/current-month.ts:231-243`

```typescript
constructor() {
  afterRenderEffect(() => {
    const hasLoadedData =
      this.store.dashboardStatus() !== 'loading' &&
      this.store.dashboardStatus() !== 'error';

    if (
      hasLoadedData &&
      !this.#tutorialService.hasSeenTour('dashboard-welcome')
    ) {
      this.#tutorialService.startTour('dashboard-welcome');
    }
  });
}
```

**Pourquoi**:
- Repond au critere "premier login -> tour automatique"
- Verifie que les donnees sont chargees avant le tour
- Utilise `hasSeenTour()` (completed OR skipped) pour eviter les re-affichages
- `afterRenderEffect()` garantit que le DOM est pret
- Delay gere dans le service via `AUTO_START_DELAY_MS = 2000`

---

### 7. PostHog Analytics Integration

Tracking des evenements tutoriel via PostHog.

**Ou**: `core/tutorial/tutorial.service.ts:617-630`

```typescript
#trackEvent(event: TutorialEvent): void {
  try {
    this.#logger.debug('Tutorial event', event);

    const eventName = `tutorial_${event.action}`;
    this.#analytics.captureEvent(eventName, {
      tourId: event.tourId,
      stepIndex: event.stepIndex,
      timestamp: event.timestamp,
    });
  } catch (error) {
    // Analytics should never break the application
    this.#logger.warn('Failed to track event', error);
  }
}
```

**Pourquoi**:
- Analytics via `AnalyticsService` (PostHog)
- Evenements: `tutorial_started`, `tutorial_completed`, `tutorial_cancelled`
- Error-resilient (ne casse jamais l'application)

---

## Flux de Donnees

```
+------------------+     +--------------------+     +----------------------+
|   localStorage   |---->|  TutorialService   |---->|  ShepherdService     |
|                  |     |                    |     |  (angular-shepherd)  |
| pulpe-tutorial-  |<----|  #state signal     |<----|                      |
| state (v1)       |     |                    |     |  tourObject.on()     |
+------------------+     +--------------------+     +----------------------+
                               |      |
                               |      | inject()
                    +----------+      +----------+
                    |                            |
                    v                            v
          +------------------+         +-------------------+
          | AnalyticsService |         | Consuming Component|
          |                  |         |                    |
          | PostHog tracking |         | - main-layout.ts   |
          +------------------+         | - current-month.ts |
                                       +-------------------+
```

---

## Structure des Fichiers Tutorial

```
frontend/projects/webapp/src/app/
+-- core/
|   +-- tutorial/
|       +-- tutorial.service.ts      # Singleton service, state management, analytics
|       +-- tutorial.service.spec.ts # Unit tests (Vitest)
|       +-- tutorial.types.ts        # TypeScript types, TOUR_IDS, defaults
|       +-- tutorial-configs.ts      # Tour definitions (steps, buttons, helpers)
|
+-- layout/
|   +-- main-layout.ts               # Help menu integration, helpMenuItems
|
+-- feature/
|   +-- current-month/
|       +-- current-month.ts         # Auto-start on first visit
|
+-- styles/
    +-- components/
        +-- _shepherd-theme.scss     # Material Design 3 styling (~578 lines)
```

---

## Mapping User Story - Architecture

| Critere d'Acceptation | Implementation Actuelle | Fichier |
|----------------------|------------------------|---------|
| Tour automatique au premier login | `afterRenderEffect()` avec `hasSeenTour()` | `current-month.ts:231-243` |
| Passer/arreter le tutoriel | Bouton "Passer" + cancel icon | `tutorial-configs.ts:175-179` |
| Relancer depuis menu d'aide | Help Menu dynamique avec `force: true` | `main-layout.ts:279-291` |
| Effet "spotlight" | `shepherd-modal-overlay-container` SVG cut-out | `_shepherd-theme.scss:30-59` |
| Progression sauvegardee | localStorage avec Zod validation v1 | `tutorial.service.ts:517-559` |
| **5 tutoriels configures** | `ALL_TOURS` array avec 5 tours | `tutorial-configs.ts:551-557` |
| Interface utilisable pendant tour | Overlay avec pointer-events sur cut-out | `_shepherd-theme.scss:55-58` |
| Mobile/Desktop responsive | Media queries dans SCSS | `_shepherd-theme.scss` |
| Toggle auto-start preference | Menu d'aide avec toggle | `main-layout.ts:295-309` |
| Analytics tracking | PostHog via AnalyticsService | `tutorial.service.ts:617-630` |

---

## Points d'Attention pour Review

### Forces

1. **Isolation Core** - Le service est dans `core/`, correctement separe
2. **Tests complets** - `tutorial.service.spec.ts` couvre les scenarios cles
3. **Material Design 3** - Theming coherent avec le reste de l'app
4. **Graceful degradation** - Gestion d'erreur robuste avec `createSafeBeforeShowPromise`
5. **data-testid** - Selecteurs stables pour les tours
6. **PostHog integre** - Analytics tracking fonctionnel
7. **Migration support** - Versioning des donnees localStorage
8. **Menu dynamique** - `helpMenuItems` array evite la duplication
9. **Preference auto-start** - Utilisateur peut desactiver les tutoriels automatiques

### Points de Vigilance

1. **Console.log dans production** - Les helpers `waitForElement` utilisent `console.error`, preferer le Logger
2. **Constants extractees** - Timeouts bien definis (`AUTO_START_DELAY_MS`, `ELEMENT_WAIT_TIMEOUT_MS`)

---

## Diagramme de Sequence: Demarrage Auto

```
+------------------+ +--------------------+ +--------------------+ +------------+
| CurrentMonth     | | TutorialService    | | ShepherdService    | | DOM        |
+--------+---------+ +---------+----------+ +---------+----------+ +-----+------+
         |                     |                      |                  |
         |  constructor()      |                      |                  |
         |  afterRenderEffect()|                      |                  |
         |--------------------+|                      |                  |
         |                     |                      |                  |
         | hasSeenTour()?      |                      |                  |
         |------------------->|                      |                  |
         |      false          |                      |                  |
         |<-------------------|                      |                  |
         |                     |                      |                  |
         | startTour('dashboard-welcome')            |                  |
         |------------------->|                      |                  |
         |                     | delay(2000ms)       |                  |
         |                     |------+              |                  |
         |                     |      |              |                  |
         |                     |<-----+              |                  |
         |                     | addSteps(steps)     |                  |
         |                     |------------------->|                  |
         |                     |                      | beforeShowPromise
         |                     |                      |---------------->|
         |                     |                      | element found   |
         |                     |                      |<----------------|
         |                     | start()              |                  |
         |                     |------------------->|                  |
         |                     |                      | Show modal+step |
         |                     |                      |---------------->|
         |                     |                      |                  |
         |                     | on('complete')       |                  |
         |                     |<--------------------|                  |
         |                     | #saveState()         |                  |
         |                     | #trackEvent() -> PostHog               |
         |                     |                      |                  |
```

---

## Tours Disponibles

| Tour ID | Nom | Declencheur | Target Route | Pages Cibles |
|---------|-----|-------------|--------------|--------------|
| `dashboard-welcome` | Decouverte du tableau de bord | `first-visit` | `current-month` | Current Month |
| `add-transaction` | Ajouter une transaction | `manual` | `current-month` | Bottom Sheet |
| `templates-intro` | Introduction aux modeles | `first-visit` | `budget-templates` | Templates List |
| `budget-management` | Gestion des budgets | `first-visit` | - | Budget Details |
| `budget-calendar` | Calendrier des budgets | `first-visit` | `budget` | Budget List |

---

## Technologies Utilisees

| Technologie | Version | Usage |
|-------------|---------|-------|
| Shepherd.js | via angular-shepherd | Core tour engine |
| Angular Signals | v20+ | State management |
| Zod | - | localStorage validation |
| Floating UI | via Shepherd | Tooltip positioning |
| SCSS | - | Material Design 3 theming |
| PostHog | via AnalyticsService | Analytics tracking |

---

## Constants de Configuration

| Constante | Valeur | Fichier | Usage |
|-----------|--------|---------|-------|
| `AUTO_START_DELAY_MS` | 2000 | tutorial.service.ts:21 | Delai avant auto-start |
| `LAZY_LOAD_MOUNT_DELAY_MS` | 200 | tutorial.service.ts:26 | Attente lazy-load |
| `ELEMENT_WAIT_TIMEOUT_MS` | 5000 | tutorial-configs.ts:9 | Timeout element standard |
| `EXTENDED_WAIT_TIMEOUT_MS` | 10000 | tutorial-configs.ts:10 | Timeout element etendu |
| `POLL_INTERVAL_MS` | 100 | tutorial-configs.ts:11 | Intervalle polling DOM |
