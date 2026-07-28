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

/**
 * Selectors for layout containers that need scroll reset after tour.
 * Driver.js scrollIntoView() affects all scrollable ancestors.
 */
const SCROLL_RESET_SELECTORS = [
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
    return (
      this.#storageService.getString(this.#getTourKey(TOUR_IDS.intro)) ===
      'true'
    );
  }

  /**
   * Check if user has seen a specific page tour
   */
  hasSeenPageTour(pageId: TourPageId): boolean {
    return (
      this.#storageService.getString(this.#getTourKey(TOUR_IDS[pageId])) ===
      'true'
    );
  }

  /**
   * Mark intro as completed
   */
  #markIntroCompleted(): void {
    this.#storageService.setString(this.#getTourKey(TOUR_IDS.intro), 'true');
  }

  /**
   * Mark a page tour as completed
   */
  #markPageTourCompleted(pageId: TourPageId): void {
    this.#storageService.setString(this.#getTourKey(TOUR_IDS[pageId]), 'true');
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
      this.#resetScrollPositions();
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

  #resetScrollPositions(): void {
    for (const selector of SCROLL_RESET_SELECTORS) {
      const element = this.#document.querySelector<HTMLElement>(selector);
      if (element) {
        element.scrollTop = 0;
      }
    }
  }

  /**
   * Start a page-specific tour
   * Includes intro steps if user hasn't seen them yet
   * Does nothing if user is not authenticated or a tour is already active
   */
  startPageTour(pageId: TourPageId): void {
    if (!this.isAuthenticated() || this.#activeDriver) {
      return;
    }

    this.#cancelPendingTour();

    const includeIntro = !this.hasSeenIntro();
    const steps = this.#getStepsForPage(pageId, includeIntro);
    const firstPageTarget = this.#getPageSteps(pageId).find(
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
        this.#startTour(pageId, includeIntro, steps);
      });
      const timeoutId = view.setTimeout(
        () => this.#cancelPendingTour(),
        TOUR_TARGET_TIMEOUT,
      );

      this.#pendingTour = { observer, timeoutId };
      observer.observe(this.#document.body, { childList: true, subtree: true });
      return;
    }

    this.#startTour(pageId, includeIntro, steps);
  }

  #startTour(
    pageId: TourPageId,
    includeIntro: boolean,
    steps: DriveStep[],
  ): void {
    const availableSteps = steps.filter(
      (step) =>
        typeof step.element !== 'string' ||
        !!this.#document.querySelector(step.element),
    );
    if (availableSteps.length === 0) return;

    const tourDriver = driver();
    this.#activeDriver = tourDriver;

    const driverConfig: Config = {
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      progressText: 'Étape {{current}} sur {{total}}',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      allowClose: true,
      overlayColor: '#000',
      overlayOpacity: 0.75,
      smoothScroll: true,
      animate: !this.#document.defaultView?.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches,
      disableActiveInteraction: false,
      stagePadding: 10,
      stageRadius: 8,
      popoverOffset: 16,
      onDestroyed: () => {
        this.#activeDriver = null;
        this.#cleanupDriverArtifacts();
        if (includeIntro) {
          this.#markIntroCompleted();
        }
        this.#markPageTourCompleted(pageId);
      },
    };

    tourDriver.setConfig(driverConfig);
    tourDriver.setSteps(availableSteps);
    tourDriver.drive();
  }

  /**
   * Get steps for a specific page, optionally including intro
   */
  #getStepsForPage(pageId: TourPageId, includeIntro: boolean): DriveStep[] {
    const introSteps = includeIntro ? this.#introSteps : [];
    const pageSteps = this.#getPageSteps(pageId);
    return [...introSteps, ...pageSteps];
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

  readonly #introSteps: DriveStep[] = [
    {
      popover: {
        title: 'Bienvenue dans Pulpe',
        description: `
          <p>Pulpe t'aide à préparer tes mois et à suivre tes revenus, dépenses et épargnes. Voici les repères utiles pour commencer.</p>
        `,
      },
    },
    {
      element: '[data-tour="navigation"]',
      popover: {
        title: 'Les espaces de Pulpe',
        description: `
          <ul>
            <li><strong>Tableau de bord</strong> : suis le mois en cours et pointe tes prévisions.</li>
            <li><strong>Budgets</strong> : consulte, crée et ajuste chaque mois.</li>
            <li><strong>Modèles</strong> : prépare des revenus, dépenses et épargnes à réutiliser.</li>
            <li><strong>Objectifs</strong> : suis tes projets d'épargne et les prévisions qui leur sont liées.</li>
          </ul>
        `,
        side: 'right',
        align: 'start',
      },
    },
  ];

  readonly #dashboardSteps: DriveStep[] = [
    {
      element: '[data-tour="dashboard-hero"]',
      popover: {
        title: 'Disponible à dépenser',
        description: `
          <p>Ce montant résume ce qu'il reste pour le mois en tenant compte des revenus, dépenses et épargnes. Ouvre ce bloc pour accéder au budget détaillé.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="dashboard-lists"]',
      popover: {
        title: 'Prévisions à pointer et transactions',
        description: `
          <p>Retrouve ici les prévisions encore à pointer et les dernières transactions du mois. Ouvre le budget pour voir la liste complète.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="add-transaction-fab"]',
      popover: {
        title: 'Ajouter une transaction',
        description: `
          <p>Ajoute un revenu, une dépense ou une épargne depuis ce bouton.</p>
        `,
        side: 'top',
        align: 'end',
      },
    },
  ];

  readonly #budgetListSteps: DriveStep[] = [
    {
      element: '[data-tour="year-tabs"] > mat-tab-header',
      popover: {
        title: 'Parcourir les années',
        description: `
          <p>Passe d'une année à l'autre avec ces onglets.</p>
        `,
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="calendar-grid"]',
      popover: {
        title: 'Ouvrir ou créer un mois',
        description: `
          <p>Sélectionne un mois existant pour ouvrir son budget, ou un mois vide pour le créer.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="create-budget"]',
      popover: {
        title: 'Ajouter un budget',
        description: `
          <p>Choisis un mois et un modèle. Les prévisions du modèle sont copiées dans le nouveau budget.</p>
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
        title: 'Disponible du mois',
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
        title: 'Prévisions du mois',
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
        title: 'Ajouter une prévision',
        description: `
          <p>Ajoute un Revenu, une Dépense ou une Épargne, puis choisis sa fréquence : Récurrent ou Prévu.</p>
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
        title: 'Tes modèles de budget',
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
        title: 'Ajouter un modèle',
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
      popover: {
        title: 'Des objectifs à ton rythme',
        description: `
          <p>Seul le nom est obligatoire. Tu peux ajouter un montant cible, une date de début ou une échéance selon ton besoin. L'option d'épargne mensuelle peut préparer les prévisions associées sans créer de nouveaux budgets.</p>
        `,
      },
    },
    {
      element: '[data-tour="savings-goals-list"]',
      popover: {
        title: 'Tes objectifs',
        description: `
          <p>Chaque carte affiche les informations renseignées. Ouvre un objectif pour suivre les prévisions liées et ajuster son plan.</p>
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
        title: 'Nouvel objectif',
        description: `
          <p>Commence par le nom. Tu pourras compléter le montant, les dates et l'épargne mensuelle maintenant ou plus tard.</p>
        `,
        side: 'bottom',
        align: 'end',
      },
    },
  ];
}
