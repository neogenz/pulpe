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
  readonly prepare: () => SubmitWithConversionArgs<TResult>;
  readonly onSuccess: (
    value: TResult,
    outcome: Extract<SubmitWithConversionOutcome<TResult>, { status: 'ok' }>,
  ) => void;
}

// Re-entry guard runs BEFORE submit() so a second click arriving before the disabled button re-renders is dropped.
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
