import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ANALYTICS_EVENTS } from 'pulpe-shared';

import { AnalyticsService } from '@core/analytics';
import { FeedbackPrompt } from '@core/feedback/feedback-prompt';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';

export interface FeedbackDialogData {
  promptNumber: number;
}

@Component({
  selector: 'pulpe-feedback-dialog',
  host: { 'data-testid': 'feedback-dialog' },
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
    ErrorAlert,
    LoadingButton,
  ],
  template: `
    <form (submit)="submit($event)">
      <h2 mat-dialog-title>{{ 'feedback.title' | transloco }}</h2>

      <mat-dialog-content>
        <p
          class="flex items-center gap-2 text-body-medium text-on-surface-variant"
        >
          <mat-icon aria-hidden="true" class="mat-icon-sm">lock</mat-icon>
          {{ 'feedback.privacy' | transloco }}
        </p>

        <fieldset class="mt-4">
          <legend class="text-title-medium text-on-surface">
            {{ 'feedback.question' | transloco }}
          </legend>
          <div class="mt-2 flex justify-center gap-1">
            @for (option of ratingOptions; track option.value) {
              <label
                class="flex size-12 cursor-pointer items-center justify-center rounded-full text-on-surface-variant has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <input
                  type="radio"
                  name="feedback-rating"
                  class="sr-only"
                  [value]="option.value"
                  [checked]="rating() === option.value"
                  [attr.aria-label]="option.labelKey | transloco"
                  [attr.data-testid]="'rating-' + option.value + '-input'"
                  (change)="rating.set(option.value)"
                />
                <mat-icon
                  aria-hidden="true"
                  [class.icon-filled]="option.value <= (rating() ?? 0)"
                  [class.text-primary]="option.value <= (rating() ?? 0)"
                  >star</mat-icon
                >
              </label>
            }
          </div>
        </fieldset>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="mt-4 w-full"
        >
          <mat-label>{{ 'feedback.commentLabel' | transloco }}</mat-label>
          <textarea
            matInput
            rows="3"
            maxlength="1000"
            [placeholder]="'feedback.commentPlaceholder' | transloco"
            [value]="comment()"
            (input)="comment.set($any($event.target).value)"
            data-testid="comment-input"
          ></textarea>
        </mat-form-field>

        <pulpe-error-alert [message]="errorMessage()" />
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="gap-2">
        <button
          matButton
          type="button"
          (click)="close()"
          data-testid="later-button"
        >
          {{ 'feedback.later' | transloco }}
        </button>
        <pulpe-loading-button
          [loading]="isSubmitting()"
          [disabled]="rating() === null"
          [fullWidth]="false"
          [loadingText]="'feedback.submitting' | transloco"
          testId="submit-button"
        >
          {{ 'feedback.submit' | transloco }}
        </pulpe-loading-button>
      </mat-dialog-actions>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackDialog {
  readonly #dialogRef = inject(MatDialogRef<FeedbackDialog>);
  readonly #feedbackPrompt = inject(FeedbackPrompt);
  readonly #analytics = inject(AnalyticsService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #properties = {
    source: 'automatic',
    prompt_number: inject<FeedbackDialogData>(MAT_DIALOG_DATA).promptNumber,
  };
  #isSubmitted = false;

  // Literal keys: the catalog parity check only sees keys written in full.
  protected readonly ratingOptions = [
    { value: 1, labelKey: 'feedback.rating1' },
    { value: 2, labelKey: 'feedback.rating2' },
    { value: 3, labelKey: 'feedback.rating3' },
    { value: 4, labelKey: 'feedback.rating4' },
    { value: 5, labelKey: 'feedback.rating5' },
  ] as const;
  protected readonly rating = signal<number | null>(null);
  protected readonly comment = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.#analytics.captureEvent(
      ANALYTICS_EVENTS.FEEDBACK_VIEWED,
      this.#properties,
    );
    // Every way out that is not a successful send (Plus tard, Escape,
    // backdrop) counts as one cancellation.
    this.#dialogRef.afterClosed().subscribe(() => {
      if (this.#isSubmitted) return;
      this.#analytics.captureEvent(
        ANALYTICS_EVENTS.FEEDBACK_CANCELLED,
        this.#properties,
      );
    });
  }

  protected close(): void {
    this.#dialogRef.close();
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const rating = this.rating();
    if (rating === null || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.#feedbackPrompt.submit(rating, this.comment());
    } catch {
      this.errorMessage.set(this.#transloco.translate('feedback.error'));
      this.isSubmitting.set(false);
      return;
    }

    this.#isSubmitted = true;
    this.#analytics.captureEvent(ANALYTICS_EVENTS.FEEDBACK_SUBMITTED, {
      ...this.#properties,
      rating,
      has_comment: this.comment().trim().length > 0,
      has_details: false,
    });
    this.#dialogRef.close();
    this.#snackBar.open(this.#transloco.translate('feedback.thanks'), 'OK', {
      duration: 4000,
    });
  }
}
