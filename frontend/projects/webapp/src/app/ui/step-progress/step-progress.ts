import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ProgressStep {
  readonly labelKey: string;
  /** Shown under the `sm` breakpoint when the full label would wrap. */
  readonly shortLabelKey?: string;
}

@Component({
  selector: 'pulpe-step-progress',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    @media (prefers-reduced-motion: no-preference) {
      .journey-connector-complete {
        animation: journey-progress-in 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .journey-current-marker {
        animation: journey-current-settle 420ms 100ms
          cubic-bezier(0.16, 1, 0.3, 1) both;
      }
    }

    @keyframes journey-progress-in {
      from {
        transform: scaleX(0);
      }
      to {
        transform: scaleX(1);
      }
    }

    @keyframes journey-current-settle {
      from {
        transform: scale(0.82);
      }
      to {
        transform: scale(1);
      }
    }
  `,
  template: `
    <ol
      class="relative grid grid-cols-3"
      role="list"
      [attr.data-testid]="testId()"
      [attr.aria-label]="ariaLabel()"
    >
      @for (step of steps(); track step.labelKey; let index = $index) {
        @let number = index + 1;
        @let state = stepState(number);
        <li
          class="relative flex min-w-0 flex-col items-center gap-2 px-1 text-center"
          [attr.aria-current]="state === 'current' ? 'step' : null"
          [attr.data-state]="state"
        >
          @if (number > 1) {
            <span
              class="absolute top-[15px] right-1/2 h-0.5 w-full -translate-y-1/2 origin-right bg-outline-variant"
              [class.journey-connector-complete]="currentStep() >= number"
              [class.bg-primary]="currentStep() >= number"
              aria-hidden="true"
            ></span>
          }
          <span
            class="relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-label-medium font-semibold tabular-nums"
            [class.journey-current-marker]="state === 'current'"
            [class.border-primary]="state !== 'upcoming'"
            [class.bg-primary]="state === 'current'"
            [class.text-on-primary]="state === 'current'"
            [class.bg-primary-container]="state === 'completed'"
            [class.text-on-primary-container]="state === 'completed'"
            [class.border-surface-container-high]="state === 'upcoming'"
            [class.bg-surface-container-high]="state === 'upcoming'"
            [class.text-on-surface-variant]="state === 'upcoming'"
            aria-hidden="true"
          >
            @if (state === 'completed') {
              <mat-icon class="size-4! text-base! leading-4!">check</mat-icon>
            } @else {
              {{ number }}
            }
          </span>

          <span
            class="text-label-small leading-tight sm:text-label-medium"
            [class.font-semibold]="state === 'current'"
            [class.font-medium]="state !== 'current'"
            [class.text-primary]="state !== 'upcoming'"
            [class.text-on-surface-variant]="state === 'upcoming'"
          >
            @if (step.shortLabelKey; as shortLabelKey) {
              <span class="sm:hidden">{{ shortLabelKey | transloco }}</span>
              <span class="hidden sm:inline">{{
                step.labelKey | transloco
              }}</span>
            } @else {
              {{ step.labelKey | transloco }}
            }
          </span>
        </li>
      }
    </ol>
  `,
})
export class StepProgress {
  // ponytail: three columns, the only journey length in use; widen the grid if a flow needs more.
  readonly steps =
    input.required<readonly [ProgressStep, ProgressStep, ProgressStep]>();
  /** 1-based. */
  readonly currentStep = input.required<number>();
  readonly ariaLabel = input.required<string>();
  readonly testId = input<string>();

  protected stepState(step: number): 'completed' | 'current' | 'upcoming' {
    const current = this.currentStep();
    return step < current
      ? 'completed'
      : step === current
        ? 'current'
        : 'upcoming';
  }
}
