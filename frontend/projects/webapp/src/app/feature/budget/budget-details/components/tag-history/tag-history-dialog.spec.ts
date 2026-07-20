import {
  Component,
  input,
  provideZonelessChangeDetection,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { TagApi } from '@core/tag';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { Observable, of, Subject, throwError } from 'rxjs';
import type {
  SupportedCurrency,
  Tag,
  TagHistoryMonth,
  TagHistoryResponse,
} from 'pulpe-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TagHistoryDialog,
  type TagHistoryDialogData,
} from './tag-history-dialog';
import { TagHistoryChart } from './tag-history-chart';

@Component({
  selector: 'pulpe-tag-history-chart',
  template: '<span data-testid="tag-history-chart-stub"></span>',
})
class TagHistoryChartStub {
  readonly periods = input.required<readonly TagHistoryMonth[]>();
  readonly selectedTagName = input.required<string>();
  readonly currency = input.required<SupportedCurrency>();
  readonly totalActual = input.required<number>();
  readonly monthlyAverageActual = input.required<number>();
}

const userId = '11111111-1111-4111-8111-111111111111';
const tags: Tag[] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    userId,
    name: 'Courses',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    userId,
    name: 'Maison',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
];

function makeResponse(tagId = tags[0].id): TagHistoryResponse {
  return {
    success: true,
    data: {
      tagId,
      periods: [
        { month: 5, year: 2026, plannedAmount: 100, actualAmount: 80 },
        { month: 6, year: 2026, plannedAmount: 0, actualAmount: 0 },
        { month: 7, year: 2026, plannedAmount: 150, actualAmount: 120 },
      ],
      totalPlanned: 250,
      totalActual: 200,
      monthlyAverageActual: 66.67,
      actualToPlannedPercent: 80,
    },
  };
}

describe('TagHistoryDialog', () => {
  let fixture: ComponentFixture<TagHistoryDialog>;
  let component: TagHistoryDialog;
  let getHistory$: ReturnType<typeof vi.fn>;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    TestBed.flushEffects();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setup(data: Partial<TagHistoryDialogData> = {}): void {
    getHistory$ = vi.fn().mockReturnValue(of(makeResponse()));
    TestBed.configureTestingModule({
      imports: [TagHistoryDialog, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideCharts(withDefaultRegisterables()),
        ...provideTranslocoForTest(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            tags,
            endMonth: 7,
            endYear: 2026,
            currency: 'CHF',
            ...data,
          } satisfies TagHistoryDialogData,
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: TagApi, useValue: { getHistory$ } },
      ],
    });
    TestBed.overrideComponent(TagHistoryDialog, {
      remove: { imports: [TagHistoryChart] },
      add: { imports: [TagHistoryChartStub] },
    });
    fixture = TestBed.createComponent(TagHistoryDialog);
    component = fixture.componentInstance;
  }

  beforeEach(() => setup());

  it('keeps the title clear of the dialog top edge', async () => {
    await settle();

    const header: HTMLElement | null =
      fixture.nativeElement.querySelector('[mat-dialog-title]');

    expect(header).not.toBeNull();
    expect(header?.classList).toContain('pt-6!');
  });

  it('formats summary amounts as rounded aggregations', () => {
    expect(component['formatAmount'](1234.56)).toContain('1’235');
  });

  it('selects the first tag and reloads for each tag or horizon change', async () => {
    await settle();
    expect(component['selectedTagId']()).toBe(tags[0].id);
    expect(getHistory$).toHaveBeenLastCalledWith(tags[0].id, {
      months: 3,
      endMonth: 7,
      endYear: 2026,
    });

    component['selectedTagId'].set(tags[1].id);
    component['months'].set(12);
    await settle();

    expect(getHistory$).toHaveBeenLastCalledWith(tags[1].id, {
      months: 12,
      endMonth: 7,
      endYear: 2026,
    });
    expect(fixture.nativeElement.textContent).toContain('Total réel');
  });

  it('keeps the selection and recovers after a failed request', async () => {
    getHistory$.mockReturnValueOnce(
      throwError(() => new Error('history unavailable')),
    );
    component['historyResource'].reload();
    await settle();

    expect(
      fixture.nativeElement.querySelector('[data-testid="tag-history-error"]'),
    ).not.toBeNull();

    getHistory$.mockReturnValueOnce(of(makeResponse()));
    component['retry']();
    await settle();

    expect(component['selectedTagId']()).toBe(tags[0].id);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="tag-history-summary"]',
      ),
    ).not.toBeNull();
  });

  it('distinguishes loading and an all-zero history', async () => {
    await settle();
    const pending = new Subject<TagHistoryResponse>();
    getHistory$.mockReturnValueOnce(pending);
    component['months'].set(6);
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="tag-history-loading"]',
      ),
    ).not.toBeNull();

    pending.next({
      ...makeResponse(),
      data: {
        ...makeResponse().data,
        periods: [
          { month: 5, year: 2026, plannedAmount: 0, actualAmount: 0 },
          { month: 6, year: 2026, plannedAmount: 0, actualAmount: 0 },
          { month: 7, year: 2026, plannedAmount: 0, actualAmount: 0 },
        ],
        totalPlanned: 0,
        totalActual: 0,
        monthlyAverageActual: 0,
        actualToPlannedPercent: null,
      },
    });
    await settle();

    expect(
      fixture.nativeElement.querySelector('[data-testid="tag-history-empty"]'),
    ).not.toBeNull();
  });

  it('cancels the previous request when the history parameters change', async () => {
    const teardown = vi.fn();
    getHistory$.mockReturnValueOnce(
      new Observable<TagHistoryResponse>(() => teardown),
    );
    component['historyResource'].reload();
    fixture.detectChanges();
    TestBed.flushEffects();

    component['months'].set(6);
    fixture.detectChanges();
    TestBed.flushEffects();
    await fixture.whenStable();

    expect(teardown).toHaveBeenCalledOnce();
  });

  it('masks cards and accessible chart text without removing the data', async () => {
    await settle();
    TestBed.inject(AmountsVisibilityService).toggle();
    fixture.detectChanges();

    const summary: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="tag-history-summary"]',
    );
    expect(summary.textContent).toContain('•••••');
    expect(summary.textContent).not.toContain('200 CHF');
    expect(component['history']()?.totalActual).toBe(200);
  });
});
