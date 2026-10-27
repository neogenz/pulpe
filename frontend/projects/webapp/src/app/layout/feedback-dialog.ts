import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import {
  FeedbackPrompt,
  type FeedbackDetails,
} from '@core/feedback/feedback-prompt';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';

export interface FeedbackDialogData {
  promptNumber: number;
}

@Component({
  selector: 'pulpe-feedback-dialog',
  host: {
    'data-testid': 'feedback-dialog',
    class: 'flex h-full min-h-0 flex-col',
  },
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
    <form
      (submit)="submit($event)"
      class="flex min-h-0 flex-1 flex-col"
      style="padding-top: env(safe-area-inset-top)"
    >
      <h2 mat-dialog-title>{{ 'feedback.title' | transloco }}</h2>

      <mat-dialog-content class="min-h-0 flex-1" style="max-height: none">
        <p
          class="flex items-center gap-2 text-body-medium text-on-surface-variant"
        >
          <mat-icon aria-hidden="true" class="mat-icon-sm">lock</mat-icon>
          {{ 'feedback.privacy' | transloco }}
        </p>

        <fieldset
          class="mt-4 rounded-corner-large bg-surface-container p-4"
          [disabled]="isSubmitting()"
        >
          <legend
            class="float-left w-full text-center text-title-medium text-on-surface"
          >
            {{ 'feedback.question' | transloco }}
          </legend>
          <div class="clear-both pt-2 flex justify-center gap-1">
            @for (option of ratingOptions; track option.value) {
              <label
                class="flex size-12 cursor-pointer items-center justify-center rounded-full text-on-surface-variant has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                [class.text-primary]="option.value <= (rating() ?? 0)"
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
                  >star</mat-icon
                >
              </label>
            }
          </div>
          <!-- Visual echo of the checked radio, which already carries the name. -->
          <p
            aria-hidden="true"
            class="mt-1 min-h-5 text-center text-body-medium text-on-surface-variant"
            data-testid="rating-label"
          >
            @if (selectedLabelKey(); as labelKey) {
              {{ labelKey | transloco }}
            }
          </p>
        </fieldset>

        <div class="mt-6 flex items-baseline justify-between gap-2">
          <h3 class="text-title-medium">
            {{ 'feedback.detailsTitle' | transloco }}
          </h3>
          <span class="text-body-small text-on-surface-variant">{{
            'feedback.optional' | transloco
          }}</span>
        </div>
        <p class="mt-1 text-body-small text-on-surface-variant">
          {{ 'feedback.detailsHint' | transloco }}
        </p>
        @for (area of areas; track area.key) {
          <fieldset
            class="border-b border-outline-variant py-3"
            [disabled]="isSubmitting()"
          >
            <legend class="sr-only">{{ area.labelKey | transloco }}</legend>
            <div
              class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span aria-hidden="true" class="text-body-medium">{{
                area.labelKey | transloco
              }}</span>
              <div class="shrink-0" #stars>
                <div class="flex justify-between sm:justify-end">
                  @for (option of ratingOptions; track option.value) {
                    <label
                      class="flex size-12 cursor-pointer items-center justify-center rounded-full text-on-surface-variant has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                      [class.text-primary]="
                        option.value <= (details()[area.key] ?? 0)
                      "
                    >
                      <input
                        type="radio"
                        class="sr-only"
                        [name]="area.key"
                        [value]="option.value"
                        [checked]="details()[area.key] === option.value"
                        [attr.aria-label]="option.labelKey | transloco"
                        [attr.data-testid]="
                          area.key + '-' + option.value + '-input'
                        "
                        (change)="setDetail(area.key, option.value)"
                      />
                      <mat-icon
                        aria-hidden="true"
                        [class.icon-filled]="
                          option.value <= (details()[area.key] ?? 0)
                        "
                        >star</mat-icon
                      >
                    </label>
                  }
                </div>
                @if (details()[area.key]; as value) {
                  <div class="flex items-center justify-between gap-2">
                    <span
                      aria-hidden="true"
                      class="text-body-small text-on-surface-variant"
                      >{{ ratingOptions[value - 1].labelKey | transloco }}</span
                    >
                    <button
                      matButton
                      type="button"
                      (click)="clearDetail(area.key, stars)"
                      [attr.aria-label]="
                        'feedback.clearRating'
                          | transloco: { area: (area.labelKey | transloco) }
                      "
                      [attr.data-testid]="area.key + '-clear'"
                    >
                      {{ 'common.clear' | transloco }}
                    </button>
                  </div>
                }
              </div>
            </div>
          </fieldset>
        }

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="mt-4 w-full"
        >
          <mat-label>{{ 'feedback.commentLabel' | transloco }}</mat-label>
          <textarea
            matInput
            [disabled]="isSubmitting()"
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

      <mat-dialog-actions
        align="end"
        class="shrink-0 gap-2 border-t border-outline-variant"
        style="padding-bottom: max(1rem, env(safe-area-inset-bottom))"
      >
        <p class="w-full text-start text-body-small text-on-surface-variant">
          {{ 'feedback.submitHint' | transloco }}
        </p>
        <button
          matButton
          type="button"
          [disabled]="isSubmitting()"
          (click)="close()"
          data-testid="later-button"
        >
          {{ 'feedback.later' | transloco }}
        </button>
        <pulpe-loading-button
          [loading]="isSubmitting()"
          [disabled]="rating() === null"
          class="flex-1 sm:flex-none"
          [fullWidth]="true"
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
  protected readonly areas = [
    { key: 'onboarding', labelKey: 'feedback.onboarding' },
    { key: 'budgetClarity', labelKey: 'feedback.budgetClarity' },
    { key: 'currentMonth', labelKey: 'feedback.currentMonth' },
    { key: 'futurePlanning', labelKey: 'feedback.futurePlanning' },
    { key: 'homeClarity', labelKey: 'feedback.homeClarity' },
  ] as const;
  protected readonly details = signal<FeedbackDetails>({});
  protected readonly rating = signal<number | null>(null);
  protected readonly selectedLabelKey = computed(
    () =>
      this.ratingOptions.find((option) => option.value === this.rating())
        ?.labelKey ?? null,
  );
  protected readonly comment = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.#analytics.captureEvent(
      ANALYTICS_EVENTS.FEEDBACK_VIEWED,
      this.#properties,
    );
    // Every way out that is not a successful send (Plus tard, Escape,
    // backdrop) counts as one cancellation. No takeUntilDestroyed: the CDK
    // destroys this component before afterClosed emits, which would swallow
    // the event. afterClosed completes on its own.
    this.#dialogRef.afterClosed().subscribe(() => {
      if (this.#isSubmitted) return;
      this.#analytics.captureEvent(
        ANALYTICS_EVENTS.FEEDBACK_CANCELLED,
        this.#properties,
      );
    });
  }

  protected setDetail(
    area: keyof FeedbackDetails,
    value: number | undefined,
  ): void {
    this.details.update((details) => ({ ...details, [area]: value }));
  }

  protected clearDetail(area: keyof FeedbackDetails, stars: HTMLElement): void {
    this.setDetail(area, undefined);
    stars.querySelector<HTMLInputElement>('input')?.focus();
  }

  protected close(): void {
    this.#dialogRef.close();
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const rating = this.rating();
    if (rating === null || this.isSubmitting()) return;

    // Closing mid-send would count as a cancellation, then the send would
    // still succeed and count as a submission.
    this.#dialogRef.disableClose = true;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.#feedbackPrompt.submit(rating, this.comment(), this.details());
    } catch {
      this.errorMessage.set(this.#transloco.translate('feedback.error'));
      this.isSubmitting.set(false);
      this.#dialogRef.disableClose = false;
      return;
    }

    this.#isSubmitted = true;
    this.#analytics.captureEvent(ANALYTICS_EVENTS.FEEDBACK_SUBMITTED, {
      ...this.#properties,
      rating,
      has_comment: this.comment().trim().length > 0,
      has_details: Object.values(this.details()).some(
        (value) => value !== undefined,
      ),
    });
    this.#dialogRef.close();
    this.#snackBar.open(this.#transloco.translate('feedback.thanks'), 'OK', {
      duration: 4000,
    });
  }
}
