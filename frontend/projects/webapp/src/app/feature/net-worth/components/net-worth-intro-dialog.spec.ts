import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { ANALYTICS_EVENTS } from 'pulpe-shared';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from '@core/analytics';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  NetWorthIntroDialog,
  type NetWorthIntroDialogData,
  type NetWorthIntroResult,
} from './net-worth-intro-dialog';

describe('NetWorthIntroDialog', () => {
  const captureEvent = vi.fn();
  let closed: Subject<NetWorthIntroResult>;
  let close: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<NetWorthIntroDialog>;

  const byTestId = (id: string) =>
    fixture.nativeElement.querySelector(
      `[data-testid="${id}"]`,
    ) as HTMLElement | null;

  async function setup(data: NetWorthIntroDialogData): Promise<void> {
    vi.clearAllMocks();
    closed = new Subject<NetWorthIntroResult>();
    close = vi.fn((result: NetWorthIntroResult) => closed.next(result));
    TestBed.configureTestingModule({
      imports: [NetWorthIntroDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        {
          provide: MatDialogRef,
          useValue: { close, afterClosed: () => closed },
        },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: AnalyticsService, useValue: { captureEvent } },
        { provide: UserSettingsStore, useValue: { currency: signal('CHF') } },
      ],
    });
    fixture = TestBed.createComponent(NetWorthIntroDialog);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function tapPrimary(times = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      byTestId('net-worth-intro-primary-button')?.click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
  }

  const endEvents = () =>
    captureEvent.mock.calls.filter(
      ([event]) => event !== ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED,
    );

  it('should report the opening with its source', async () => {
    await setup({ source: 'help', isEmpty: false });

    expect(captureEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.NET_WORTH_INTRO_VIEWED,
      { source: 'help' },
    );
  });

  it('should walk the three steps and drop « Plus tard » on the last one', async () => {
    await setup({ source: 'auto', isEmpty: false });
    expect(byTestId('net-worth-intro-later-button')).not.toBeNull();

    await tapPrimary(2);

    expect(byTestId('net-worth-intro-later-button')).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it('should close with "close" from a filled net worth and send one completed event', async () => {
    await setup({ source: 'auto', isEmpty: false });

    await tapPrimary(3);

    expect(close).toHaveBeenCalledWith('close');
    expect(endEvents()).toEqual([
      [
        ANALYTICS_EVENTS.NET_WORTH_INTRO_COMPLETED,
        { source: 'auto', action: 'close' },
      ],
    ]);
  });

  it('should close with "add" from an empty net worth', async () => {
    await setup({ source: 'auto', isEmpty: true });

    await tapPrimary(3);

    expect(close).toHaveBeenCalledWith('add');
    expect(endEvents()).toEqual([
      [
        ANALYTICS_EVENTS.NET_WORTH_INTRO_COMPLETED,
        { source: 'auto', action: 'add_asset' },
      ],
    ]);
  });

  it('should count Escape or a backdrop click as skipped at the current step', async () => {
    await setup({ source: 'auto', isEmpty: false });
    await tapPrimary(1);

    closed.next(undefined);

    expect(endEvents()).toEqual([
      [ANALYTICS_EVENTS.NET_WORTH_INTRO_SKIPPED, { source: 'auto', step: 1 }],
    ]);
  });
});
