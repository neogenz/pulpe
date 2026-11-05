import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { isApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';

/**
 * Returns a runner for the page's writes: a refused write shows in a snackbar
 * instead of failing silently, and the runner resolves with whether it went
 * through. A function rather than a `NetWorthDialogService` method, since the
 * categories dialog that uses it is opened by that service.
 */
export function injectWriteAttempt(): (
  write: () => Promise<void>,
) => Promise<boolean> {
  const snackBar = inject(MatSnackBar);
  const transloco = inject(TranslocoService);
  const errorLocalizer = inject(ApiErrorLocalizer);
  return async (write) => {
    try {
      await write();
      return true;
    } catch (error) {
      const message = isApiError(error)
        ? errorLocalizer.localizeApiError(error)
        : transloco.translate('common.error');
      snackBar.open(message, transloco.translate('common.close'), {
        duration: 5000,
        panelClass: ['bg-error-container', 'text-on-error-container'],
      });
      return false;
    }
  };
}
