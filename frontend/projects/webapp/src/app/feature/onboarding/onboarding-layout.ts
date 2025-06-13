import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import {
  OnboardingApi,
  OnboardingStepData,
} from '@features/onboarding/onboarding-api';
import { BudgetApi } from '@core/budget';
import { AuthApi } from '@core/auth/auth-api';
import { ROUTES } from '@core/routing/routes-constants';
import { BudgetCreateFromOnboarding } from '@pulpe/shared';
import { firstValueFrom, filter, map, startWith } from 'rxjs';
import Registration from './registration/registration';

export interface OnboardingLayoutData {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
}

@Component({
  selector: 'pulpe-onboarding-layout',
  standalone: true,
  imports: [CommonModule, MatButtonModule, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div
      class="min-h-screen md:h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-3xl min-h-[600px] md:h-[800px] bg-surface rounded-2xl md:p-16 p-8 flex flex-col"
      >
        <!-- Progress indicators -->
        @if (showProgress()) {
          <div class="flex gap-2 mb-16">
            @for (step of progressSteps; track step; let i = $index) {
              <div
                class="h-2 flex-1 rounded-full transition-colors duration-300"
                [class]="
                  i < (currentStepData()?.currentStep ?? 0)
                    ? 'bg-primary'
                    : 'bg-secondary-container'
                "
              ></div>
            }
          </div>
        }

        <!-- Content -->
        <div class="space-y-6 flex-1">
          <div class="text-center space-y-2">
            <h1 class="text-headline-large text-on-surface">
              {{ currentStepData()?.title }}
            </h1>
            @if (currentStepData()?.subtitle) {
              <p
                class="text-body-large text-on-surface-variant leading-relaxed"
              >
                {{ currentStepData()?.subtitle }}
              </p>
            }
          </div>

          <router-outlet (activate)="onActivate($event)"></router-outlet>
        </div>

        <!-- Navigation buttons -->
        <div class="flex md:gap-8 gap-4 mt-8">
          @if (showPreviousButton()) {
            <div class="flex-1">
              <button
                matButton="outlined"
                (click)="onPrevious()"
                class="w-full"
              >
                Précédent
              </button>
            </div>
          }
          <div class="flex-1">
            <button
              matButton="filled"
              (click)="onNext()"
              [disabled]="!canContinue()"
              class="w-full"
            >
              {{ nextButtonText() }}
            </button>
          </div>
        </div>

        <!-- Error and Success messages -->
        @if (errorMessage()) {
          <div
            class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-4"
          >
            {{ errorMessage() }}
          </div>
        }
        @if (successMessage()) {
          <div
            class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mt-4"
          >
            {{ successMessage() }}
          </div>
        }

        <!-- Footer content -->
        <ng-content select="[slot=footer]"></ng-content>
      </div>
    </div>
  `,
})
export class OnboardingLayout {
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #onboardingApi = inject(OnboardingApi);
  #budgetApi = inject(BudgetApi);
  #authService = inject(AuthApi);

  private readonly steps: string[] = [
    'welcome',
    'personal-info',
    'housing',
    'income',
    'health-insurance',
    'phone-plan',
    'transport',
    'leasing-credit',
    'registration',
  ];

  private activatedComponent: WritableSignal<object | null> = signal(null);

  protected currentStepData = signal<OnboardingLayoutData | null>(null);
  protected showPreviousButton = signal<boolean>(true);
  protected showProgress = signal<boolean>(true);
  protected canContinue = signal<boolean>(true);
  protected nextButtonText = signal<string>('Continuer');

  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

  constructor() {
    this.#router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        map((event: NavigationEnd) => {
          const urlSegments = event.urlAfterRedirects.split('/');
          const currentStep = urlSegments[urlSegments.length - 1];
          const stepIndex = this.steps.indexOf(currentStep);
          return { currentStep, stepIndex };
        }),
        startWith({
          currentStep: this.steps[0],
          stepIndex: 0,
        }),
      )
      .subscribe(({ currentStep, stepIndex }) => {
        this.#updateLayoutForStep(currentStep, stepIndex);
      });
  }

  onActivate(component: object) {
    this.activatedComponent.set(component);

    if ('onboardingLayoutData' in component && component.onboardingLayoutData) {
      this.currentStepData.set(
        component.onboardingLayoutData as OnboardingLayoutData,
      );
    }
    if ('canContinue' in component && component.canContinue) {
      this.canContinue = component.canContinue as WritableSignal<boolean>;
    }
  }

  protected get progressSteps(): number[] {
    const totalSteps = this.currentStepData()?.totalSteps ?? this.steps.length;
    return Array(totalSteps).fill(0);
  }

  protected onPrevious(): void {
    const currentStepIndex = this.#getCurrentStepIndex();
    if (currentStepIndex > 0) {
      const previousStep = this.steps[currentStepIndex - 1];
      this.#router.navigate([`./${previousStep}`], { relativeTo: this.#route });
    }
  }

  protected onNext(): void {
    const currentStepIndex = this.#getCurrentStepIndex();
    const isLastStep = currentStepIndex === this.steps.length - 1;

    if (isLastStep) {
      this.registerAndCreateAccount();
    } else if (currentStepIndex < this.steps.length - 1) {
      const nextStep = this.steps[currentStepIndex + 1];
      this.#router.navigate([`./${nextStep}`], { relativeTo: this.#route });
    }
  }

  private async registerAndCreateAccount(): Promise<void> {
    const registrationComponent = this.activatedComponent() as Registration;
    if (
      !registrationComponent ||
      typeof registrationComponent.canContinue !== 'function' ||
      !registrationComponent.canContinue()
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const email = registrationComponent.emailValue();
      const password = registrationComponent.passwordValue();

      const authResult = await this.#authService.signUpWithEmail(
        email,
        password,
      );

      if (!authResult.success) {
        this.errorMessage.set(
          authResult.error || 'Erreur lors de la création du compte',
        );
        return;
      }

      const onboardingPayload = this.#onboardingApi.getStateData();
      const budgetRequest = this.#buildBudgetCreationRequest(onboardingPayload);
      await firstValueFrom(
        this.#budgetApi.createBudgetFromOnboarding$(budgetRequest),
      );

      this.#onboardingApi.submitCompletedOnboarding();
      this.#onboardingApi.clearOnboardingData();

      this.successMessage.set(
        'Votre compte a été créé avec succès ! Redirection vers votre budget...',
      );

      setTimeout(() => this.#router.navigate([ROUTES.CURRENT_MONTH]), 2000);
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  #buildBudgetCreationRequest(
    payload: OnboardingStepData,
  ): BudgetCreateFromOnboarding {
    const currentDate = new Date();
    return {
      monthlyIncome: payload.monthlyIncome ?? 0,
      housingCosts: payload.housingCosts ?? 0,
      healthInsurance: payload.healthInsurance ?? 0,
      leasingCredit: payload.leasingCredit ?? 0,
      phonePlan: payload.phonePlan ?? 0,
      transportCosts: payload.transportCosts ?? 0,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      description: `Budget initial de ${payload.firstName} pour ${currentDate.getFullYear()}`,
    };
  }

  #getCurrentStepIndex(): number {
    const url = this.#router.url;
    const urlSegments = url.split('/');
    const currentStep = urlSegments[urlSegments.length - 1];
    return this.steps.indexOf(currentStep);
  }

  #updateLayoutForStep(step: string, index: number): void {
    this.showPreviousButton.set(index > 0);
    const isLastStep = index === this.steps.length - 1;

    this.nextButtonText.set(
      this.isSubmitting()
        ? 'Création en cours...'
        : isLastStep
          ? "Je m'inscris"
          : 'Continuer',
    );
  }
}
