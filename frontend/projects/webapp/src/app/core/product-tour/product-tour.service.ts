/**
 * Product Tour Service using Driver.js
 *
 * Page-specific product tours with spotlight highlighting.
 * Uses Driver.js library with Material Design 3 theming.
 */

import { inject, Injectable } from '@angular/core';
import { driver, type DriveStep, type Config, type Driver } from 'driver.js';
import { StorageService, type StorageKey } from '@core/storage';
import { AuthStateService } from '@core/auth/auth-state.service';

export type TourPageId =
  | 'current-month'
  | 'budget-list'
  | 'budget-details'
  | 'templates-list';

/**
 * Delay before starting tour to ensure DOM is fully rendered
 * and Angular animations have completed
 */
export const TOUR_START_DELAY = 500;

/**
 * Tour identifiers used to generate storage keys.
 * Keys are stored as `pulpe-tour-{tourId}` (device-scoped, not user-scoped).
 */
const TOUR_IDS = {
  intro: 'intro',
  'current-month': 'current-month',
  'budget-list': 'budget-list',
  'budget-details': 'budget-details',
  'templates-list': 'templates-list',
} as const;

@Injectable({
  providedIn: 'root',
})
export class ProductTourService {
  readonly #storageService = inject(StorageService);
  readonly #authState = inject(AuthStateService);

  /** Active Driver.js instance to prevent concurrent tours */
  #activeDriver: Driver | null = null;

  /**
   * Check if the service is ready to operate (user is authenticated)
   */
  isReady(): boolean {
    return !!this.#authState.user()?.id;
  }

  /**
   * Generate a storage key for a tour.
   * Keys are device-scoped (no userId) to persist across account changes.
   */
  #getTourKey(tourId: string): StorageKey {
    return `pulpe-tour-${tourId}` as StorageKey;
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
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['current-month']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['budget-list']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['budget-details']));
    this.#storageService.remove(this.#getTourKey(TOUR_IDS['templates-list']));
  }

  /**
   * Cancel active tour if running
   */
  cancelActiveTour(): void {
    if (this.#activeDriver) {
      this.#activeDriver.destroy();
      this.#activeDriver = null;
    }
  }

  /**
   * Start a page-specific tour
   * Includes intro steps if user hasn't seen them yet
   * Does nothing if service is not ready (user not authenticated)
   */
  startPageTour(pageId: TourPageId): void {
    if (!this.isReady() || this.#activeDriver) {
      return;
    }

    const includeIntro = !this.hasSeenIntro();
    const steps = this.#getStepsForPage(pageId, includeIntro);

    // Create driver instance first to avoid closure timing issues
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
      animate: true,
      disableActiveInteraction: false,
      stagePadding: 10,
      stageRadius: 8,
      popoverOffset: 16,
      onDestroyed: () => {
        this.#activeDriver = null;
        if (includeIntro) {
          this.#markIntroCompleted();
        }
        this.#markPageTourCompleted(pageId);
      },
    };

    tourDriver.setConfig(driverConfig);
    tourDriver.setSteps(steps);
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
      case 'current-month':
        return this.#currentMonthSteps;
      case 'budget-list':
        return this.#budgetListSteps;
      case 'budget-details':
        return this.#budgetDetailsSteps;
      case 'templates-list':
        return this.#templatesListSteps;
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
          <p>Pulpe t'aide à anticiper tes dépenses, pas juste à les suivre.</p>
          <p>Voyons comment ça marche.</p>
        `,
      },
    },
    {
      element: '[data-tour="navigation"]',
      popover: {
        title: 'Trois espaces, un objectif',
        description: `
          <ul>
            <li><strong>Ce mois-ci</strong> : Suis tes dépenses au jour le jour</li>
            <li><strong>Budgets</strong> : Planifie tes mois à venir</li>
            <li><strong>Modèles</strong> : Crée ta base mensuelle type</li>
          </ul>
        `,
        side: 'right',
        align: 'start',
      },
    },
  ];

  readonly #currentMonthSteps: DriveStep[] = [
    {
      element: '[data-tour="progress-bar"]',
      popover: {
        title: 'Où tu en es',
        description: `
          <p>D'un coup d'œil, tu sais combien il te reste ce mois-ci.</p>
          <p>Pas de surprise à la fin du mois.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="expense-lists"]',
      popover: {
        title: 'Tes dépenses organisées',
        description: `
          <p>Les récurrentes (loyer, abos) et les ponctuelles (courses, sorties) sont séparées.</p>
          <p>Tu vois tout de suite ce qui est prévu et ce qui reste flexible.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="add-transaction-fab"]',
      popover: {
        title: 'Note tes dépenses',
        description: `
          <p>Chaque achat noté, c'est plus de contrôle sur ton budget.</p>
          <p>Ça prend 5 secondes.</p>
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
        title: 'Vois loin',
        description: `
          <p>Passe d'une année à l'autre pour planifier à l'avance.</p>
          <p>Anticipe les gros mois : vacances, impôts, fêtes.</p>
        `,
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="calendar-grid"]',
      popover: {
        title: "Ton année en un coup d'œil",
        description: `
          <p>Chaque mois a son budget. Les vides attendent d'être créés.</p>
          <p>Clique sur un mois pour commencer.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="create-budget"]',
      popover: {
        title: 'Crée en un clic',
        description: `
          <p>Choisis un modèle et ton budget est prêt.</p>
          <p>Plus besoin de tout ressaisir chaque mois.</p>
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
        title: "L'essentiel de ton mois",
        description: `
          <p>Revenus, dépenses, épargne : tout est résumé ici.</p>
          <p>Le « reste à vivre » te dit ce qu'il te reste au quotidien.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="budget-table"]',
      popover: {
        title: 'Le détail ligne par ligne',
        description: `
          <p>Chaque poste de dépense ou revenu apparaît ici.</p>
          <p>Clique sur une ligne pour voir tes transactions.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="add-budget-line"]',
      popover: {
        title: "Ajoute ce qu'il te manque",
        description: `
          <p>Revenu, dépense ou épargne : à toi de compléter.</p>
          <p>Choisis si c'est tous les mois ou une seule fois.</p>
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
        title: 'Ta base mensuelle',
        description: `
          <p>Définis tes revenus et charges fixes ici.</p>
          <p>Chaque nouveau budget partira de cette base.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="template-counter"]',
      popover: {
        title: 'Reste simple',
        description: `
          <p>5 modèles max, c'est largement suffisant.</p>
          <p>Un pour les mois normaux, un pour les vacances... et c'est parti.</p>
        `,
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="create-template"]',
      popover: {
        title: 'Lance-toi',
        description: `
          <p>Ajoute tes revenus et dépenses récurrents.</p>
          <p>Tu pourras créer des budgets en un clic après.</p>
        `,
        side: 'left',
        align: 'start',
      },
    },
  ];
}
