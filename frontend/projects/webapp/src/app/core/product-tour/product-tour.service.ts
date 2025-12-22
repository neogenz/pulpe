/**
 * Product Tour Service using Driver.js
 *
 * Simple, robust product tour with spotlight highlighting.
 * Uses Driver.js library with Material Design 3 theming.
 */

import { Injectable } from '@angular/core';
import { driver, type DriveStep, type Config } from 'driver.js';

const TOUR_STORAGE_KEY = 'pulpe_tour_completed';

@Injectable({
  providedIn: 'root',
})
export class ProductTourService {
  /**
   * Check if user has already seen the tour
   */
  hasSeenTour(): boolean {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  }

  /**
   * Mark tour as completed
   */
  private markTourCompleted(): void {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }

  /**
   * Reset tour (for testing)
   */
  resetTour(): void {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  }

  /**
   * Start the Pulpe product tour
   */
  startTour(): void {
    const tourSteps: DriveStep[] = [
      {
        popover: {
          title: 'Bienvenue dans Pulpe',
          description: `
            <p class="mb-3">Pulpe vous aide à gérer votre budget suisse avec simplicité.</p>
            <p class="text-sm opacity-70">Découvrons ensemble les fonctionnalités principales en quelques étapes.</p>
          `,
        },
      },
      {
        element: '[data-tour="navigation"]',
        popover: {
          title: 'Menu de navigation',
          description: `
            <p class="mb-3">Pulpe est organisé en <strong>3 sections principales</strong> :</p>
            <ul class="space-y-2 text-sm leading-relaxed">
              <li><strong>Ce mois-ci</strong> : Suivez vos dépenses du mois en cours</li>
              <li><strong>Budgets</strong> : Planifiez tous vos mois à l'avance</li>
              <li><strong>Modèles</strong> : Créez des bases mensuelles réutilisables</li>
            </ul>
          `,
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="page-content"]',
        popover: {
          title: 'Tableau de bord',
          description: `
            <p class="mb-2">C'est ici que vous gérez votre budget au quotidien.</p>
            <p class="text-sm opacity-70">Naviguez entre les sections pour créer vos modèles et suivre vos dépenses.</p>
          `,
          side: 'top',
          align: 'center',
        },
      },
      {
        popover: {
          title: 'Vous êtes prêt',
          description: `
            <p class="mb-4">Vous connaissez maintenant les bases de Pulpe.</p>
            <div class="bg-surface-container rounded-lg p-4">
              <p class="font-medium mb-3">Prochaines étapes</p>
              <ol class="space-y-2 text-sm leading-relaxed opacity-80">
                <li>Créez votre premier modèle mensuel</li>
                <li>Ajoutez vos revenus et dépenses récurrents</li>
                <li>Suivez votre budget dans "Ce mois-ci"</li>
              </ol>
            </div>
          `,
        },
      },
    ];

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
        this.markTourCompleted();
        tourDriver.destroy();
      },
      onDestroyed: () => {
        this.markTourCompleted();
      },
    };

    const tourDriver = driver(driverConfig);
    tourDriver.setSteps(tourSteps);
    tourDriver.drive();
  }
}
