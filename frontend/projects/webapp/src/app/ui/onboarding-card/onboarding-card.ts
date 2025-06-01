import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OnboardingCardData {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
}

@Component({
  selector: 'pulpe-onboarding-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div
      class="min-h-screen md:h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-3xl h-fit md:h-[600px] bg-white rounded-2xl p-8 flex flex-col"
      >
        <!-- Progress indicators -->
        @if (showProgress()) {
          <div class="flex gap-2 mb-8">
            @for (step of progressSteps; track step; let i = $index) {
              <div
                class="h-2 flex-1 rounded-full transition-colors duration-300"
                [class]="
                  i < cardData().currentStep ? 'bg-green-600' : 'bg-gray-200'
                "
              ></div>
            }
          </div>
        }

        <!-- Content -->
        <div class="space-y-6 flex-1">
          <div class="text-center space-y-2">
            <h1 class="text-2xl font-bold text-gray-900">
              {{ cardData().title }}
            </h1>
            @if (cardData().subtitle) {
              <p class="text-gray-600 leading-relaxed">
                {{ cardData().subtitle }}
              </p>
            }
          </div>

          <ng-content></ng-content>
        </div>

        <!-- Navigation buttons -->
        <div class="flex space-x-4 mt-8">
          @if (showPreviousButton()) {
            <button
              (click)="onPrevious()"
              class="flex-1 py-3 px-6 border border-gray-300 rounded-full text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Précédent
            </button>
          }
          <button
            (click)="onNext()"
            [disabled]="!canContinue()"
            class="flex-1 py-3 px-6 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {{ nextButtonText() }}
          </button>
        </div>

        <!-- Footer content -->
        <ng-content select="[slot=footer]"></ng-content>
      </div>
    </div>
  `,
})
export class OnboardingCardComponent {
  cardData = input.required<OnboardingCardData>();
  showPreviousButton = input<boolean>(true);
  showProgress = input<boolean>(true);
  canContinue = input<boolean>(true);
  nextButtonText = input<string>('Continuer');

  previous = output<void>();
  next = output<void>();

  protected get progressSteps(): number[] {
    return Array(this.cardData().totalSteps).fill(0);
  }

  protected onPrevious(): void {
    this.previous.emit();
  }

  protected onNext(): void {
    this.next.emit();
  }
}
