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
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'pulpe-onboarding-layout',
  imports: [
    MatButtonModule,
    RouterOutlet,
    MatProgressSpinnerModule,
    MatCardModule,
  ],
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
          <div class="mt-8">
            <mat-card
              appearance="outlined"
              class="text-on-error-container pb-4"
            >
              <mat-card-header>
                <mat-card-title>Erreur</mat-card-title>
                <mat-card-subtitle>{{ error }}</mat-card-subtitle>
              </mat-card-header>
            </mat-card>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      @use '@angular/material' as mat;

      // Customize the entire app. Change :root to your selector if you want to scope the styles.
      :host {
        @include mat.card-overrides(
          (
            outlined-container-color: var(--mat-sys-error-container),
            outlined-outline-color: var(--mat-sys-error),
            subtitle-text-color: var(--mat-sys-on-error-container),
          )
        );
      }
    `,
  ],
})
export class OnboardingLayout {
  protected readonly store = inject(OnboardingStore);

  protected readonly progressSteps = computed(() => {
    return Array(this.store.totalSteps - 1).fill(0); // -1 pour exclure welcome
  });
}
