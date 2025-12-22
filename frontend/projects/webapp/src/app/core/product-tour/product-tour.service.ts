/**
 * Product Tour Service using Driver.js
 *
 * Page-specific product tours with spotlight highlighting.
 * Uses Driver.js library with Material Design 3 theming.
 */

import { Injectable } from '@angular/core';
import { driver, type DriveStep, type Config } from 'driver.js';

export type TourPageId =
  | 'current-month'
  | 'budget-list'
  | 'budget-details'
  | 'templates-list';

const STORAGE_PREFIX = 'pulpe_tour_';
const INTRO_KEY = `${STORAGE_PREFIX}intro`;

/**
 * Delay before starting tour to ensure DOM is fully rendered
 * and Angular animations have completed
 */
export const TOUR_START_DELAY = 500;

/**
 * Storage keys for tour completion tracking
 * Exported for E2E test utilities
 */
export const TOUR_STORAGE_KEYS = {
  intro: INTRO_KEY,
  'current-month': `${STORAGE_PREFIX}current-month`,
  'budget-list': `${STORAGE_PREFIX}budget-list`,
  'budget-details': `${STORAGE_PREFIX}budget-details`,
  'templates-list': `${STORAGE_PREFIX}templates-list`,
} as const;

@Injectable({
  providedIn: 'root',
})
export class ProductTourService {
  /**
   * Check if user has seen the intro (welcome + navigation)
   */
  hasSeenIntro(): boolean {
    return localStorage.getItem(INTRO_KEY) === 'true';
  }

  /**
   * Check if user has seen a specific page tour
   */
  hasSeenPageTour(pageId: TourPageId): boolean {
    return localStorage.getItem(`${STORAGE_PREFIX}${pageId}`) === 'true';
  }

  /**
   * Mark intro as completed
   */
  #markIntroCompleted(): void {
    localStorage.setItem(INTRO_KEY, 'true');
  }

  /**
   * Mark a page tour as completed
   */
  #markPageTourCompleted(pageId: TourPageId): void {
    localStorage.setItem(`${STORAGE_PREFIX}${pageId}`, 'true');
  }

  /**
   * Reset all tours (for testing)
   */
  resetAllTours(): void {
    localStorage.removeItem(INTRO_KEY);
    localStorage.removeItem(`${STORAGE_PREFIX}current-month`);
    localStorage.removeItem(`${STORAGE_PREFIX}budget-list`);
    localStorage.removeItem(`${STORAGE_PREFIX}budget-details`);
    localStorage.removeItem(`${STORAGE_PREFIX}templates-list`);
    // Clean up old key
    localStorage.removeItem('pulpe_tour_completed');
  }

  /**
   * Start a page-specific tour
   * Includes intro steps if user hasn't seen them yet
   */
  startPageTour(pageId: TourPageId): void {
    const includeIntro = !this.hasSeenIntro();
    const steps = this.#getStepsForPage(pageId, includeIntro);

    // Create driver instance first to avoid closure timing issues
    const tourDriver = driver();

    const driverConfig: Config = {
      showProgress: true,
      showButtons: ['next', 'previous'],
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
      onDestroyStarted: () => {
        tourDriver.destroy();
      },
      onDestroyed: () => {
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
          <p class="mb-3">Pulpe vous aide à gérer votre budget suisse avec simplicité.</p>
          <p class="text-sm opacity-70">Découvrons ensemble les fonctionnalités principales.</p>
        `,
      },
    },
    {
      element: '[data-tour="navigation"]',
      popover: {
        title: 'Menu de navigation',
        description: `
          <p class="mb-3">Pulpe est organisé en <strong>3 sections</strong> :</p>
          <ul class="space-y-2 text-sm leading-relaxed">
            <li><strong>Ce mois-ci</strong> : Suivez vos dépenses du mois</li>
            <li><strong>Budgets</strong> : Planifiez vos mois à l'avance</li>
            <li><strong>Modèles</strong> : Créez des bases réutilisables</li>
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
        title: 'Votre progression',
        description: `
          <p>Cette barre indique où vous en êtes dans votre budget mensuel.</p>
          <p class="text-sm opacity-70 mt-2">Dépenses réalisées vs. budget disponible.</p>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="expense-lists"]',
      popover: {
        title: 'Vos dépenses',
        description: `
          <p class="mb-2">Deux types de dépenses sont affichées :</p>
          <ul class="text-sm space-y-1">
            <li><strong>Récurrentes</strong> : Loyer, assurances, abonnements</li>
            <li><strong>Variables</strong> : Courses, restaurants, loisirs</li>
          </ul>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="add-transaction-fab"]',
      popover: {
        title: 'Ajouter une dépense',
        description: `
          <p>Cliquez ici pour enregistrer une nouvelle dépense rapidement.</p>
          <p class="text-sm opacity-70 mt-2">Le suivi quotidien est la clé d'un budget maîtrisé.</p>
        `,
        side: 'left',
        align: 'center',
      },
    },
  ];

  readonly #budgetListSteps: DriveStep[] = [
    {
      element: '[data-tour="year-tabs"]',
      popover: {
        title: 'Navigation par année',
        description: `
          <p>Basculez entre les années pour planifier sur le long terme.</p>
          <p class="text-sm opacity-70 mt-2">Vous pouvez préparer jusqu'à 8 ans à l'avance.</p>
        `,
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="calendar-grid"]',
      popover: {
        title: 'Calendrier des budgets',
        description: `
          <p>Chaque case représente un mois.</p>
          <p class="text-sm opacity-70 mt-2">Cliquez sur un mois vide pour créer un nouveau budget.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="create-budget"]',
      popover: {
        title: 'Créer un budget',
        description: `
          <p>Créez un budget à partir d'un modèle existant.</p>
          <p class="text-sm opacity-70 mt-2">Les modèles vous font gagner du temps.</p>
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
        title: "Vue d'ensemble",
        description: `
          <p class="mb-2">4 indicateurs clés de votre mois :</p>
          <ul class="text-sm space-y-1">
            <li><strong>Revenus</strong> : Total des entrées d'argent</li>
            <li><strong>Dépenses</strong> : Total des sorties prévues</li>
            <li><strong>Épargne</strong> : Ce que vous mettez de côté</li>
            <li><strong>Reste à vivre</strong> : Votre budget quotidien</li>
          </ul>
        `,
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="budget-table"]',
      popover: {
        title: 'Détail du budget',
        description: `
          <p>Toutes vos lignes de budget sont listées ici.</p>
          <p class="text-sm opacity-70 mt-2">Cliquez sur une ligne pour voir les transactions associées.</p>
        `,
        side: 'top',
        align: 'center',
      },
    },
    {
      element: '[data-tour="add-budget-line"]',
      popover: {
        title: 'Ajouter une ligne',
        description: `
          <p>Ajoutez un revenu, une dépense ou une épargne.</p>
          <p class="text-sm opacity-70 mt-2">Chaque ligne peut être fixe ou variable.</p>
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
        title: 'Vos modèles',
        description: `
          <p>Les modèles sont des budgets types réutilisables.</p>
          <p class="text-sm opacity-70 mt-2">Créez-en un par type de mois (normal, vacances, etc.).</p>
        `,
        side: 'top',
        align: 'start',
      },
    },
    {
      element: '[data-tour="template-counter"]',
      popover: {
        title: 'Limite de modèles',
        description: `
          <p>Vous pouvez créer jusqu'à 5 modèles.</p>
          <p class="text-sm opacity-70 mt-2">Gardez les choses simples avec quelques modèles bien pensés.</p>
        `,
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="create-template"]',
      popover: {
        title: 'Créer un modèle',
        description: `
          <p>Définissez vos revenus et dépenses récurrents.</p>
          <p class="text-sm opacity-70 mt-2">Ce modèle servira de base pour vos futurs budgets.</p>
        `,
        side: 'left',
        align: 'start',
      },
    },
  ];
}
