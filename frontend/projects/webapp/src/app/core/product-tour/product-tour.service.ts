/**
 * Product Tour Service using Driver.js
 *
 * Page-specific product tours with spotlight highlighting.
 * Uses Driver.js library with Material Design 3 theming.
 */

import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { AuthStateService } from '@core/auth/auth-state.service';
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
  | 'current-month'
  | 'budget-list'
  | 'budget-details'
  | 'templates-list';

export type TourId = 'intro' | TourPageId;

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
  readonly #document = inject(DOCUMENT);
  readonly #storageService = inject(StorageService);
  readonly #authState = inject(AuthStateService);

  /** Active Driver.js instance to prevent concurrent tours */
  #activeDriver: Driver | null = null;

  /**
   * Check if user is authenticated.
   * Tours require authentication to start because they reference app content
   * that only exists for logged-in users, even though tour completion state
   * is stored device-scoped (persists across account changes on same device).
   */
  isAuthenticated(): boolean {
    return !!this.#authState.user()?.id;
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
        this.#cleanupDriverArtifacts();
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
          <p>Avec Pulpe, fini le stress de la fin de mois. Tu anticipes tes dépenses, et tu vis sereinement.</p>
          <p>On y va ? C'est parti pour 2 minutes de découverte.</p>
        `,
      },
    },
    {
      element: '[data-tour="navigation"]',
      popover: {
        title: 'Trois espaces, un objectif',
        description: `
          <ul>
            <li><strong>Ce mois-ci</strong> : ici, tu suis tes dépenses en temps réel, sans surprise.</li>
            <li><strong>Budgets</strong> : prépare tes prochains mois en 2 clics, et vois loin.</li>
            <li><strong>Modèles</strong> : ta recette mensuelle, à réutiliser sans effort.</li>
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
        title: 'Ton reste à dépenser',
        description: `
          <p>Ici, tu vois en un clin d'œil ce qu'il te reste à dépenser ce mois-ci.</p>
          <p>Plus de mauvaises surprises, juste de la clarté.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="expense-lists"]',
      popover: {
        title: 'Tes dépenses triées',
        description: `
          <p>Tes frais fixes sont déjà pris en compte. Le reste, c'est toi qui décides.</p>
          <p>Un coup d'œil, et tu sais où tu en es.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="add-transaction-fab"]',
      popover: {
        title: 'Note une dépense',
        description: `
          <p>Note tes dépenses en 5 secondes. C'est rapide, et ça te libère l'esprit.</p>
          <p>Une petite habitude pour un grand soulagement.</p>
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
          <p>Passe d'une année à l'autre pour anticiper tes gros mois (vacances, impôts, fêtes…).</p>
          <p>Préparé à l'avance = plus de sérénité après.</p>
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
          <p>Chaque mois a son propre budget. Ceux en gris sont prêts à être créés.</p>
          <p>Clique sur un mois pour le personnaliser en 30 secondes.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="create-budget"]',
      popover: {
        title: 'Crée ton budget',
        description: `
          <p>Sélectionne un modèle, et ton budget est prêt en un instant.</p>
          <p>Plus de saisie fastidieuse : tout est déjà là.</p>
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
        title: 'Ton solde réel',
        description: `
          <p>Ton solde se met à jour automatiquement quand tu coches tes dépenses.</p>
          <p>Tu sais toujours où tu en es, sans avoir à faire de calculs.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="budget-table"]',
      popover: {
        title: 'Tes prévisions',
        description: `
          <p>Coche tes dépenses au fur et à mesure pour suivre ton budget en temps réel.</p>
          <p>Un clic sur une ligne pour tout modifier si besoin.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="add-budget-line"]',
      popover: {
        title: 'Ajuste ton mois',
        description: `
          <p>Besoin d'ajouter un revenu, une dépense ou une épargne ? C'est ici.</p>
          <p>Choisis si c'est tous les mois ("récurrent") ou juste pour ce mois-ci.</p>
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
          <p>Ici, tu notes tes revenus et tes frais fixes (loyer, abonnements…).</p>
          <p>C'est ta base pour créer tous tes budgets en un clic.</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="template-counter"]',
      popover: {
        title: "Garde l'esprit léger",
        description: `
          <p>5 modèles max, c'est largement assez pour couvrir tous tes besoins.</p>
          <p>Un pour les mois classiques, un pour les vacances… et hop, c'est prêt !</p>
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
          <p>Crée ton premier modèle, et tes budgets futurs seront prêts en 1 clic.</p>
          <p>C'est parti pour 2 minutes de configuration !</p>
        `,
        side: 'left',
        align: 'start',
      },
    },
  ];
}
