import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

export interface ProcessingDialogData {
  readonly title: string;
  readonly detail?: string;
  readonly hint?: string;
}

/**
 * Generic non-dismissable processing dialog for a slow, blocking operation.
 *
 * Pure presentation: every string is passed in already localized via
 * {@link MAT_DIALOG_DATA}, so this stays in the `ui/` layer (no transloco, no
 * currency, no domain knowledge). The progress bar is indeterminate on purpose —
 * the operations it covers (e.g. a multi-month spread fan-out) emit no progress,
 * so a determinate bar would be a lie. Open it with `disableClose: true`.
 */
@Component({
  selector: 'pulpe-processing-dialog',
  imports: [MatDialogModule, MatProgressBarModule],
  template: `
    <div
      class="flex flex-col items-center p-8 text-center min-w-64"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p class="text-on-surface text-title-medium">{{ data.title }}</p>
      @if (data.detail) {
        <p
          class="mt-1 text-on-surface-variant text-body-medium tabular-nums ph-no-capture"
        >
          {{ data.detail }}
        </p>
      }
      <mat-progress-bar
        class="mt-6 w-full"
        mode="indeterminate"
        [attr.aria-label]="data.title"
      />
      @if (data.hint) {
        <p class="mt-4 text-on-surface-variant text-body-small">
          {{ data.hint }}
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessingDialog {
  protected readonly data = inject<ProcessingDialogData>(MAT_DIALOG_DATA);
}
