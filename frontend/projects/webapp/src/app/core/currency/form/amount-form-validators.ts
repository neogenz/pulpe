import { min, required, type SchemaPathTree } from '@angular/forms/signals';
import type { AmountFormSlice } from './amount-form.types';

const AMOUNT_MIN = 0.01;

/**
 * Apply standard amount validators to a signal-forms schema path.
 * Wire-side rule: backend rejects `amount <= 0` (Zod `.positive()`).
 *
 * Error messages are transloco keys — caller pipes them through `| transloco`.
 */
export function applyAmountValidators(
  path: SchemaPathTree<AmountFormSlice>,
): void {
  required(path.amount, { message: 'form.amountRequired' });
  min(path.amount, AMOUNT_MIN, { message: 'form.amountTooLow' });
}
