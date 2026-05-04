import { type WritableSignal } from '@angular/core';
import { type FieldTree, submit } from '@angular/forms/signals';

import {
  submitWithConversion,
  type SubmitWithConversionArgs,
  type SubmitWithConversionOutcome,
} from './submit-with-conversion';

export interface RunFormSubmitArgs<TFormModel, TResult> {
  readonly form: FieldTree<TFormModel>;
  readonly isSubmitting: WritableSignal<boolean>;
  readonly conversionError: WritableSignal<boolean>;
  /**
   * Called after `submit()` validation passes. Returns the args for
   * `submitWithConversion`, allowing the caller to snapshot the form model
   * just before conversion so amount + build payload stay consistent.
   */
  readonly prepare: () => SubmitWithConversionArgs<TResult>;
  readonly onSuccess: (
    value: TResult,
    outcome: Extract<SubmitWithConversionOutcome<TResult>, { status: 'ok' }>,
  ) => void;
}

/**
 * Drives a signal-forms submit that depends on currency conversion.
 *
 * Owns the full ritual: re-entry guard (prevents double-submit races),
 * `isSubmitting` toggle, `conversionError` reset, signal-forms `submit()`
 * invocation, and outcome dispatch. Callers only describe the work via
 * `prepare` + `onSuccess`.
 *
 * The re-entry guard runs BEFORE `submit()`, so a second click that arrives
 * before Angular re-renders the disabled button is dropped silently.
 */
export async function runFormSubmit<TFormModel, TResult>(
  args: RunFormSubmitArgs<TFormModel, TResult>,
): Promise<void> {
  if (args.isSubmitting()) return;
  args.isSubmitting.set(true);
  args.conversionError.set(false);
  try {
    await submit(args.form, async () => {
      const outcome = await submitWithConversion(args.prepare());
      if (outcome.status === 'ok') {
        args.onSuccess(outcome.value, outcome);
        return;
      }
      if (
        outcome.status === 'failed-conversion' ||
        outcome.status === 'failed-build'
      ) {
        args.conversionError.set(true);
      }
    });
  } finally {
    args.isSubmitting.set(false);
  }
}
