import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

export interface OnboardingLayoutData {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
}

@Component({
  selector: 'pulpe-onboarding-layout',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div
      class="min-h-screen md:h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-3xl h-fit md:h-[800px] bg-surface rounded-2xl md:p-16 p-8 flex flex-col"
      >
        <!-- Progress indicators -->
        @if (showProgress()) {
          <div class="flex gap-2 mb-16">
            @for (step of progressSteps; track step; let i = $index) {
              <div
                class="h-2 flex-1 rounded-full transition-colors duration-300"
                [class]="
                  i < onboardingLayoutData().currentStep
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
              {{ onboardingLayoutData().title }}
            </h1>
            @if (onboardingLayoutData().subtitle) {
              <p
                class="text-body-large text-on-surface-variant leading-relaxed"
              >
                {{ onboardingLayoutData().subtitle }}
              </p>
            }
          </div>

          <ng-content></ng-content>
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
              mat-flat-button
              color="primary"
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
  onboardingLayoutData = input.required<OnboardingLayoutData>();
  showPreviousButton = input<boolean>(true);
  showProgress = input<boolean>(true);
  canContinue = input<boolean>(true);
  nextButtonText = input<string>('Continuer');

  previous = output<void>();
  next = output<void>();

  protected get progressSteps(): number[] {
    return Array(this.onboardingLayoutData().totalSteps).fill(0);
  }

  protected onPrevious(): void {
    this.previous.emit();
  }

  protected onNext(): void {
    this.next.emit();
  }
}
