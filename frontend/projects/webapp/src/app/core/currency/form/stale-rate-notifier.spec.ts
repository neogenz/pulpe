import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaleRateNotifier } from './stale-rate-notifier';
import type { SubmitWithConversionOutcome } from './submit-with-conversion';

type OkOutcome = Extract<
  SubmitWithConversionOutcome<unknown>,
  { status: 'ok' }
>;

describe('StaleRateNotifier', () => {
  let notifier: StaleRateNotifier;
  let snackBarOpen: ReturnType<typeof vi.fn>;
  let translate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    snackBarOpen = vi.fn();
    translate = vi.fn((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
        { provide: TranslocoService, useValue: { translate } },
      ],
    });

    notifier = TestBed.inject(StaleRateNotifier);
  });

  it('should not open a snackbar when rateInfo is absent', () => {
    const outcome: OkOutcome = { status: 'ok', value: { id: 1 } };

    notifier.notify(outcome);

    expect(snackBarOpen).not.toHaveBeenCalled();
  });

  it('should not open a snackbar when fromFallback is false', () => {
    const outcome: OkOutcome = {
      status: 'ok',
      value: null,
      rateInfo: { fromFallback: false, cachedDate: '2026-04-13' },
    };

    notifier.notify(outcome);

    expect(snackBarOpen).not.toHaveBeenCalled();
  });

  it('should open a snackbar with the cached date when fromFallback is true', () => {
    const outcome: OkOutcome = {
      status: 'ok',
      value: null,
      rateInfo: { fromFallback: true, cachedDate: '2026-04-13' },
    };

    notifier.notify(outcome);

    expect(translate).toHaveBeenCalledWith('common.staleFxRate', {
      date: '2026-04-13',
    });
    expect(snackBarOpen).toHaveBeenCalledWith(
      'common.staleFxRate',
      'common.close',
      { duration: 5000 },
    );
  });

  it('should fallback to an empty date when cachedDate is missing', () => {
    const outcome: OkOutcome = {
      status: 'ok',
      value: null,
      rateInfo: { fromFallback: true },
    };

    notifier.notify(outcome);

    expect(translate).toHaveBeenCalledWith('common.staleFxRate', { date: '' });
    expect(snackBarOpen).toHaveBeenCalledOnce();
  });
});
