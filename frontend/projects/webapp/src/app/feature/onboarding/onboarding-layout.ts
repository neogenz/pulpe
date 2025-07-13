import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterOutlet } from '@angular/router';
import { OnboardingStore } from './onboarding-store';
import { ONBOARDING_TOTAL_STEPS } from './onboarding-constants';

@Component({
  selector: 'pulpe-onboarding-layout',
  imports: [MatButtonModule, RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen md:h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-3xl min-h-[600px] md:h-[800px] bg-surface rounded-2xl md:p-16 p-8 flex flex-col"
      >
        <!-- Progress indicators -->
        @if (!isFirstStep()) {
          <div class="flex gap-2 mb-16">
            @for (step of progressSteps(); track $index; let i = $index) {
              <div
                class="h-2 flex-1 rounded-full transition-colors duration-300"
                [class]="
                  i < (onboardingStore.layoutData()?.currentStep ?? 0)
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
              {{ onboardingStore.layoutData()?.title }}
            </h1>
            @if (onboardingStore.layoutData()?.subtitle) {
              <p
                class="text-body-large text-on-surface-variant leading-relaxed"
              >
                {{ onboardingStore.layoutData()?.subtitle }}
              </p>
            }
          </div>

          <router-outlet></router-outlet>
        </div>

        @if (isFirstStep()) {
          <!-- Lien de connexion -->
          <div slot="footer" class="text-center mt-6">
            <p class="text-body-medium text-on-surface-variant">
              Tu as déjà un compte ?
              <button
                mat-button
                color="primary"
                class="ml-1"
                routerLink="/login"
              >
                Se connecter
              </button>
            </p>
          </div>
        }
      </div>
    </div>
  `,
})
export class OnboardingLayout {
  protected readonly onboardingStore = inject(OnboardingStore);

  protected progressSteps = computed(() => {
    const totalSteps = ONBOARDING_TOTAL_STEPS;
    return Array(totalSteps).fill(0);
  });

  protected isFirstStep = computed(() => {
    return this.onboardingStore.layoutData()?.currentStep === 0;
  });
}
