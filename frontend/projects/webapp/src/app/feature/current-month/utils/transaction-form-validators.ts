import { Validators } from '@angular/forms';

/**
 * Shared validators for transaction forms to ensure consistency across the application.
 * Following KISS principle - direct, simple validation rules without abstraction.
 */
export const TransactionValidators = {
  name: [
    Validators.required,
    Validators.minLength(2),
    Validators.maxLength(100),
  ],
  amount: [
    Validators.required,
    Validators.min(0.01),
    Validators.max(999999.99),
  ],
  kind: Validators.required,
  category: [Validators.maxLength(50)],
} as const;
