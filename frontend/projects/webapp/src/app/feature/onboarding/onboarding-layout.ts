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
import { filter, map, startWith } from 'rxjs';

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

        <!-- Footer content -->
        <ng-content select="[slot=footer]"></ng-content>
      </div>
    </div>
  `,
})
export class OnboardingLayout {
  #router = inject(Router);
  #route = inject(ActivatedRoute);

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

  private activatedComponent: WritableSignal<{
    onboardingLayoutData?: OnboardingLayoutData;
    canContinue?: WritableSignal<boolean>;
    isSubmitting?: () => boolean;
    registerAndCreateAccount?: () => Promise<void>;
  } | null> = signal(null);

  protected currentStepData = signal<OnboardingLayoutData | null>(null);
  protected showPreviousButton = signal<boolean>(true);
  protected showProgress = signal<boolean>(true);
  protected canContinue: WritableSignal<boolean> = signal(true);
  protected nextButtonText = signal<string>('Continuer');

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
          currentStep:
            this.steps.find((s) => this.#router.url.includes(s)) ?? 'welcome',
          stepIndex: this.steps.findIndex((s) => this.#router.url.includes(s)),
        }),
      )
      .subscribe(({ currentStep, stepIndex }) => {
        this.#updateLayoutForStep(currentStep, stepIndex);
      });
  }

  onActivate(
    component: {
      onboardingLayoutData?: OnboardingLayoutData;
      canContinue?: WritableSignal<boolean>;
    } | null,
  ) {
    this.activatedComponent.set(component);

    if (component?.onboardingLayoutData) {
      this.currentStepData.set(component.onboardingLayoutData);
    }
    if (component?.canContinue) {
      this.canContinue = component.canContinue;
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

  protected async onNext(): Promise<void> {
    const currentStepIndex = this.#getCurrentStepIndex();
    const isLastStep = currentStepIndex === this.steps.length - 1;

    if (isLastStep) {
      const activeComponent = this.activatedComponent();
      if (activeComponent && activeComponent.registerAndCreateAccount) {
        await activeComponent.registerAndCreateAccount();
      }
    } else if (currentStepIndex < this.steps.length - 1) {
      const nextStep = this.steps[currentStepIndex + 1];
      this.#router.navigate([`./${nextStep}`], { relativeTo: this.#route });
    }
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

    const activeComponent = this.activatedComponent();
    const isSubmitting =
      isLastStep && activeComponent?.isSubmitting
        ? activeComponent.isSubmitting()
        : false;

    this.nextButtonText.set(
      isSubmitting
        ? 'Création en cours...'
        : isLastStep
          ? "Je m'inscris"
          : 'Continuer',
    );
  }
}
