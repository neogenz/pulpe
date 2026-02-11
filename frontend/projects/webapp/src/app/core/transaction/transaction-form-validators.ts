import { Validators } from '@angular/forms';

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
