import { Injectable } from '@angular/core';
import { createInvalidationSignal } from '@core/cache';

@Injectable({ providedIn: 'root' })
export class BudgetInvalidationService {
  readonly #signal = createInvalidationSignal();
  readonly version = this.#signal.version;

  invalidate(): void {
    this.#signal.invalidate();
  }
}
