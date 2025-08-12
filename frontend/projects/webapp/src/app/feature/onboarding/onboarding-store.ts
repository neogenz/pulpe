import { Injectable, signal, inject, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { AuthApi } from '../../core/auth/auth-api';
import { BudgetApi } from '../../core/budget';
import { OnboardingApi } from './services/onboarding-api';
import {
  type BudgetCreate,
  type BudgetTemplateCreateFromOnboarding,
} from '@pulpe/shared';

export interface OnboardingData {
  firstName: string;
  email: string;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  leasingCredit: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  isUserCreated: boolean;
}

const STORAGE_KEY = 'pulpe-onboarding-data';

export const STEP_ORDER = [
  'welcome',
  'personal-info',
  'income',
  'housing',
  'health-insurance',
  'phone-plan',
  'transport',
  'leasing-credit',
  'registration',
] as const;

export type OnboardingStep = (typeof STEP_ORDER)[number];

@Injectable()
export class OnboardingStore {
  readonly #authApi = inject(AuthApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #onboardingApi = inject(OnboardingApi);
  readonly #router = inject(Router);

  readonly #data = signal<OnboardingData>({
    firstName: '',
    email: '',
    monthlyIncome: null,
    housingCosts: null,
    healthInsurance: null,
    leasingCredit: null,
    phonePlan: null,
    transportCosts: null,
    isUserCreated: false,
  });

  readonly #isSubmitting = signal(false);
  readonly #error = signal('');

  readonly data = this.#data.asReadonly();
  readonly isSubmitting = this.#isSubmitting.asReadonly();
  readonly error = this.#error.asReadonly();

  // Progress tracking - signal réactif basé sur les événements de navigation
  readonly #currentUrl = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => (event as NavigationEnd).url),
      startWith(this.#router.url),
    ),
    { initialValue: this.#router.url },
  );

  readonly currentStep = computed(() => {
    const url = this.#currentUrl();
    const stepName = url.split('/').pop();
    return STEP_ORDER.indexOf(stepName as (typeof STEP_ORDER)[number]);
  });

  readonly totalSteps = STEP_ORDER.length;
  readonly isFirstStep = computed(() => this.currentStep() === 0);

  constructor() {
    this.#loadFromStorage();
  }

  updateField(
    field: keyof OnboardingData,
    value: string | number | null,
  ): void {
    this.#data.update((data) => ({ ...data, [field]: value }));
    this.#saveToStorage();
  }

  updateEmail(email: string): void {
    this.#data.update((data) => ({ ...data, email }));
    this.#saveToStorage();
  }

  clearError(): void {
    this.#error.set('');
  }

  resetUserCreationState(): void {
    this.#data.update((data) => ({ ...data, isUserCreated: false }));
  }

  async submitRegistration(email: string, password: string): Promise<boolean> {
    const data = this.#data();

    if (!data.firstName || !data.monthlyIncome || data.monthlyIncome <= 0) {
      this.#error.set('Données obligatoires manquantes');
      return false;
    }

    this.#isSubmitting.set(true);
    this.#error.set('');

    try {
      // 1. Créer le compte seulement s'il n'a pas déjà été créé
      if (!data.isUserCreated) {
        const authResult = await this.#authApi.signUpWithEmail(email, password);
        if (!authResult.success) {
          this.#error.set(
            authResult.error || 'Erreur lors de la création du compte',
          );
          return false;
        }
        // Marquer que l'utilisateur a été créé avec succès
        this.#data.update((data) => ({ ...data, isUserCreated: true }));
      }

      // 2. Créer le template
      const templateRequest: BudgetTemplateCreateFromOnboarding = {
        name: 'Mois Standard',
        description: `Template personnel de ${data.firstName}`,
        isDefault: true,
        monthlyIncome: data.monthlyIncome,
        housingCosts: data.housingCosts ?? 0,
        healthInsurance: data.healthInsurance ?? 0,
        leasingCredit: data.leasingCredit ?? 0,
        phonePlan: data.phonePlan ?? 0,
        transportCosts: data.transportCosts ?? 0,
        customTransactions: [],
      };

      const templateResponse = await firstValueFrom(
        this.#onboardingApi.createTemplateFromOnboarding$(templateRequest),
      );

      // 3. Créer le budget
      const currentDate = new Date();
      const budgetRequest: BudgetCreate = {
        templateId: templateResponse.data.template.id,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        description: `Budget initial de ${data.firstName} pour ${currentDate.getFullYear()}`,
      };

      await firstValueFrom(this.#budgetApi.createBudget$(budgetRequest));

      // 4. Nettoyer et rediriger
      this.#clearStorage();
      return true;
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);

      // Déterminer le type d'erreur selon le stack trace ou le message
      const errorMessage = error?.toString() || '';
      const errorObj = error as { message?: string };
      if (
        errorMessage.includes('template') ||
        errorObj?.message?.includes('template')
      ) {
        this.#error.set(
          'Erreur lors de la création de votre template budgétaire.',
        );
      } else if (
        errorMessage.includes('budget') ||
        errorObj?.message?.includes('budget')
      ) {
        this.#error.set('Erreur lors de la création de votre budget initial.');
      } else {
        this.#error.set("Une erreur inattendue s'est produite");
      }

      return false;
    } finally {
      this.#isSubmitting.set(false);
    }
  }

  #saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#data()));
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error);
    }
  }

  #loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.#data.set(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Erreur chargement localStorage:', error);
    }
  }

  #clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Erreur suppression localStorage:', error);
    }
  }
}
