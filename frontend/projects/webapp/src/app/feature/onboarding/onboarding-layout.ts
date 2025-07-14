import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterOutlet } from '@angular/router';
import { OnboardingStore } from './onboarding-store';
import { ErrorCard } from '../../ui';

@Component({
  selector: 'pulpe-onboarding-layout',
  imports: [MatButtonModule, RouterOutlet, MatProgressSpinnerModule, ErrorCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="main"
      class="min-h-screen md:h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-3xl min-h-[600px] md:h-[800px] bg-surface rounded-2xl md:p-16 p-8 flex flex-col"
      >
        <!-- Progress indicators -->
        @if (!store.isFirstStep()) {
          <div class="flex gap-2 mb-20">
            @for (step of progressSteps(); track $index; let i = $index) {
              <div
                class="h-2 flex-1 rounded-full transition-colors duration-300"
                [class]="
                  i < store.currentStep()
                    ? 'bg-primary'
                    : 'bg-secondary-container'
                "
              ></div>
            }
          </div>
        }

        <!-- Content avec router-outlet -->
        <div class="flex-1 flex flex-col">
          <div class="flex-1">
            <router-outlet></router-outlet>
          </div>
        </div>

        <!-- Affichage des erreurs globales -->
        @if (store.error(); as error) {
          <pulpe-error-card [error]="error" />
        }
      </div>
    </div>
  `,
  styles: ``,
})
export class OnboardingLayout {
  protected readonly store = inject(OnboardingStore);

  protected readonly progressSteps = computed(() => {
    return Array(this.store.totalSteps - 1).fill(0); // -1 pour exclure welcome
  });
}
