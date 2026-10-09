import { inject, Service } from '@angular/core';
import { ApiClient } from '@core/api/api-client';
import {
  type TransactionImportPreview,
  type TransactionImportResponse,
  transactionImportPreviewResponseSchema,
  transactionImportRequestSchema,
  transactionImportResponseSchema,
} from 'pulpe-shared';
import { defer, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const PREVIEW_PATH = '/transaction-imports/preview';
const IMPORT_PATH = '/transaction-imports';

/**
 * PUL-25 — the bank statement travels as the raw file both times: the server
 * re-parses it on confirmation, so what gets written is what it recognised.
 */
@Service({ autoProvided: false })
export class TransactionImportApi {
  readonly #api = inject(ApiClient);

  /** Parsing problems come back inside `errors`, never as an HTTP failure. */
  preview$(budgetId: string, file: File): Observable<TransactionImportPreview> {
    return defer(() =>
      this.#api.postFormData$(
        PREVIEW_PATH,
        buildImportBody(budgetId, file),
        transactionImportPreviewResponseSchema,
      ),
    ).pipe(map((response) => response.data));
  }

  /** All or nothing: one Réel per `new` operation, or nothing written. */
  import$(budgetId: string, file: File): Observable<TransactionImportResponse> {
    return defer(() =>
      this.#api.postFormData$(
        IMPORT_PATH,
        buildImportBody(budgetId, file),
        transactionImportResponseSchema,
      ),
    );
  }
}

function buildImportBody(budgetId: string, file: File): FormData {
  const request = transactionImportRequestSchema.parse({ budgetId });
  const body = new FormData();
  body.append('budgetId', request.budgetId);
  body.append('file', file, file.name);
  return body;
}
