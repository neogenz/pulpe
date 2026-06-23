import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SpreadOccurrence, SupportedCurrency } from 'pulpe-shared';

import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { SpreadOccurrencesList } from './spread-occurrences-list';
import type {
  SpreadOccurrenceViewModel,
  SpreadTracker,
} from './spread-occurrences-list.types';

registerLocaleData(localeFr);

/**
 * PUL-17 — the pure presentational cross-month occurrence list. Tests assert
 * the tracker line, one row per occurrence, the dual decimal policy
 * (aggregation 0-dec / ligne 2-dec), `ph-no-capture` on every amount span, and
 * the viewed-month marker. Domain builders are tested separately in
 * `spread-occurrence.view-model.spec.ts`.
 */
function occurrence(
  overrides: Partial<SpreadOccurrence> & { month: number; year: number },
): SpreadOccurrence {
  return {
    budgetLineId: `bl-${overrides.year}-${overrides.month}`,
    budgetId: `b-${overrides.year}-${overrides.month}`,
    name: 'Assurance',
    amount: 33.33,
    consumed: 0,
    transactionCount: 0,
    kind: 'expense',
    checkedAt: null,
    ...overrides,
  };
}

function viewModel(
  occ: SpreadOccurrence,
  flags: Partial<Omit<SpreadOccurrenceViewModel, 'occurrence'>> = {},
): SpreadOccurrenceViewModel {
  return {
    occurrence: occ,
    isPast: false,
    isCurrent: false,
    isChecked: occ.checkedAt != null,
    isClosed: false,
    ...flags,
  };
}

describe('SpreadOccurrencesList', () => {
  let fixture: ComponentFixture<SpreadOccurrencesList>;
  let component: SpreadOccurrencesList;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpreadOccurrencesList],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpreadOccurrencesList);
    component = fixture.componentInstance;
  });

  const render = (inputs: {
    occurrences: readonly SpreadOccurrenceViewModel[];
    tracker: SpreadTracker | null;
    currency?: SupportedCurrency;
    locale?: string;
    isCurrentPeriod?: boolean;
  }): HTMLElement => {
    setTestInput(component.occurrences, inputs.occurrences);
    setTestInput(component.tracker, inputs.tracker);
    setTestInput(component.currency, inputs.currency ?? 'EUR');
    setTestInput(component.locale, inputs.locale ?? 'fr-FR');
    if ('isCurrentPeriod' in inputs) {
      setTestInput(component.isCurrentPeriod, inputs.isCurrentPeriod ?? false);
    }
    TestBed.flushEffects();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const tracker = (overrides: Partial<SpreadTracker> = {}): SpreadTracker => ({
    count: 3,
    currentIndex: 2,
    cumulatedAmount: 66.67,
    totalAmount: 100,
    perMonthAmount: 33.33,
    progressPercent: 66.67,
    ...overrides,
  });

  it('should render one row per occurrence', () => {
    const occurrences = [
      viewModel(occurrence({ month: 5, year: 2026 })),
      viewModel(occurrence({ month: 6, year: 2026 })),
      viewModel(occurrence({ month: 7, year: 2026 })),
    ];

    const host = render({ occurrences, tracker: tracker() });

    expect(
      host.querySelectorAll('[data-testid^="spread-occurrence-"]'),
    ).toHaveLength(3);
  });

  it('should render the tracker line when a tracker is provided', () => {
    const occurrences = [viewModel(occurrence({ month: 6, year: 2026 }))];

    const host = render({
      occurrences,
      tracker: tracker({ count: 1, currentIndex: 1 }),
    });

    expect(host.querySelector('[data-testid="spread-tracker"]')).not.toBeNull();
  });

  it('should not render a tracker line when tracker is null', () => {
    const occurrences = [viewModel(occurrence({ month: 6, year: 2026 }))];

    const host = render({ occurrences, tracker: null });

    expect(host.querySelector('[data-testid="spread-tracker"]')).toBeNull();
  });

  it('should format tracker cumulé/total as aggregation (0 decimals)', () => {
    const occurrences = [viewModel(occurrence({ month: 6, year: 2026 }))];

    const host = render({
      occurrences,
      tracker: tracker({ cumulatedAmount: 66.67, totalAmount: 100 }),
    });

    const text =
      host.querySelector('[data-testid="spread-tracker"]')?.textContent ?? '';
    // Aggregation rounds to whole units → "67 € sur 100 €", never "66,67 €".
    expect(text).toContain('67');
    expect(text).toContain('100');
    expect(text).not.toContain('66,67');
    expect(text).not.toContain('100,00');
  });

  it('should format the per-month tracker amount as ligne (2 decimals)', () => {
    const occurrences = [viewModel(occurrence({ month: 6, year: 2026 }))];

    const host = render({
      occurrences,
      tracker: tracker({ perMonthAmount: 33.33 }),
    });

    const text =
      host.querySelector('[data-testid="spread-tracker"]')?.textContent ?? '';
    expect(text).toContain('33,33');
  });

  it('should format each occurrence amount as ligne (2 decimals)', () => {
    const occurrences = [
      viewModel(occurrence({ month: 6, year: 2026, amount: 33.34 })),
    ];

    const host = render({ occurrences, tracker: tracker() });

    const row = host.querySelector(
      '[data-testid="spread-occurrence-bl-2026-6"]',
    );
    expect(row?.textContent).toContain('33,34');
  });

  it('should append the EUR symbol, never the raw ISO code', () => {
    const occurrences = [
      viewModel(occurrence({ month: 6, year: 2026, amount: 33.34 })),
    ];

    const host = render({
      occurrences,
      tracker: tracker(),
      currency: 'EUR',
    });

    const row = host.querySelector(
      '[data-testid="spread-occurrence-bl-2026-6"]',
    );
    expect(row?.textContent).toContain('€');
    expect(row?.textContent).not.toContain('EUR');
  });

  it('should use the CHF apostrophe group separator and CHF symbol', () => {
    const occurrences = [
      viewModel(occurrence({ month: 6, year: 2026, amount: 1234.56 })),
    ];

    const host = render({
      occurrences,
      tracker: tracker({ totalAmount: 5000, cumulatedAmount: 2500 }),
      currency: 'CHF',
      locale: 'fr-CH',
    });

    const row = host.querySelector(
      '[data-testid="spread-occurrence-bl-2026-6"]',
    );
    const text = row?.textContent ?? '';
    // de-CH grouping uses an apostrophe separator + dot decimal. The exact
    // apostrophe glyph (straight U+0027 vs typographic U+2019) depends on the
    // runtime's ICU, so match either — what matters is apostrophe grouping
    // (de-CH), NOT the fr-CH space separator.
    expect(text).toMatch(/1[’']234\.56/);
    expect(text).not.toContain('1 234');
    expect(text).toContain('CHF');
  });

  it('should wrap every amount span in ph-no-capture', () => {
    const occurrences = [
      viewModel(occurrence({ month: 5, year: 2026 })),
      viewModel(occurrence({ month: 6, year: 2026 })),
    ];

    const host = render({ occurrences, tracker: tracker() });

    // Tracker cumulé span + tracker per-month span + 1 span per occurrence row.
    const captured = host.querySelectorAll('.ph-no-capture');
    expect(captured.length).toBeGreaterThanOrEqual(4);

    for (const row of host.querySelectorAll(
      '[data-testid^="spread-occurrence-"]',
    )) {
      expect(row.querySelector('.ph-no-capture')).not.toBeNull();
    }
  });

  it('should show the consommé réel with the prévu struck-through when the occurrence has sub-transactions', () => {
    const occurrences = [
      viewModel(
        occurrence({
          month: 6,
          year: 2026,
          amount: 204,
          consumed: 150,
          transactionCount: 1,
        }),
      ),
    ];

    const host = render({
      occurrences,
      tracker: tracker({ count: 1, currentIndex: 1 }),
    });

    const row = host.querySelector(
      '[data-testid="spread-occurrence-bl-2026-6"]',
    )!;
    // Consommé réel + struck prévu both follow the ligne policy (2 decimals).
    expect(row.textContent).toContain('150,00');
    const struck = row.querySelectorAll('.line-through');
    expect(struck).toHaveLength(1);
    expect(struck[0].textContent?.trim()).toBe('204,00');
  });

  it('should show only the prévu (no struck reference) when the occurrence has no sub-transactions', () => {
    const occurrences = [
      viewModel(occurrence({ month: 6, year: 2026, amount: 204 })),
    ];

    const host = render({
      occurrences,
      tracker: tracker({ count: 1, currentIndex: 1 }),
    });

    const row = host.querySelector(
      '[data-testid="spread-occurrence-bl-2026-6"]',
    )!;
    expect(row.querySelectorAll('.line-through')).toHaveLength(0);
    expect(row.textContent).toContain('204,00');
  });

  it('should mark the viewed-month row with the current marker', () => {
    const occurrences = [
      viewModel(occurrence({ month: 5, year: 2026 }), { isPast: true }),
      viewModel(occurrence({ month: 6, year: 2026 }), { isCurrent: true }),
      viewModel(occurrence({ month: 7, year: 2026 })),
    ];

    const host = render({ occurrences, tracker: tracker() });

    const markers = host.querySelectorAll(
      '[data-testid="spread-current-marker"]',
    );
    expect(markers).toHaveLength(1);

    const currentRow = host.querySelector(
      '[data-testid="spread-occurrence-bl-2026-6"]',
    );
    expect(currentRow?.getAttribute('data-current')).toBe('true');
    expect(
      currentRow?.querySelector('[data-testid="spread-current-marker"]'),
    ).not.toBeNull();
  });

  it('should label the marker "Ici" when not the live current period', () => {
    const occurrences = [
      viewModel(occurrence({ month: 6, year: 2026 }), { isCurrent: true }),
    ];

    const host = render({
      occurrences,
      tracker: tracker({ count: 1, currentIndex: 1 }),
      isCurrentPeriod: false,
    });

    expect(
      host.querySelector('[data-testid="spread-current-marker"]')?.textContent,
    ).toContain('Ici');
  });

  it('should label the marker "Ce mois" when it is the live current period', () => {
    const occurrences = [
      viewModel(occurrence({ month: 6, year: 2026 }), { isCurrent: true }),
    ];

    const host = render({
      occurrences,
      tracker: tracker({ count: 1, currentIndex: 1 }),
      isCurrentPeriod: true,
    });

    expect(
      host.querySelector('[data-testid="spread-current-marker"]')?.textContent,
    ).toContain('Ce mois');
  });

  it('should show the "not started" tracker copy when currentIndex is 0', () => {
    const occurrences = [viewModel(occurrence({ month: 8, year: 2026 }))];

    const host = render({
      occurrences,
      tracker: tracker({ count: 1, currentIndex: 0, cumulatedAmount: 0 }),
    });

    expect(
      host.querySelector('[data-testid="spread-tracker"]')?.textContent,
    ).toContain('Commence le mois prochain');
  });
});
