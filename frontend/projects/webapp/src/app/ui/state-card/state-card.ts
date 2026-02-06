import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type StateCardVariant = 'error' | 'empty' | 'loading';

@Component({
  selector: 'pulpe-state-card',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div
      class="flex flex-col items-center justify-center"
      [attr.data-testid]="testId()"
    >
      <mat-card appearance="outlined" class="w-full max-w-xl text-center p-8">
        <mat-card-content class="flex flex-col items-center gap-3">
          @if (variant() === 'loading') {
            <mat-progress-spinner mode="indeterminate" [diameter]="40" />
          } @else {
            <mat-icon
              class="text-5xl"
              [class.text-error]="variant() === 'error'"
            >
              {{ icon() }}
            </mat-icon>
          }
          <h2 class="text-title-large font-semibold">{{ title() }}</h2>
          <p class="text-body-large text-on-surface-variant">{{ message() }}</p>
        </mat-card-content>

        @if (actionLabel()) {
          <mat-card-actions align="end">
            <button
              matButton="elevated"
              (click)="action.emit()"
              [disabled]="actionDisabled()"
            >
              {{ actionLabel() }}
            </button>
          </mat-card-actions>
        }
      </mat-card>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-card {
      border-radius: var(--pulpe-surface-radius-panel);
      border: var(--pulpe-surface-border-subtle);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateCard {
  readonly variant = input<StateCardVariant>('error');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input<string | null>(null);
  readonly actionDisabled = input(false);
  readonly testId = input('state-card');
  readonly action = output<void>();

  protected readonly icon = computed(() => {
    switch (this.variant()) {
      case 'empty':
        return 'inbox';
      case 'loading':
        return 'hourglass_empty';
      default:
        return 'error_outline';
    }
  });
}
