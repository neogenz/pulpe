import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-loading-button',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [matButton]="variant()"
      [color]="color()"
      [type]="type()"
      [class]="buttonClass()"
      [attr.data-testid]="testId()"
      [disabled]="loading() || disabled()"
    >
      @if (loading()) {
        <div class="flex items-center justify-center">
          <mat-progress-spinner
            mode="indeterminate"
            [diameter]="20"
            [attr.aria-label]="loadingText()"
            role="progressbar"
            class="pulpe-loading-indicator pulpe-loading-small mr-2 flex-shrink-0"
          />
          <span aria-live="polite">{{ loadingText() }}</span>
        </div>
      } @else {
        <div class="flex items-center justify-center">
          @if (icon()) {
            <mat-icon>{{ icon() }}</mat-icon>
          }
          <ng-content />
        </div>
      }
    </button>
  `,
})
export class LoadingButton {
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly variant = input<'filled' | 'outlined' | 'tonal' | ''>('filled');
  readonly color = input<'primary' | 'accent' | 'warn'>('primary');
  readonly type = input<'button' | 'submit'>('submit');
  readonly loadingText = input('en cours...');
  readonly icon = input<string>();
  readonly testId = input<string>();
  readonly fullWidth = input(true);

  protected buttonClass(): string {
    const classes = ['h-12'];
    if (this.fullWidth()) {
      classes.push('w-full');
    }
    return classes.join(' ');
  }
}
