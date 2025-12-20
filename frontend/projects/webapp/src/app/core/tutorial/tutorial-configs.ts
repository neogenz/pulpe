import type { StepOptions, Tour } from 'shepherd.js';
import { offset } from '@floating-ui/dom';
import type { TutorialTour } from './tutorial.types';

/**
 * Helper function to wait for an element to exist in the DOM
 * @param selector CSS selector to wait for
 * @param timeout Maximum time to wait in milliseconds (default: 5000ms)
 * @returns Promise that resolves when element is found
 */
function waitForElement(
  selector: string,
  timeout = 5000,
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Check if element already exists
    try {
      const existingElement = document.querySelector(selector);
      if (existingElement instanceof HTMLElement) {
        resolve(existingElement);
        return;
      }
    } catch (error) {
      console.error('[Tutorial] Error checking existing element:', {
        selector,
        error,
      });
    }

    // Poll for element existence
    const checkInterval = setInterval(() => {
      try {
        const element = document.querySelector(selector);

        if (element instanceof HTMLElement) {
          clearInterval(checkInterval);
          resolve(element);
        } else if (Date.now() - startTime >= timeout) {
          clearInterval(checkInterval);
          console.error(
            `[Tutorial] Element not found within ${timeout}ms: ${selector}`,
          );
          reject(
            new Error(`Element ${selector} not found within ${timeout}ms`),
          );
        }
      } catch (error) {
        clearInterval(checkInterval);
        console.error('[Tutorial] Error in waitForElement:', {
          selector,
          error,
        });
        reject(error);
      }
    }, 100); // Check every 100ms
  });
}

/**
 * Creates a safe beforeShowPromise that handles errors gracefully
 * If the element is not found, the step will be skipped
 */
function createSafeBeforeShowPromise(
  selector: string,
  timeout = 10000,
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
  modalOverlayOpeningPadding: 10,
  modalOverlayOpeningRadius: 12,
  floatingUIOptions: {
    middleware: [offset({ mainAxis: 24 })],
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
 * Dashboard Welcome Tour - First visit to the current month page
 */
export const dashboardWelcomeTour: TutorialTour = {
  id: 'dashboard-welcome',
  name: 'Découverte du tableau de bord',
  description: 'Apprenez à utiliser votre dashboard budgétaire',
  triggerOn: 'first-visit',
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
        // Lazy evaluation - query element when step is shown
        element: () =>
          document.querySelector('pulpe-budget-progress-bar') as HTMLElement,
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
        element: () =>
          document.querySelector(
            '[data-testid="dashboard-content"]',
          ) as HTMLElement,
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
        element: () =>
          document.querySelector(
            '[data-testid="add-transaction-fab"]',
          ) as HTMLElement,
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
 * Add Transaction Tour - Guide for the transaction bottom sheet
 */
export const addTransactionTour: TutorialTour = {
  id: 'add-transaction',
  name: 'Ajouter une transaction',
  description: 'Apprenez à enregistrer vos dépenses quotidiennes',
  triggerOn: 'manual',
  steps: [
    {
      id: 'transaction-form',
      title: 'Formulaire de transaction',
      text: `
        <p>Ce formulaire vous permet d'ajouter une dépense, un revenu ou une épargne ponctuelle.</p>
        <p>C'est simple et rapide !</p>
      `,
      attachTo: {
        element: () =>
          document.querySelector(
            '[data-testid="transaction-form"]',
          ) as HTMLElement,
        on: 'top',
      },
      // Wait for bottom sheet to open and render
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="transaction-form"]',
        5000,
      ),
      buttons: [buttons.cancel, buttons.next],
    },
    {
      id: 'transaction-amount',
      title: 'Montant de la transaction',
      text: `
        <p>Saisissez le montant de votre transaction en CHF.</p>
        <p>Vous pouvez aussi utiliser les montants rapides juste en dessous !</p>
      `,
      attachTo: {
        element: () =>
          document.querySelector(
            '[data-testid="transaction-amount-input"]',
          ) as HTMLElement,
        on: 'bottom',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="transaction-amount-input"]',
        5000,
      ),
      buttons: [buttons.cancel, buttons.back, buttons.next],
    },
    {
      id: 'transaction-type',
      title: 'Type de transaction',
      text: `
        <p>Choisissez le type :</p>
        <ul>
          <li><strong>Revenu</strong> : Entrée d'argent</li>
          <li><strong>Dépense</strong> : Sortie d'argent (défaut)</li>
          <li><strong>Épargne</strong> : Montant mis de côté</li>
        </ul>
      `,
      attachTo: {
        element: () =>
          document.querySelector(
            '[data-testid="transaction-type-select"]',
          ) as HTMLElement,
        on: 'top',
      },
      beforeShowPromise: createSafeBeforeShowPromise(
        '[data-testid="transaction-type-select"]',
        5000,
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
  triggerOn: 'manual',
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
        element: () =>
          document.querySelector(
            '[data-testid="template-counter"]',
          ) as HTMLElement,
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
        element: () =>
          document.querySelector(
            '[data-testid="create-template-button"]',
          ) as HTMLElement,
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
        element: () =>
          document.querySelector(
            'pulpe-budget-financial-overview',
          ) as HTMLElement,
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
        element: () =>
          document.querySelector('pulpe-budget-table') as HTMLElement,
        on: 'top',
      },
      beforeShowPromise: createSafeBeforeShowPromise('pulpe-budget-table'),
      buttons: [buttons.cancel, buttons.back, buttons.complete],
    },
  ],
};

/**
 * All available tours
 */
export const ALL_TOURS: TutorialTour[] = [
  dashboardWelcomeTour,
  addTransactionTour,
  templatesIntroTour,
  budgetManagementTour,
];
