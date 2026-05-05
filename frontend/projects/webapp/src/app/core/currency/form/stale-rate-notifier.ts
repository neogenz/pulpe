import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';

import type { SubmitWithConversionOutcome } from './submit-with-conversion';

@Injectable({ providedIn: 'root' })
export class StaleRateNotifier {
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

  notify(
    outcome: Extract<SubmitWithConversionOutcome<unknown>, { status: 'ok' }>,
  ): void {
    if (!outcome.rateInfo?.fromFallback) return;
    const date = outcome.rateInfo.cachedDate ?? '';
    this.#snackBar.open(
      this.#transloco.translate('common.staleFxRate', { date }),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }
}
