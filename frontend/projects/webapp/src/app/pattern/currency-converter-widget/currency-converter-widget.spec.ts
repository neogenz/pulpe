import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CURRENCY_CONFIG, CurrencyConverterService } from '@core/currency';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { CurrencyConverterWidget } from './currency-converter-widget';

/** Keep in sync with {@link CurrencyConverterWidget} template test ids. */
const SEL = {
  root: '[data-testid="currency-converter"]',
  amountInput: '[data-testid="converter-amount-input"]',
  swap: '[data-testid="converter-swap-button"]',
  result: '[data-testid="converter-result"]',
  rateError: '[data-testid="converter-rate-error"]',
  rateInfo: '[data-testid="converter-rate-info"]',
  spinner: 'mat-progress-spinner',
  errMax: '[data-testid="converter-amount-max-error"]',
  errMin: '[data-testid="converter-amount-min-error"]',
  errRequired: '[data-testid="converter-amount-required-error"]',
} as const;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface MockConverter {
  fetchRate: ReturnType<typeof vi.fn>;
  convert: ReturnType<typeof vi.fn>;
}

function providers(mock: MockConverter) {
  return [
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    ...provideTranslocoForTest(),
    { provide: CurrencyConverterService, useValue: mock },
  ];
}

function createMockConverter(
  overrides: Partial<{
    fetchRate: MockConverter['fetchRate'];
    convert: MockConverter['convert'];
  }> = {},
): MockConverter {
  return {
    fetchRate: overrides.fetchRate ?? vi.fn().mockResolvedValue({ rate: 1.05 }),
    convert:
      overrides.convert ??
      vi.fn((amount: number, rate: number) => amount * rate),
  };
}

/**
 * Runs pending signal/effect work (zoneless) and stabilizes the fixture.
 * Call after programmatic signal or signal-form updates.
 */
async function flushUi(fixture: ComponentFixture<unknown>): Promise<void> {
  TestBed.flushEffects();
  TestBed.tick();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Binds literals so the child never sees default-input CHF/EUR before CHF/CHF. */
@Component({
  standalone: true,
  imports: [CurrencyConverterWidget],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-currency-converter-widget
      [savedCurrency]="'CHF'"
      [draftCurrency]="'CHF'"
    />
  `,
})
class CurrencyConverterHostSameStatic {}

/**
 * Binds a cross pair before the first `detectChanges()`.
 * Prefer {@link setTestInput} over `componentRef.setInput()` for signal inputs under zoneless TestBed.
 */
function bindChfEur(widget: CurrencyConverterWidget): void {
  setTestInput(widget.savedCurrency, 'CHF');
  setTestInput(widget.draftCurrency, 'EUR');
}

describe('CurrencyConverterWidget', () => {
  describe('standalone widget (CHF → EUR)', () => {
    let fixture: ComponentFixture<CurrencyConverterWidget>;
    let mock: MockConverter;

    beforeEach(async () => {
      mock = createMockConverter();
      await TestBed.configureTestingModule({
        imports: [CurrencyConverterWidget],
        providers: providers(mock),
      }).compileComponents();

      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
    });

    it('should render the converter shell', () => {
      expect(fixture.nativeElement.querySelector(SEL.root)).not.toBeNull();
    });

    it('should request the default pair CHF → EUR after init', async () => {
      await flushUi(fixture);

      expect(mock.fetchRate).toHaveBeenCalledTimes(1);
      expect(mock.fetchRate).toHaveBeenCalledWith('CHF', 'EUR');
    });

    it('should show converted amount and call convert with the fetched rate', async () => {
      mock.fetchRate.mockResolvedValue({ rate: 1.1 });
      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
      await flushUi(fixture);

      const w = fixture.componentInstance;
      expect(w.converterForm.amount().value()).toBe(100);
      expect(mock.convert).toHaveBeenCalledWith(100, 1.1);

      const result = fixture.nativeElement.querySelector(SEL.result);
      expect(result).not.toBeNull();
      expect(result?.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('should show rate info when a cross-currency rate is available', async () => {
      mock.fetchRate.mockResolvedValue({ rate: 1.23456 });
      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
      await flushUi(fixture);

      const info = fixture.nativeElement.querySelector(SEL.rateInfo);
      expect(info).not.toBeNull();
      expect(info?.textContent).toContain('CHF');
      expect(info?.textContent).toContain('EUR');
    });

    it('should show a loading spinner while fetchRate is pending', async () => {
      let resolveRate!: (value: { rate: number }) => void;
      const pending = new Promise<{ rate: number }>((res) => {
        resolveRate = res;
      });
      mock.fetchRate.mockReturnValue(pending);

      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
      TestBed.flushEffects();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector(SEL.spinner)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).toBeNull();

      resolveRate!({ rate: 1.05 });
      await flushUi(fixture);

      expect(fixture.nativeElement.querySelector(SEL.spinner)).toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).not.toBeNull();
    });

    it('should show rate error and hide result when fetchRate rejects', async () => {
      mock.fetchRate.mockRejectedValueOnce(new Error('network'));

      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
      await flushUi(fixture);

      expect(fixture.nativeElement.querySelector(SEL.rateError)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.rateInfo)).toBeNull();
    });

    it('should not throw when the resource ends in error state', async () => {
      mock.fetchRate.mockRejectedValueOnce(new Error('network'));
      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();

      await expect(flushUi(fixture)).resolves.toBeUndefined();
    });

    describe('swap direction', () => {
      it('should refetch with inverted pair EUR → CHF after swap', async () => {
        await flushUi(fixture);
        mock.fetchRate.mockClear();

        const swap = fixture.nativeElement.querySelector(
          SEL.swap,
        ) as HTMLButtonElement;
        swap.click();
        await flushUi(fixture);

        expect(mock.fetchRate).toHaveBeenCalledWith('EUR', 'CHF');
      });

      it('should show the EUR symbol as amount suffix after swap (base becomes EUR)', async () => {
        await flushUi(fixture);

        const swap = fixture.nativeElement.querySelector(
          SEL.swap,
        ) as HTMLButtonElement;
        swap.click();
        await flushUi(fixture);

        const suffix = fixture.nativeElement.querySelector(
          '.mat-mdc-form-field-text-suffix',
        );
        expect(suffix?.textContent).toContain(CURRENCY_CONFIG.EUR.symbol);
      });
    });
  });

  describe('currency inputs from parent', () => {
    it('should not call fetchRate when saved and draft currencies match', async () => {
      const mock = createMockConverter();
      await TestBed.configureTestingModule({
        imports: [CurrencyConverterHostSameStatic],
        providers: providers(mock),
      }).compileComponents();

      const fixture = TestBed.createComponent(CurrencyConverterHostSameStatic);
      fixture.detectChanges();
      await flushUi(fixture);

      expect(mock.fetchRate).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector(SEL.rateInfo)).toBeNull();
    });

    it('should request a new rate when saved/draft inputs change to another cross pair', async () => {
      const mock = createMockConverter();
      await TestBed.configureTestingModule({
        imports: [CurrencyConverterWidget],
        providers: providers(mock),
      }).compileComponents();

      const fixture = TestBed.createComponent(CurrencyConverterWidget);
      const w = fixture.componentInstance;
      bindChfEur(w);
      TestBed.flushEffects();
      fixture.detectChanges();
      await flushUi(fixture);

      expect(mock.fetchRate).toHaveBeenCalledWith('CHF', 'EUR');
      mock.fetchRate.mockClear();

      setTestInput(w.savedCurrency, 'EUR');
      setTestInput(w.draftCurrency, 'CHF');
      TestBed.flushEffects();
      fixture.detectChanges();
      await flushUi(fixture);

      expect(mock.fetchRate).toHaveBeenCalledTimes(1);
      expect(mock.fetchRate).toHaveBeenCalledWith('EUR', 'CHF');
    });
  });

  describe('amount validation (signal forms)', () => {
    let fixture: ComponentFixture<CurrencyConverterWidget>;
    let w: CurrencyConverterWidget;
    let mock: MockConverter;

    beforeEach(async () => {
      mock = createMockConverter();
      await TestBed.configureTestingModule({
        imports: [CurrencyConverterWidget],
        providers: providers(mock),
      }).compileComponents();

      fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
      w = fixture.componentInstance;
      await flushUi(fixture);
    });

    it('should mark the field invalid and show max error when amount exceeds converterAmountMax', async () => {
      const max = w.converterAmountMax;
      w.converterForm.amount().value.set(max + 1);
      await flushUi(fixture);

      expect(w.converterForm.amount().invalid()).toBe(true);
      expect(
        w.converterForm
          .amount()
          .errors()
          .some((e) => e.kind === 'max'),
      ).toBe(true);
      expect(fixture.nativeElement.querySelector(SEL.errMax)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).toBeNull();
    });

    it('should mark the field invalid and show min error when amount is below zero', async () => {
      w.converterForm.amount().value.set(-1);
      await flushUi(fixture);

      expect(w.converterForm.amount().invalid()).toBe(true);
      expect(fixture.nativeElement.querySelector(SEL.errMin)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).toBeNull();
    });

    it('should mark the field invalid and show required error when amount is null', async () => {
      w.converterForm.amount().value.set(null);
      await flushUi(fixture);

      expect(w.converterForm.amount().invalid()).toBe(true);
      expect(
        fixture.nativeElement.querySelector(SEL.errRequired),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).toBeNull();
    });

    it('should clear validation errors and show the result when amount becomes valid again', async () => {
      w.converterForm.amount().value.set(null);
      await flushUi(fixture);
      expect(
        fixture.nativeElement.querySelector(SEL.errRequired),
      ).not.toBeNull();

      w.converterForm.amount().value.set(50);
      await flushUi(fixture);

      expect(w.converterForm.amount().valid()).toBe(true);
      expect(fixture.nativeElement.querySelector(SEL.errRequired)).toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).not.toBeNull();
    });
  });

  describe('in-flight fetch supersession', () => {
    it('should apply the latest resolved rate when an older fetch finishes later', async () => {
      const mock = createMockConverter();
      const order: number[] = [];

      mock.fetchRate.mockImplementation(
        async (base: string, target: string) => {
          if (base === 'CHF' && target === 'EUR') {
            order.push(1);
            await delay(40);
            return { rate: 2.0 };
          }
          order.push(2);
          return { rate: 9.0 };
        },
      );

      await TestBed.configureTestingModule({
        imports: [CurrencyConverterWidget],
        providers: providers(mock),
      }).compileComponents();

      const fixture = TestBed.createComponent(CurrencyConverterWidget);
      bindChfEur(fixture.componentInstance);
      TestBed.flushEffects();
      fixture.detectChanges();
      TestBed.flushEffects();
      fixture.detectChanges();

      const swap = fixture.nativeElement.querySelector(
        SEL.swap,
      ) as HTMLButtonElement;
      swap.click();
      await flushUi(fixture);

      expect(order).toEqual([1, 2]);
      expect(mock.convert).toHaveBeenCalledWith(100, 9.0);

      expect(fixture.nativeElement.querySelector(SEL.rateError)).toBeNull();
      expect(fixture.nativeElement.querySelector(SEL.result)).not.toBeNull();
    });
  });
});
