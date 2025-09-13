import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DemoModeService } from './demo-mode.service';
import { DemoDataGenerator } from './demo-data-generator';
import { ROUTES } from '../routing';
import { Logger } from '../logging/logger';
import { AuthApi } from '../auth/auth-api';

@Injectable({
  providedIn: 'root',
})
export class DemoInitializerService {
  readonly #router = inject(Router);
  readonly #demoMode = inject(DemoModeService);
  readonly #dataGenerator = inject(DemoDataGenerator);
  readonly #logger = inject(Logger);
  readonly #authApi = inject(AuthApi);

  /**
   * Initialise le mode démo et redirige vers le dashboard
   */
  async initializeDemoMode(): Promise<void> {
    try {
      this.#logger.info('🎭 Initialisation du mode démo...');

      // Activer le mode démo
      this.#demoMode.enableDemoMode();

      // Vérifier si les données sont déjà initialisées
      if (!this.#demoMode.isInitialized()) {
        this.#logger.info('🎭 Génération des données de démonstration...');

        // Générer toutes les données
        const demoData = this.#dataGenerator.generateAllDemoData();

        // Sauvegarder les données dans localStorage
        this.#demoMode.saveDemoData('user', demoData.user);
        this.#demoMode.saveDemoData('session', demoData.session);
        this.#demoMode.saveDemoData('templates', demoData.templates);
        this.#demoMode.saveDemoData('template-lines', demoData.templateLines);
        this.#demoMode.saveDemoData('budgets', demoData.budgets);
        this.#demoMode.saveDemoData('budget-lines', demoData.budgetLines);
        this.#demoMode.saveDemoData('transactions', demoData.transactions);

        // Trouver le budget du mois en cours
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const currentBudget = demoData.budgets.find(
          (b) => b.month === currentMonth && b.year === currentYear,
        );

        if (currentBudget) {
          // Sauvegarder le budget courant pour un accès rapide
          localStorage.setItem(
            'pulpe-current-budget',
            JSON.stringify(currentBudget),
          );
        }

        // Marquer comme initialisé
        this.#demoMode.markAsInitialized();

        this.#logger.info('🎭 Données de démonstration générées avec succès');
      } else {
        this.#logger.info(
          '🎭 Mode démo déjà initialisé, utilisation des données existantes',
        );
      }

      // IMPORTANT: Réinitialiser l'état d'authentification pour prendre en compte la session démo
      // Cela est nécessaire car initializeAuthState() a été appelé avant l'activation du mode démo
      await this.#authApi.initializeAuthState();
      this.#logger.info(
        "🎭 État d'authentification mis à jour pour le mode démo",
      );

      // Naviguer vers le dashboard du mois en cours
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      await this.#router.navigate([
        '/',
        ROUTES.APP,
        ROUTES.BUDGET,
        currentYear.toString(),
        currentMonth.toString().padStart(2, '0'),
      ]);

      this.#logger.info('🎭 Mode démo activé avec succès');
    } catch (error) {
      this.#logger.error(
        "Erreur lors de l'initialisation du mode démo:",
        error,
      );

      // En cas d'erreur, désactiver le mode démo
      this.#demoMode.disableDemoMode();

      // Rediriger vers la page d'accueil
      await this.#router.navigate(['/']);

      throw error;
    }
  }

  /**
   * Vérifie si le mode démo est actif et redirige si nécessaire
   */
  async checkAndRedirectIfDemo(): Promise<boolean> {
    if (this.#demoMode.isDemoMode()) {
      if (!this.#demoMode.isInitialized()) {
        // Si le mode démo est actif mais pas initialisé, l'initialiser
        await this.initializeDemoMode();
      } else {
        // Si déjà initialisé, juste rediriger vers le dashboard
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        await this.#router.navigate([
          '/',
          ROUTES.APP,
          ROUTES.BUDGET,
          currentYear.toString(),
          currentMonth.toString().padStart(2, '0'),
        ]);
      }
      return true;
    }
    return false;
  }

  /**
   * Quitte le mode démo et retourne à la page d'accueil
   */
  async exitDemoMode(): Promise<void> {
    this.#logger.info('🎭 Sortie du mode démo...');

    // Désactiver et nettoyer le mode démo
    this.#demoMode.disableDemoMode();

    // Rediriger vers la page d'accueil
    await this.#router.navigate(['/']);

    this.#logger.info('🎭 Mode démo désactivé');
  }

  /**
   * Réinitialise les données du mode démo
   */
  async resetDemoData(): Promise<void> {
    if (!this.#demoMode.isDemoMode()) {
      this.#logger.warn(
        "Tentative de réinitialisation alors que le mode démo n'est pas actif",
      );
      return;
    }

    this.#logger.info('🎭 Réinitialisation des données de démonstration...');

    // Réinitialiser les données
    this.#demoMode.resetDemoData();

    // Réinitialiser avec de nouvelles données
    await this.initializeDemoMode();

    this.#logger.info('🎭 Données de démonstration réinitialisées');
  }
}
