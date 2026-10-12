import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from '@core/analytics';
import { FeedbackPrompt } from '@core/feedback/feedback-prompt';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { FeedbackDialog } from './feedback-dialog';

async function setup(submit: () => Promise<void>) {
  const closed = new Subject<void>();
  const dialogRef = {
    close: vi.fn(() => closed.next()),
    afterClosed: () => closed,
  };
  const analytics = { captureEvent: vi.fn() };
  TestBed.configureTestingModule({
    imports: [FeedbackDialog],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { promptNumber: 2 } },
      { provide: FeedbackPrompt, useValue: { submit: vi.fn(submit) } },
      { provide: AnalyticsService, useValue: analytics },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(FeedbackDialog);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const click = async (testId: string) => {
    el.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
    await fixture.whenStable();
  };
  const events = () => analytics.captureEvent.mock.calls.map(([name]) => name);
  return { click, events, analytics, dialogRef, el };
}

const source = { source: 'automatic', prompt_number: 2 };

describe('FeedbackDialog', () => {
  it('should track viewed then submitted, never cancelled, on a successful send', async () => {
    const { click, events, analytics, dialogRef } = await setup(() =>
      Promise.resolve(),
    );
    await click('rating-4-input');
    await click('submit-button');

    expect(dialogRef.close).toHaveBeenCalled();
    expect(events()).toEqual([
      ANALYTICS_EVENTS.FEEDBACK_VIEWED,
      ANALYTICS_EVENTS.FEEDBACK_SUBMITTED,
    ]);
    expect(analytics.captureEvent).toHaveBeenLastCalledWith(
      ANALYTICS_EVENTS.FEEDBACK_SUBMITTED,
      { ...source, rating: 4, has_comment: false, has_details: false },
    );
  });

  it('should show the selected rating label under the stars', async () => {
    const { click, el } = await setup(() => Promise.resolve());
    const label = () =>
      el.querySelector('[data-testid="rating-label"]')!.textContent!.trim();

    expect(label()).toBe('');
    await click('rating-4-input');
    expect(label()).toBe('Bien');
  });

  it('should keep the dialog open with an error when the send fails', async () => {
    const { click, events, dialogRef, el } = await setup(() =>
      Promise.reject(new Error('offline')),
    );
    await click('rating-2-input');
    await click('submit-button');

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      "Ton avis n'est pas parti",
    );
    expect(events()).toEqual([ANALYTICS_EVENTS.FEEDBACK_VIEWED]);
  });

  it('should not let the dialog close while the send is in flight', async () => {
    let finishSend: () => void = () => undefined;
    const { click, dialogRef, el } = await setup(
      () => new Promise<void>((resolve) => (finishSend = resolve)),
    );
    await click('rating-4-input');
    await click('submit-button');

    const later = el.querySelector<HTMLButtonElement>(
      '[data-testid="later-button"]',
    )!;
    expect(later.disabled).toBe(true);
    expect((dialogRef as { disableClose?: boolean }).disableClose).toBe(true);

    finishSend();
    await new Promise((resolve) => setTimeout(resolve));
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it('should let the dialog close again after a failed send', async () => {
    const { click, dialogRef, el } = await setup(() =>
      Promise.reject(new Error('offline')),
    );
    await click('rating-2-input');
    await click('submit-button');

    expect(
      el.querySelector<HTMLButtonElement>('[data-testid="later-button"]')!
        .disabled,
    ).toBe(false);
    expect((dialogRef as { disableClose?: boolean }).disableClose).toBe(false);
  });

  it('should track cancelled when closed without sending', async () => {
    const { click, events, analytics } = await setup(() => Promise.resolve());
    await click('later-button');

    expect(events()).toEqual([
      ANALYTICS_EVENTS.FEEDBACK_VIEWED,
      ANALYTICS_EVENTS.FEEDBACK_CANCELLED,
    ]);
    expect(analytics.captureEvent).toHaveBeenLastCalledWith(
      ANALYTICS_EVENTS.FEEDBACK_CANCELLED,
      source,
    );
  });
});
