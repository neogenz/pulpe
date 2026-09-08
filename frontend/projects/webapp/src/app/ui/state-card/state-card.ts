import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type StateCardVariant = 'error' | 'empty' | 'loading';

@Component({
  selector: 'pulpe-state-card',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div
      class="state-content mx-auto flex max-w-lg flex-col items-center text-center"
      [class.empty]="variant() === 'empty'"
      [class.compact]="compact()"
      [attr.data-testid]="testId()"
    >
      @if (variant() === 'loading') {
        <mat-progress-spinner
          class="mb-4"
          mode="indeterminate"
          [diameter]="32"
        />
      } @else if (variant() === 'error') {
        <mat-icon class="text-error mb-4" aria-hidden="true"
          >error_outline</mat-icon
        >
      }
      @if (compact()) {
        <h3 class="text-title-medium text-on-surface">{{ title() }}</h3>
      } @else {
        <h2 class="text-title-large text-on-surface">{{ title() }}</h2>
      }
      @if (message()) {
        <p
          class="mt-2 max-w-sm text-body-medium text-on-surface-variant text-pretty"
        >
          {{ message() }}
        </p>
      }
      @if (actionLabel()) {
        <button
          matButton="outlined"
          class="mt-6"
          (click)="action.emit()"
          [disabled]="actionDisabled()"
        >
          {{ actionLabel() }}
        </button>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .state-content {
      padding: var(--pulpe-section-gap-lg);
      background: var(--mat-sys-surface-container-low);
      border-radius: var(--pulpe-surface-radius-panel);
      border: var(--pulpe-surface-border-subtle);
    }

    .state-content.empty {
      padding: calc(2 * var(--pulpe-section-gap-lg)) var(--pulpe-section-gap-md);
      background: transparent;
      border: 0;
    }

    .state-content.compact {
      padding: var(--pulpe-section-gap-lg) var(--pulpe-section-gap-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateCard {
  readonly variant = input<StateCardVariant>('error');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly compact = input(false);
  readonly actionLabel = input<string | null>(null);
  readonly actionDisabled = input(false);
  readonly testId = input('state-card');
  readonly action = output<void>();
}
