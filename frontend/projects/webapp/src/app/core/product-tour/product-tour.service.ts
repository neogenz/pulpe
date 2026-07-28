/**
 * Product Tour Service using Driver.js
 *
 * Page-specific product tours with spotlight highlighting.
 * Uses Driver.js library with Material Design 3 theming.
 */

import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { AuthStore } from '@core/auth/auth-store';
import { StorageService, type StorageKey } from '@core/storage';
import { driver, type Config, type Driver, type DriveStep } from 'driver.js';

/** Scrollable layout containers affected by Driver.js scrollIntoView(). */
const SCROLL_CONTAINER_SELECTORS = [
  '[data-testid="page-content"]',
  '[data-testid="main-content"] > div',
] as const;

/** Driver.js CSS class applied to highlighted elements (driver.js v1.x) */
const DRIVER_ACTIVE_ELEMENT_CLASS = 'driver-active-element';

/** Driver.js CSS classes applied to document body (driver.js v1.x) */
const DRIVER_BODY_CLASSES = [
  'driver-active',
  'driver-fade',
  'driver-simple',
] as const;

export type TourPageId =
  | 'dashboard'
  | 'budget-list'
  | 'budget-details'
  | 'templates-list'
  | 'savings-goals';

export type TourId = 'intro' | TourPageId;
type TourState = 'completed' | 'dismissed';

/**
 * Delay before starting tour to ensure DOM is fully rendered
 * and Angular animations have completed
 */
export const TOUR_START_DELAY = 500;
const TOUR_TARGET_TIMEOUT = 10_000;

/**
 * Tour identifiers used to generate storage keys.
 * Keys are stored as `pulpe-tour-{tourId}` (device-scoped, not user-scoped).
 */
const TOUR_IDS = {
  intro: 'intro',
  dashboard: 'dashboard',
  'budget-list': 'budget-list',
  'budget-details': 'budget-details',
  'templates-list': 'templates-list',
  'savings-goals': 'savings-goals',
} as const;

@Service()
export class ProductTourService {
  readonly #document = inject(DOCUMENT);
  readonly #storageService = inject(StorageService);
  readonly #authStore = inject(AuthStore);

  /** Active Driver.js instance to prevent concurrent tours */
  #activeDriver: Driver | null = null;

  #pendingTour: {
    observer: MutationObserver;
    timeoutId: number;
  } | null = null;

  readonly #scrollPositions = new Map<HTMLElement, number>();

  /**
   * Check if user is authenticated.
   * Tours require authentication to start because they reference app content
   * that only exists for logged-in users, even though tour completion state
   * is stored device-scoped (persists across account changes on same device).
   */
  isAuthenticated(): boolean {
    return !!this.#authStore.user()?.id;
  }

  /**
   * Generate a storage key for a tour.
   * Keys are device-scoped (no userId) to persist across account changes.
   */
  #getTourKey(tourId: TourId): StorageKey {
    return `pulpe-tour-${tourId}`;
  }

  /**
   * Check if user has seen the intro (welcome + navigation)
   */
  hasSeenIntro(): boolean {
    return this.#hasSeenTour(TOUR_IDS.intro);
  }

  /**
   * Check if user has seen a specific page tour
   */
  hasSeenPageTour(pageId: TourPageId): boolean {
    return this.#hasSeenTour(TOUR_IDS[pageId]);
  }

  #hasSeenTour(tourId: TourId): boolean {
    const state = this.#storageService.getString(this.#getTourKey(tourId));
    return state === 'true' || state === 'completed' || state === 'dismissed';
  }

  #markTour(tourId: TourId, state: TourState): void {
    this.#storageService.setString(this.#getTourKey(tourId), state);
  }

  /**
   * Reset all tours (device-scoped)
   */
  resetAllTours(): void {
    this.#storageService.remove(this.#getTourKey(TOUR_IDS.intro));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS.dashboard));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['budget-list']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['budget-details']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['templates-list']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['savings-goals']));
  }

  /**
   * Cancel active tour if running
   */
  cancelActiveTour(): void {
    this.#cancelPendingTour();
    if (this.#activeDriver) {
      this.#activeDriver.destroy();
      this.#activeDriver = null;
    }
  }

  #cancelPendingTour(): void {
    if (!this.#pendingTour) return;

    this.#pendingTour.observer.disconnect();
    this.#document.defaultView?.clearTimeout(this.#pendingTour.timeoutId);
    this.#pendingTour = null;
  }

  /**
   * Clean up Driver.js artifacts that may persist after tour ends.
   * Delayed execution ensures cleanup runs after Driver.js completes its own teardown.
   */
  #cleanupDriverArtifacts(): void {
    setTimeout(() => {
      this.#removeDriverClasses();
      this.#restoreScrollPositions();
    }, 0);
  }

  #removeDriverClasses(): void {
    this.#document
      .querySelectorAll(`.${DRIVER_ACTIVE_ELEMENT_CLASS}`)
      .forEach((el) => {
        el.classList.remove(DRIVER_ACTIVE_ELEMENT_CLASS);
      });
    this.#document.body.classList.remove(...DRIVER_BODY_CLASSES);
  }

  #rememberScrollPositions(): void {
    this.#scrollPositions.clear();
    for (const selector of SCROLL_CONTAINER_SELECTORS) {
      const element = this.#document.querySelector<HTMLElement>(selector);
      if (element) {
        this.#scrollPositions.set(element, element.scrollTop);
      }
    }
  }

  #restoreScrollPositions(): void {
    this.#scrollPositions.forEach((scrollTop, element) => {
      element.scrollTop = scrollTop;
    });
    this.#scrollPositions.clear();
  }

  /** Start the one-time orientation from the first dashboard visit. */
  startFirstRunTour(): void {
    if (!this.isAuthenticated() || this.hasSeenIntro() || this.#activeDriver) {
      return;
    }

    this.#prepareTour(TOUR_IDS.intro, this.#firstRunSteps);
  }

  /** Start contextual, replayable help for the current page. */
  startPageTour(pageId: TourPageId): void {
    if (!this.isAuthenticated() || this.#activeDriver) {
      return;
    }

    this.#prepareTour(TOUR_IDS[pageId], this.#getPageSteps(pageId));
  }

  #prepareTour(tourId: TourId, steps: DriveStep[]): void {
    this.#cancelPendingTour();

    const firstPageTarget = steps.find(
      (step) => typeof step.element === 'string',
    )?.element;

    if (
      typeof firstPageTarget === 'string' &&
      !this.#document.querySelector(firstPageTarget)
    ) {
      const view = this.#document.defaultView;
      if (!view) return;

      const observer = new view.MutationObserver(() => {
        if (!this.#document.querySelector(firstPageTarget)) return;

        this.#cancelPendingTour();
        this.#startTour(tourId, steps);
      });
      const timeoutId = view.setTimeout(
        () => this.#cancelPendingTour(),
        TOUR_TARGET_TIMEOUT,
      );

      this.#pendingTour = { observer, timeoutId };
      observer.observe(this.#document.body, { childList: true, subtree: true });
      return;
    }

    this.#startTour(tourId, steps);
  }

  #startTour(tourId: TourId, steps: DriveStep[]): void {
    const availableSteps = steps.filter(
      (step) =>
        typeof step.element !== 'string' ||
        !!this.#document.querySelector(step.element),
    );
    if (availableSteps.length === 0) return;

    const tourDriver = driver();
    this.#activeDriver = tourDriver;
    this.#rememberScrollPositions();
    let completed = false;

    const driverConfig: Config = {
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      progressText: 'Étape {{current}} sur {{total}}',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      allowClose: true,
      overlayColor: '#000',
      overlayOpacity: 0.55,
      smoothScroll: true,
      animate: !this.#document.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches,
      disableActiveInteraction: false,
      stagePadding: 10,
      stageRadius: 8,
      popoverOffset: 16,
      onPopoverRender: (popover) => {
        popover.closeButton.setAttribute('aria-label', 'Fermer');
      },
      onNextClick: (_element, _step, { driver: currentDriver }) => {
        if (currentDriver.isLastStep()) {
          completed = true;
          currentDriver.destroy();
          return;
        }

        currentDriver.moveNext();
      },
      onDestroyed: () => {
        this.#activeDriver = null;
        this.#cleanupDriverArtifacts();
        this.#markTour(tourId, completed ? 'completed' : 'dismissed');
      },
    };

    tourDriver.setConfig(driverConfig);
    tourDriver.setSteps(availableSteps);
    tourDriver.drive();
  }

  /**
   * Get page-specific steps
   */
  #getPageSteps(pageId: TourPageId): DriveStep[] {
    switch (pageId) {
      case 'dashboard':
        return this.#dashboardSteps;
      case 'budget-list':
        return this.#budgetListSteps;
      case 'budget-details':
        return this.#budgetDetailsSteps;
      case 'templates-list':
        return this.#templatesListSteps;
      case 'savings-goals':
        return this.#savingsGoalsSteps;
      default: {
        const _exhaustive: never = pageId;
        throw new Error(`Unknown page ID: ${_exhaustive}`);
      }
    }
  }

  // ============================================
  // Step Definitions
  // ============================================

  readonly #firstRunSteps: DriveStep[] = [
    {
      element: '[data-tour="dashboard-hero"]',
      popover: {
        title: "Ton mois en un coup d'œil",
        description: `
          <p>Commence ici : <strong>Disponible à dépenser</strong> tient compte de tes revenus, dépenses et épargnes. Ouvre ce bloc pour ajuster le budget du mois.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dashboard-lists"]',
      popover: {
        title: 'Commence par ce qui bouge',
        description: `
          <p>Quand une prévision se réalise, pointe-la. Tes dernières transactions restent visibles juste à côté.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="navigation"]',
      popover: {
        title: 'Retrouve chaque besoin',
        description: `
          <p><strong>Budgets</strong> pour tes mois, <strong>Modèles</strong> pour préparer ce qui revient, <strong>Objectifs</strong> pour tes projets d'épargne. Tu peux revoir l'aide de chaque écran depuis ton menu.</p>
        `,
        side: 'right',
        align: 'start',
      },
    },
  ];

  readonly #dashboardSteps = this.#firstRunSteps;

  readonly #budgetListSteps: DriveStep[] = [
    {
      element: '[data-tour="calendar-grid"]',
      popover: {
        title: 'Choisis le mois à gérer',
        description: `
          <p>Ouvre un budget existant pour le suivre. Sélectionne un mois vide pour le préparer.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="create-budget"]',
      popover: {
        title: 'Prépare un nouveau mois',
        description: `
          <p>Choisis un mois et, si tu veux, un modèle. Ses prévisions seront copiées dans le nouveau budget.</p>
        `,
        side: 'left',
        align: 'start',
      },
    },
  ];

  readonly #budgetDetailsSteps: DriveStep[] = [
    {
      element: '[data-tour="financial-overview"]',
      popover: {
        title: 'Vérifie le cap du mois',
        description: `
          <p>Ce bloc résume les revenus, les dépenses, l'épargne et le report éventuel du mois précédent.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="budget-table"]',
      popover: {
        title: 'Suis ce qui se réalise',
        description: `
          <p>Pointe une prévision quand elle est réalisée. Ouvre une ligne pour la modifier ou consulter ses transactions.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-testid="add-budget-line-fab"]',
      popover: {
        title: 'Prévois un mouvement ponctuel',
        description: `
          <p>Ajoute ici une prévision ponctuelle. Pour ce qui revient, ajoute d'abord la prévision à un modèle.</p>
        `,
        side: 'left',
        align: 'start',
      },
    },
  ];

  readonly #templatesListSteps: DriveStep[] = [
    {
      element: '[data-tour="templates-list"]',
      popover: {
        title: 'Prépare ce qui revient',
        description: `
          <p>Un modèle regroupe les revenus, dépenses et épargnes que tu veux réutiliser. Ouvre un modèle pour modifier ses prévisions.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="create-template"]',
      popover: {
        title: 'Crée ton prochain modèle',
        description: `
          <p>Crée un modèle, puis ajoute les prévisions à reprendre dans tes futurs budgets.</p>
        `,
        side: 'left',
        align: 'start',
      },
    },
  ];

  readonly #savingsGoalsSteps: DriveStep[] = [
    {
      element: '[data-tour="savings-goals-list"]',
      popover: {
        title: 'Suis un projet d’épargne',
        description: `
          <p>Ouvre un objectif pour voir sa progression, les prévisions liées et ajuster ton plan.</p>
        `,
        // 'bottom' anchors the popover in the empty space below the goals grid
        // (or the empty-state card on first run). A large, full-width target
        // leaves no room above, so 'top' forces driver.js to flip, and its
        // reposition pass leaves the popover stuck at opacity 0.
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="create-goal"]',
      popover: {
        title: 'Commence simplement',
        description: `
          <p>Seul le nom est obligatoire. Ajoute le montant, les dates et l’épargne mensuelle maintenant ou plus tard.</p>
        `,
        side: 'bottom',
        align: 'end',
      },
    },
  ];
}
