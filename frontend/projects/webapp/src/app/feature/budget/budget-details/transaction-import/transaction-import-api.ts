import { inject, Service } from '@angular/core';
import { ApiClient } from '@core/api/api-client';
import {
  type TransactionImportDecision,
  type TransactionImportPreview,
  type TransactionImportResponse,
  transactionImportConfirmRequestSchema,
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

  /**
   * All or nothing: one Réel per `new` operation, or nothing written. Only the
   * operations in `decisions` are attached (and pointés); the others stay free.
   */
  import$(
    budgetId: string,
    file: File,
    decisions: readonly TransactionImportDecision[],
  ): Observable<TransactionImportResponse> {
    return defer(() =>
      this.#api.postFormData$(
        IMPORT_PATH,
        buildConfirmBody(budgetId, file, decisions),
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

/** Multipart fields are text: the decisions travel as one JSON array. */
function buildConfirmBody(
  budgetId: string,
  file: File,
  decisions: readonly TransactionImportDecision[],
): FormData {
  const request = transactionImportConfirmRequestSchema.parse({
    budgetId,
    decisions,
  });
  const body = new FormData();
  body.append('budgetId', request.budgetId);
  body.append('decisions', JSON.stringify(request.decisions));
  body.append('file', file, file.name);
  return body;
}
