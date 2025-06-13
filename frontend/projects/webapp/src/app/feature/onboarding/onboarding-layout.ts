import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterOutlet } from '@angular/router';
import { OnboardingOrchestrator } from './onboarding-orchestrator';
import { ONBOARDING_TOTAL_STEPS } from './onboarding-constants';

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
        @if (onboardingOrchestrator.layoutData()) {
          <div class="flex gap-2 mb-16">
            @for (step of progressSteps; track step; let i = $index) {
              <div
                class="h-2 flex-1 rounded-full transition-colors duration-300"
                [class]="
                  i < (onboardingOrchestrator.layoutData()?.currentStep ?? 0)
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
              {{ onboardingOrchestrator.layoutData()?.title }}
            </h1>
            @if (onboardingOrchestrator.layoutData()?.subtitle) {
              <p
                class="text-body-large text-on-surface-variant leading-relaxed"
              >
                {{ onboardingOrchestrator.layoutData()?.subtitle }}
              </p>
            }
          </div>

          <router-outlet></router-outlet>
        </div>

        <!-- Navigation buttons -->
        <div class="flex md:gap-8 gap-4 mt-8">
          @if (showPreviousButton()) {
            <div class="flex-1">
              <button
                matButton="outlined"
                (click)="onboardingOrchestrator.previousClicked$.next()"
                class="w-full"
              >
                Précédent
              </button>
            </div>
          }
          <div class="flex-1">
            <button
              matButton="filled"
              (click)="onboardingOrchestrator.nextClicked$.next()"
              [disabled]="!onboardingOrchestrator.canContinue()"
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
  protected readonly onboardingOrchestrator = inject(OnboardingOrchestrator);

  protected get progressSteps(): number[] {
    const totalSteps = ONBOARDING_TOTAL_STEPS;
    return Array(totalSteps).fill(0);
  }

  protected showPreviousButton = signal<boolean>(true); // This could also come from the orchestrator if needed

  protected nextButtonText = signal<string>('Continuer'); // This could also come from the orchestrator
}
