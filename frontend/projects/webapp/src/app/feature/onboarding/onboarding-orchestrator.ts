import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';
import { OnboardingLayoutData } from './models/onboarding-layout-data';

export enum RegistrationProcessStep {
  AUTHENTICATION = 'authentication',
  TEMPLATE_CREATION = 'template_creation',
  BUDGET_CREATION = 'budget_creation',
  COMPLETION = 'completion',
}

export interface ProcessState {
  currentStep: RegistrationProcessStep;
  templateId?: string;
  completedSteps: RegistrationProcessStep[];
}

const PROCESS_STATE_KEY = 'pulpe-registration-process-state';

@Injectable()
export class OnboardingOrchestrator {
  public layoutData = signal<OnboardingLayoutData | null>(null);
  public canContinue = signal<boolean>(false);
  public isSubmitting = signal<boolean>(false);
  public nextButtonText = signal<string>('Continuer');

  readonly #processState = signal<ProcessState>({
    currentStep: RegistrationProcessStep.AUTHENTICATION,
    completedSteps: [],
  });

  public nextClicked$ = new Subject<void>();
  public previousClicked$ = new Subject<void>();

  // Read-only access to process state
  readonly processState = this.#processState.asReadonly();

  // Computed values for easy access
  readonly isAuthenticationCompleted = computed(() =>
    this.#processState().completedSteps.includes(
      RegistrationProcessStep.AUTHENTICATION,
    ),
  );

  readonly isTemplateCreationCompleted = computed(() =>
    this.#processState().completedSteps.includes(
      RegistrationProcessStep.TEMPLATE_CREATION,
    ),
  );

  readonly currentStepToRetry = computed(
    () => this.#processState().currentStep,
  );

  readonly retryButtonText = computed(() => {
    const processState = this.#processState();
    const isRetry = processState.completedSteps.length > 0;

    if (!isRetry) {
      return 'Terminer';
    }

    switch (processState.currentStep) {
      case RegistrationProcessStep.TEMPLATE_CREATION:
        return 'Créer le template';
      case RegistrationProcessStep.BUDGET_CREATION:
        return 'Créer le budget';
      case RegistrationProcessStep.COMPLETION:
        return 'Finaliser';
      default:
        return 'Réessayer';
    }
  });

  constructor() {
    this.loadProcessStateFromLocalStorage();
  }

  /**
   * Marks a process step as completed
   */
  markStepCompleted(step: RegistrationProcessStep, templateId?: string): void {
    const currentState = this.#processState();
    if (!currentState.completedSteps.includes(step)) {
      this.#processState.update((state) => ({
        ...state,
        completedSteps: [...state.completedSteps, step],
        templateId: templateId || state.templateId,
      }));
      this.saveProcessStateToLocalStorage();
    }
  }

  /**
   * Updates the current step being processed
   */
  updateCurrentStep(step: RegistrationProcessStep): void {
    this.#processState.update((state) => ({
      ...state,
      currentStep: step,
    }));
    this.saveProcessStateToLocalStorage();
  }

  /**
   * Resets the process state
   */
  resetProcessState(): void {
    this.#processState.set({
      currentStep: RegistrationProcessStep.AUTHENTICATION,
      completedSteps: [],
    });
    this.clearProcessStateFromLocalStorage();
  }

  private saveProcessStateToLocalStorage(): void {
    try {
      const processState = this.#processState();
      localStorage.setItem(PROCESS_STATE_KEY, JSON.stringify(processState));
    } catch (error) {
      console.error('Failed to save process state to localStorage:', error);
    }
  }

  private loadProcessStateFromLocalStorage(): void {
    try {
      const savedState = localStorage.getItem(PROCESS_STATE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState) as ProcessState;
        this.#processState.set(parsedState);
      }
    } catch (error) {
      console.error('Failed to load process state from localStorage:', error);
    }
  }

  private clearProcessStateFromLocalStorage(): void {
    try {
      localStorage.removeItem(PROCESS_STATE_KEY);
    } catch (error) {
      console.error('Failed to clear process state from localStorage:', error);
    }
  }
}
