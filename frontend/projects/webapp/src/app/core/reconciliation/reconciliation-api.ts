import { inject, Service } from '@angular/core';
import {
  reconciliationContextResponseSchema,
  reconciliationStateResponseSchema,
  updateReconciliationStateSchema,
  type ReconciliationContextResponse,
  type ReconciliationStateResponse,
  type UpdateReconciliationState,
} from 'pulpe-shared';
import type { Observable } from 'rxjs';

import { ApiClient } from '@core/api/api-client';

/** « Comparer avec mes comptes »: what the server adds to the compared figure, and the person's state. */
@Service()
export class ReconciliationApi {
  readonly #api = inject(ApiClient);

  getContext$(budgetId: string): Observable<ReconciliationContextResponse> {
    return this.#api.get$(
      `/reconciliation/${budgetId}`,
      reconciliationContextResponseSchema,
    );
  }

  updateState$(
    body: UpdateReconciliationState,
  ): Observable<ReconciliationStateResponse> {
    return this.#api.put$(
      '/reconciliation/state',
      body,
      reconciliationStateResponseSchema,
      updateReconciliationStateSchema,
    );
  }
}
