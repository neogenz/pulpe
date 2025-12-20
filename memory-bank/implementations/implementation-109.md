# Architecture Analysis: Système de Tutoriel Pulpe

> **Issue**: #109 - Tutorial System
> **Branche**: `feature/109-tutorial-system`

## Vue d'ensemble

Le système de tutoriel est implémenté avec **Shepherd.js** via `angular-shepherd` et suit l'architecture Angular standalone avec signals. L'architecture est bien structurée, respectant les principes du projet (KISS, YAGNI, isolation des features).

---

## Diagramme d'Architecture Global

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LAYER: Core (eager-loaded)                        │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    core/tutorial/                                     │  │
│   │                                                                       │  │
│   │  ┌─────────────────────┐   ┌─────────────────────┐                   │  │
│   │  │ tutorial.service.ts │   │ tutorial.types.ts   │                   │  │
│   │  │                     │   │                     │                   │  │
│   │  │ - Signal state      │   │ - TourId type       │                   │  │
│   │  │ - startTour()       │   │ - TutorialState     │                   │  │
│   │  │ - cancelTour()      │   │ - TutorialTour      │                   │  │
│   │  │ - hasCompletedTour()│   │ - TutorialEvent     │                   │  │
│   │  │ - localStorage      │   │                     │                   │  │
│   │  └─────────┬───────────┘   └─────────────────────┘                   │  │
│   │            │                                                          │  │
│   │            ▼                                                          │  │
│   │  ┌─────────────────────┐                                             │  │
│   │  │ tutorial-configs.ts │                                             │  │
│   │  │                     │                                             │  │
│   │  │ - dashboardWelcome  │                                             │  │
│   │  │ - addTransaction    │                                             │  │
│   │  │ - templatesIntro    │                                             │  │
│   │  │ - budgetManagement  │                                             │  │
│   │  │ - defaultStepOptions│                                             │  │
│   │  └─────────────────────┘                                             │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ inject()
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER: Layout (eager-loaded)                          │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    layout/main-layout.ts                              │  │
│   │                                                                       │  │
│   │  - Help Menu avec boutons pour lancer chaque tour                    │  │
│   │  - tutorialService.startTour('tour-id', { force: true })             │  │
│   │  - tutorialService.resetAllTours()                                   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ router-outlet
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER: Feature (lazy-loaded)                          │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                 feature/current-month/current-month.ts                │  │
│   │                                                                       │  │
│   │  ngOnInit() {                                                         │  │
│   │    // Auto-start welcome tour on first visit                         │  │
│   │    setTimeout(() => {                                                │  │
│   │      if (hasLoadedData && !hasCompletedTour) {                       │  │
│   │        this.#tutorialService.startTour('dashboard-welcome');         │  │
│   │      }                                                                │  │
│   │    }, 800);                                                          │  │
│   │  }                                                                    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ data-testid selectors
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LAYER: Styles (global)                                │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │            styles/components/_shepherd-theme.scss                     │  │
│   │                                                                       │  │
│   │  - Material Design 3 theming                                         │  │
│   │  - CSS variables (--mat-sys-*)                                       │  │
│   │  - Responsive mobile/desktop                                         │  │
│   │  - Accessibility (reduced motion, focus states)                      │  │
│   │  - Dark theme support                                                │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Patterns Architecturaux Identifiés

### 1. Signal-Based State Management

Le `TutorialService` utilise des Angular signals pour la gestion d'état réactive.

**Où**: `core/tutorial/tutorial.service.ts:47-58`

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
- Cohérent avec la stratégie Angular moderne (zoneless + OnPush)
- État encapsulé avec `#private` + exposition en lecture seule
- Réactivité fine sans RxJS

---

### 2. Zod Validation pour la persistance

Validation du localStorage avec Zod pour robustesse.

**Où**: `core/tutorial/tutorial.service.ts:24-33`

```typescript
const TutorialStateSchema = z.object({
  completedTours: z.array(z.string()).default([]),
  skippedTours: z.array(z.string()).default([]),
  preferences: z.object({
    enabled: z.boolean().default(true),
    autoStart: z.boolean().default(true),
  }).default({}),
});
```

**Pourquoi**:
- Protection contre les données corrompues
- Migration automatique avec `.default()`
- Filtrage des tour IDs invalides

---

### 3. Configuration-Based Tour Definition

Tours définis de manière déclarative avec options standardisées.

**Où**: `core/tutorial/tutorial-configs.ts:130-210`

```typescript
export const dashboardWelcomeTour: TutorialTour = {
  id: 'dashboard-welcome',
  name: 'Découverte du tableau de bord',
  triggerOn: 'first-visit',
  steps: [
    {
      id: 'welcome',
      title: 'Bienvenue dans Pulpe !',
      text: `<p>Pulpe vous aide à planifier...</p>`,
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
- Séparation configuration/logique
- Réutilisabilité des boutons standardisés
- Lazy evaluation des éléments DOM

---

### 4. Error-Resilient Step Handling

Gestion gracieuse des éléments DOM manquants.

**Où**: `core/tutorial/tutorial-configs.ts:65-82`

```typescript
function createSafeBeforeShowPromise(
  selector: string,
  timeout = 10000,
): () => Promise<HTMLElement | void> {
  return async function (this: { tour?: Tour }) {
    try {
      return await waitForElement(selector, timeout);
    } catch (error) {
      // Cancel the tour gracefully instead of breaking
      this.tour?.cancel();
      throw error;
    }
  };
}
```

**Pourquoi**:
- Robustesse face aux timing issues Angular
- Évite les tours bloqués sur éléments manquants
- Log d'erreur explicite pour debugging

---

### 5. Help Menu Integration (Layout Layer)

Intégration dans le layout principal pour accès global.

**Où**: `layout/main-layout.ts:265-319`

```typescript
<mat-menu #helpMenu="matMenu" xPosition="before">
  <button mat-menu-item
    (click)="tutorialService.startTour('dashboard-welcome', { force: true })"
    data-testid="help-menu-dashboard-tour">
    <mat-icon matMenuItemIcon>explore</mat-icon>
    <span>Tour du tableau de bord</span>
  </button>
  <!-- ... autres tours ... -->
  <mat-divider></mat-divider>
  <button mat-menu-item
    (click)="tutorialService.resetAllTours()"
    data-testid="help-menu-reset-tours">
    <mat-icon matMenuItemIcon>refresh</mat-icon>
    <span>Réinitialiser les tutoriels</span>
  </button>
</mat-menu>
```

**Pourquoi**:
- Accessible depuis n'importe quelle page
- Option `force: true` pour rejouer les tours complétés
- Reset des tutoriels pour les tests

---

### 6. Auto-Start on First Visit

Démarrage automatique conditionnel sur la page dashboard.

**Où**: `feature/current-month/current-month.ts:253-266`

```typescript
ngOnInit() {
  setTimeout(() => {
    const hasLoadedData =
      this.store.dashboardStatus() !== 'loading' &&
      this.store.dashboardStatus() !== 'error';
    const hasNotCompletedTour =
      !this.#tutorialService.hasCompletedTour('dashboard-welcome');

    if (hasLoadedData && hasNotCompletedTour) {
      this.#tutorialService.startTour('dashboard-welcome');
    }
  }, 800); // Delay to allow page to fully render
}
```

**Pourquoi**:
- Répond au critère "premier login -> tour automatique"
- Vérifie que les données sont chargées avant le tour
- Délai pour stabilité DOM

---

## Flux de Données

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   localStorage  │────▶│  TutorialService │────▶│  ShepherdService   │
│                 │     │                  │     │  (angular-shepherd)│
│ pulpe-tutorial- │◀────│  #state signal   │◀────│                    │
│ state           │     │                  │     │  tourObject.on()   │
└─────────────────┘     └──────────────────┘     └────────────────────┘
                               │
                               │ inject()
                               ▼
                    ┌──────────────────────┐
                    │  Consuming Component │
                    │                      │
                    │  - main-layout.ts    │
                    │  - current-month.ts  │
                    └──────────────────────┘
```

---

## Structure des Fichiers Tutorial

```
frontend/projects/webapp/src/app/
├── core/
│   └── tutorial/
│       ├── tutorial.service.ts      # Singleton service, state management
│       ├── tutorial.service.spec.ts # Unit tests (Vitest)
│       ├── tutorial.types.ts        # TypeScript types & constants
│       └── tutorial-configs.ts      # Tour definitions (steps, buttons)
│
├── layout/
│   └── main-layout.ts               # Help menu integration
│
├── feature/
│   └── current-month/
│       └── current-month.ts         # Auto-start on first visit
│
└── styles/
    └── components/
        └── _shepherd-theme.scss     # Material Design 3 styling (~470 lines)
```

---

## Mapping User Story - Architecture

| Critère d'Acceptation | Implémentation Actuelle | Fichier |
|----------------------|------------------------|---------|
| Tour automatique au premier login | `ngOnInit()` avec vérification `hasCompletedTour` | `current-month.ts:253-266` |
| Passer/arrêter le tutoriel | Bouton "Passer" + cancel icon | `tutorial-configs.ts:104-108` |
| Relancer depuis menu d'aide | Help Menu avec `force: true` | `main-layout.ts:265-319` |
| Effet "spotlight" | `shepherd-modal-overlay-container` SVG cut-out | `_shepherd-theme.scss:12-44` |
| Progression sauvegardée | localStorage avec Zod validation | `tutorial.service.ts:287-326` |
| 4 tutoriels configurés | `ALL_TOURS` array avec 4 tours | `tutorial-configs.ts:402-407` |
| Interface utilisable pendant tour | Overlay avec pointer-events sur cut-out | `_shepherd-theme.scss:360-364` |
| Mobile/Desktop responsive | Media queries `@media (max-width: 767px)` | `_shepherd-theme.scss:380-410` |

---

## Points d'Attention pour Review

### Forces

1. **Isolation Core** - Le service est dans `core/`, correctement séparé
2. **Tests complets** - `tutorial.service.spec.ts` couvre les scénarios clés
3. **Material Design 3** - Theming cohérent avec le reste de l'app
4. **Graceful degradation** - Gestion d'erreur robuste avec `createSafeBeforeShowPromise`
5. **data-testid** - Sélecteurs stables pour les tours

### Points de Vigilance

1. **setTimeout(800ms)** dans `current-month.ts:255` - Magic number, pourrait être extrait en constante
2. **Console.log dans production** - `#trackEvent` utilise `console.info`, préférer le Logger
3. **Pas d'intégration PostHog** - TODO mentionné ligne 352, analytics non tracké
4. **Tours hardcodés** - Les 4 tours dans le Help Menu sont dupliqués du tableau `ALL_TOURS`

---

## Diagramme de Séquence: Démarrage Auto

```
┌─────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌────────────┐
│ CurrentMonth    │ │ TutorialService  │ │ ShepherdService  │ │ DOM        │
└────────┬────────┘ └────────┬─────────┘ └────────┬─────────┘ └─────┬──────┘
         │                   │                    │                 │
         │  ngOnInit()       │                    │                 │
         │─────────────────▶│                    │                 │
         │                   │                    │                 │
         │ setTimeout(800)   │                    │                 │
         │ ─ ─ ─ ─ ─ ─ ─ ─ ▶│                    │                 │
         │                   │                    │                 │
         │ hasCompletedTour()?                   │                 │
         │──────────────────▶│                    │                 │
         │      false        │                    │                 │
         │◀──────────────────│                    │                 │
         │                   │                    │                 │
         │ startTour('dashboard-welcome')        │                 │
         │──────────────────▶│                    │                 │
         │                   │ addSteps(steps)    │                 │
         │                   │───────────────────▶│                 │
         │                   │                    │ beforeShowPromise
         │                   │                    │─────────────────▶│
         │                   │                    │ element found   │
         │                   │                    │◀─────────────────│
         │                   │ start()            │                 │
         │                   │───────────────────▶│                 │
         │                   │                    │ Show modal+step │
         │                   │                    │─────────────────▶│
         │                   │                    │                 │
         │                   │ on('complete')     │                 │
         │                   │◀──────────────────│                 │
         │                   │ #saveState()       │                 │
         │                   │ localStorage.setItem                 │
         │                   │                    │                 │
```

---

## Tours Disponibles

| Tour ID | Nom | Déclencheur | Pages Cibles |
|---------|-----|-------------|--------------|
| `dashboard-welcome` | Découverte du tableau de bord | `first-visit` | Current Month |
| `add-transaction` | Ajouter une transaction | `manual` | Bottom Sheet |
| `templates-intro` | Introduction aux modèles | `manual` | Templates List |
| `budget-management` | Gestion des budgets | `manual` | Budget Details |

---

## Technologies Utilisées

| Technologie | Version | Usage |
|-------------|---------|-------|
| Shepherd.js | via angular-shepherd | Core tour engine |
| Angular Signals | v20+ | State management |
| Zod | - | localStorage validation |
| Floating UI | via Shepherd | Tooltip positioning |
| SCSS | - | Material Design 3 theming |
