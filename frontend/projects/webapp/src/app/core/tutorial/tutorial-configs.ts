import type { Step, StepOptions, Tour } from 'shepherd.js';
import { offset, flip, shift } from '@floating-ui/dom';
import type { TutorialTour } from './tutorial.types';
import { ROUTES } from '../routing/routes-constants';

/**
 * Constants for tutorial configuration
 */
const ELEMENT_WAIT_TIMEOUT_MS = 5000;
const EXTENDED_WAIT_TIMEOUT_MS = 10000;
const MODAL_OVERLAY_PADDING_PX = 10;
const MODAL_OVERLAY_RADIUS_PX = 12;
const STEP_OFFSET_MAIN_AXIS_PX = 24;
const VIEWPORT_PADDING_PX = 16;

/**
 * Logger for tutorial configs.
 * Note: Uses console because this file contains static configurations
 * without Angular DI context. The service handles structured logging.
 */
const logConfigError = (message: string, context?: unknown): void => {
  console.warn(`[Tutorial] ${message}`, context ?? '');
};

/**
 * Creates a lazy element query function for Shepherd step attachments.
 * Returns a function that queries the DOM when called (not at definition time).
 */
const querySelector =
  (selector: string): (() => HTMLElement | null) =>
  () =>
    document.querySelector(selector);

/**
 * Injects step counter and progress dots into the step element
 * Called on each step show event
 */
function injectStepUI(this: Step): void {
  const tour = this.tour;
  if (!tour || !this.el) return;

  const currentStepIndex = tour.steps.indexOf(this);
  const totalSteps = tour.steps.length;
  const header = this.el.querySelector('.shepherd-header');
  const content = this.el.querySelector('.shepherd-content');

  // Inject step counter if not already present
  if (header && !header.querySelector('.shepherd-step-counter')) {
    const counter = document.createElement('span');
    counter.className = 'shepherd-step-counter';
    counter.textContent = `Étape ${currentStepIndex + 1} sur ${totalSteps}`;
    header.insertBefore(counter, header.firstChild);
  }

  // Inject progress dots if not already present
  if (content && !this.el.querySelector('.shepherd-progress')) {
    const progress = document.createElement('div');
    progress.className = 'shepherd-progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-valuenow', String(currentStepIndex + 1));
    progress.setAttribute('aria-valuemin', '1');
    progress.setAttribute('aria-valuemax', String(totalSteps));
    progress.setAttribute(
      'aria-label',
      `Étape ${currentStepIndex + 1} sur ${totalSteps}`,
    );

    progress.innerHTML = tour.steps
      .map((_, i) => {
        const isActive = i === currentStepIndex;
        const isCompleted = i < currentStepIndex;
        const classes = [
          'shepherd-progress__dot',
          isActive ? 'shepherd-progress__dot--active' : '',
          isCompleted ? 'shepherd-progress__dot--completed' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return `<span class="${classes}" aria-hidden="true"></span>`;
      })
      .join('');

    this.el.insertBefore(progress, content);
  }
}

/**
 * Waits for an element to exist in the DOM using MutationObserver.
 * More efficient than polling - fires immediately when element appears.
 */
function waitForElement(
  selector: string,
  timeout = ELEMENT_WAIT_TIMEOUT_MS,
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing instanceof HTMLElement) {
      return resolve(existing);
    }

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      logConfigError(`Element not found within ${timeout}ms: ${selector}`);
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

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Creates a safe beforeShowPromise that handles errors gracefully
 * If the element is not found, the step will be skipped
 */
function createSafeBeforeShowPromise(
  selector: string,
  timeout = EXTENDED_WAIT_TIMEOUT_MS,
): () => Promise<HTMLElement | void> {
  return async function (this: { tour?: Tour }) {
    try {
      return await waitForElement(selector, timeout);
    } catch (error) {
      logConfigError('Step skipped - element not found', { selector, error });
      // Cancel the tour gracefully instead of leaving it in a broken state
      this.tour?.cancel();
      throw error; // Re-throw to prevent step from showing
    }
  };
}

/**
 * Default step options applied to all tutorial steps
 */
export const defaultStepOptions: Partial<StepOptions> = {
  cancelIcon: {
    enabled: true,
  },
  classes: 'pulpe-tutorial-step',
  scrollTo: { behavior: 'smooth', block: 'center' } as ScrollIntoViewOptions,
  modalOverlayOpeningPadding: MODAL_OVERLAY_PADDING_PX,
  modalOverlayOpeningRadius: MODAL_OVERLAY_RADIUS_PX,
  floatingUIOptions: {
    middleware: [
      offset({ mainAxis: STEP_OFFSET_MAIN_AXIS_PX }),
      flip({ fallbackAxisSideDirection: 'end' }),
      shift({ padding: VIEWPORT_PADDING_PX }),
    ],
  },
  when: {
    show: injectStepUI,
  },
};

/**
 * Common button configurations
 */
const buttons = {
  cancel: {
    text: 'Passer',
    classes: 'shepherd-button-secondary',
    type: 'cancel' as const,
  },
  back: {
    text: 'Précédent',
    classes: 'shepherd-button-secondary',
    type: 'back' as const,
  },
  next: {
    text: 'Suivant',
    classes: 'shepherd-button-primary',
    type: 'next' as const,
  },
  complete: {
    text: 'Terminer',
    classes: 'shepherd-button-primary',
    action(this: Tour) {
      // Complete the tour when button is clicked
      // Note: 'this' refers to the Shepherd Tour instance
      return this.complete();
    },
  },
};

/**
 * SECURITY NOTE: Tour step text uses raw HTML rendered by Shepherd.js.
 * Never interpolate user input into these strings.
 * All text must be static strings defined at build time.
 */

/**
 * Dashboard Welcome Tour - First visit to the current month page
 */
export const dashboardWelcomeTour: TutorialTour = {
  id: 'dashboard-welcome',
  name: 'Découverte du tableau de bord',
  description: 'Apprenez à utiliser votre dashboard budgétaire',
  triggerOn: 'first-visit',
  targetRoute: ROUTES.CURRENT_MONTH,
  steps: [
    {
      id: 'welcome',
      title: 'Bienvenue dans Pulpe ! 👋',
      text: `
        <p>Pulpe vous aide à planifier vos finances mensuelles avec sérénité.</p>
        <p>Découvrons ensemble les fonctionnalités principales !</p>
      `,
      buttons: [buttons.cancel, buttons.next],
    },
    {
      id: 'budget-progress',
      title: 'Votre progression budgétaire',
      text: `
        <p>Cette barre indique votre consommation du budget mensuel :</p>
        <ul>
          <li><strong>Verte</strong> : Tout va bien</li>
          <li><strong>Orange</strong> : Attention (>80%)</li>
          <li><strong>Rouge</strong> : Dépassement</li>
        </ul>
      `,
      attachTo: {
        element: querySelector('pulpe-budget-progress-bar'),
        on: 'bottom',
      },
      // Wait for element before showing step with error handling
      beforeShowPromise: createSafeBeforeShowPromise(
        'pulpe-budget-progress-bar',
      ),
      buttons: [buttons.cancel, buttons.back, buttons.next],
    },
    {
      id: 'financial-entries',
      title: 'Vos prévisions mensuelles',
      text: `
        <p>Retrouvez ici toutes vos <strong>prévisions</strong> (revenus, dépenses, épargne) pour le mois en cours.</p>
        <p>Elles sont organisées entre transactions fixes et ponctuelles.</p>
      `,
      attachTo: {
        element: querySelector('[data-testid="dashboard-content"]'),
        on: 'top',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="dashboard-content"]',
      ),
      buttons: [buttons.cancel, buttons.back, buttons.next],
    },
    {
      id: 'add-transaction-fab',
      title: 'Ajouter une transaction',
      text: `
        <p>Cliquez sur ce bouton pour enregistrer rapidement vos dépenses et revenus réels.</p>
        <p>C'est le moyen le plus rapide de suivre vos dépenses au quotidien !</p>
      `,
      attachTo: {
        element: querySelector('[data-testid="add-transaction-fab"]'),
        on: 'left',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="add-transaction-fab"]',
      ),
      buttons: [buttons.cancel, buttons.back, buttons.complete],
    },
  ],
};

/**
 * Templates Introduction Tour - Guide for budget templates
 */
export const templatesIntroTour: TutorialTour = {
  id: 'templates-intro',
  name: 'Introduction aux modèles',
  description: 'Découvrez comment créer et utiliser des modèles de budget',
  triggerOn: 'first-visit',
  targetRoute: ROUTES.BUDGET_TEMPLATES,
  steps: [
    {
      id: 'templates-intro',
      title: 'Les modèles de budget',
      text: `
        <p>Les <strong>modèles</strong> vous permettent de réutiliser la même structure de budget chaque mois.</p>
        <p>Créez un modèle une fois, utilisez-le toute l'année !</p>
      `,
      buttons: [buttons.cancel, buttons.next],
    },
    {
      id: 'template-counter',
      title: 'Limite de modèles',
      text: `
        <p>Vous pouvez créer jusqu'à <strong>10 modèles</strong> différents.</p>
        <p>C'est largement suffisant pour couvrir tous vos besoins (mois standard, vacances, Noël, etc.).</p>
      `,
      attachTo: {
        element: querySelector('[data-testid="template-counter"]'),
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="template-counter"]',
      ),
      buttons: [buttons.cancel, buttons.back, buttons.next],
    },
    {
      id: 'create-template',
      title: 'Créer un nouveau modèle',
      text: `
        <p>Cliquez ici pour créer un nouveau modèle de budget.</p>
        <p>Définissez vos revenus, dépenses fixes et objectifs d'épargne.</p>
      `,
      attachTo: {
        element: querySelector('[data-testid="create-template-button"]'),
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="create-template-button"]',
      ),
      buttons: [buttons.cancel, buttons.back, buttons.complete],
    },
  ],
};

/**
 * Budget Management Tour - Guide for budget details page
 */
export const budgetManagementTour: TutorialTour = {
  id: 'budget-management',
  name: 'Gestion des budgets',
  description: 'Apprenez à consulter et modifier vos budgets mensuels',
  triggerOn: 'manual',
  steps: [
    {
      id: 'budget-overview',
      title: "Vue d'ensemble financière",
      text: `
        <p>Ces cartes résument votre situation financière du mois :</p>
        <ul>
          <li><strong>Revenus</strong> : Total des entrées</li>
          <li><strong>Dépenses</strong> : Total des sorties</li>
          <li><strong>Épargne prévue</strong> : Montant mis de côté</li>
          <li><strong>Restant</strong> : Ce qu'il vous reste</li>
        </ul>
      `,
      attachTo: {
        element: querySelector('pulpe-budget-financial-overview'),
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        'pulpe-budget-financial-overview',
      ),
      buttons: [buttons.cancel, buttons.next],
    },
    {
      id: 'budget-table',
      title: 'Tableau des prévisions',
      text: `
        <p>Ce tableau liste toutes vos prévisions budgétaires et transactions réelles.</p>
        <p>Vous pouvez ajouter, modifier ou supprimer des lignes directement ici.</p>
      `,
      attachTo: {
        element: querySelector('pulpe-budget-table'),
        on: 'top',
      },
      beforeShowPromise: createSafeBeforeShowPromise('pulpe-budget-table'),
      buttons: [buttons.cancel, buttons.back, buttons.complete],
    },
  ],
};

/**
 * Budget Calendar Tour - Guide for the budget list/calendar page
 */
export const budgetCalendarTour: TutorialTour = {
  id: 'budget-calendar',
  name: 'Calendrier des budgets',
  description: 'Découvrez comment naviguer et créer des budgets mensuels',
  triggerOn: 'first-visit',
  targetRoute: ROUTES.BUDGET,
  steps: [
    {
      id: 'calendar-intro',
      title: 'Votre calendrier budgétaire',
      text: `
        <p>Bienvenue dans votre <strong>calendrier de budgets</strong> !</p>
        <p>Ici, vous pouvez visualiser et gérer tous vos budgets mensuels sur plusieurs années.</p>
      `,
      buttons: [buttons.cancel, buttons.next],
    },
    {
      id: 'create-budget',
      title: 'Créer un nouveau budget',
      text: `
        <p>Cliquez sur ce bouton pour créer un budget pour un nouveau mois.</p>
        <p>Choisissez le mois et le modèle à utiliser comme base.</p>
      `,
      attachTo: {
        element: querySelector('[data-testid="create-budget-btn"]'),
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="create-budget-btn"]',
      ),
      buttons: [buttons.cancel, buttons.back, buttons.next],
    },
    {
      id: 'year-tabs',
      title: 'Navigation par année',
      text: `
        <p>Utilisez ces onglets pour naviguer entre les différentes années.</p>
        <p>Planifiez vos budgets sur le long terme !</p>
      `,
      attachTo: {
        element: querySelector('mat-tab-header'),
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise('mat-tab-header'),
      buttons: [buttons.cancel, buttons.back, buttons.next],
    },
    {
      id: 'month-calendar',
      title: 'Vue des mois',
      text: `
        <p>Chaque case représente un mois. Les mois avec un budget sont colorés.</p>
        <p>Cliquez sur un mois existant pour voir ses détails, ou sur un mois vide pour le créer.</p>
      `,
      attachTo: {
        element: querySelector('.calendar-grid'),
        on: 'top',
      },
      beforeShowPromise: createSafeBeforeShowPromise('.calendar-grid'),
      buttons: [buttons.cancel, buttons.back, buttons.complete],
    },
  ],
};

/**
 * All available tours
 */
export const ALL_TOURS: TutorialTour[] = [
  dashboardWelcomeTour,
  templatesIntroTour,
  budgetManagementTour,
  budgetCalendarTour,
];
