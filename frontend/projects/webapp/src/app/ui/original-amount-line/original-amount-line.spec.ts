import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { OriginalAmountLine } from './original-amount-line';

describe('OriginalAmountLine', () => {
  let fixture: ComponentFixture<OriginalAmountLine>;
  let component: OriginalAmountLine;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OriginalAmountLine],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OriginalAmountLine);
    component = fixture.componentInstance;
  });

  const render = (inputs: {
    originalAmount?: number | null;
    originalCurrency?: 'CHF' | 'EUR' | null;
    displayCurrency?: 'CHF' | 'EUR';
    tooltipText?: string;
  }): HTMLElement | null => {
    setTestInput(component.displayCurrency, inputs.displayCurrency ?? 'EUR');
    if ('originalAmount' in inputs) {
      setTestInput(component.originalAmount, inputs.originalAmount);
    }
    if ('originalCurrency' in inputs) {
      setTestInput(component.originalCurrency, inputs.originalCurrency);
    }
    if ('tooltipText' in inputs) {
      setTestInput(component.tooltipText, inputs.tooltipText ?? '');
    }
    TestBed.flushEffects();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector(
      '[data-testid="original-amount-line"]',
    );
  };

  describe('rendering gate', () => {
    it('renders nothing when originalAmount is missing', () => {
      expect(render({ originalCurrency: 'CHF' })).toBeNull();
    });

    it('renders nothing when originalCurrency is missing', () => {
      expect(render({ originalAmount: 100 })).toBeNull();
    });

    it('renders nothing when originalCurrency equals displayCurrency', () => {
      expect(
        render({ originalAmount: 100, originalCurrency: 'EUR' }),
      ).toBeNull();
    });
  });

  describe('with a historical conversion', () => {
    it('displays the formatted original amount', () => {
      const line = render({ originalAmount: 100, originalCurrency: 'CHF' });

      expect(line).not.toBeNull();
      expect(line?.textContent).toContain('100');
      expect(line?.textContent).toContain('CHF');
    });

    it('treats 0 as a valid amount (not swallowed by the null gate)', () => {
      const line = render({ originalAmount: 0, originalCurrency: 'CHF' });

      expect(line).not.toBeNull();
      expect(line?.textContent).toContain('0');
    });

    it('formats each currency with its own locale (no CHF leakage on EUR)', () => {
      const line = render({
        originalAmount: 100,
        originalCurrency: 'EUR',
        displayCurrency: 'CHF',
      });

      expect(line?.textContent).toContain('€');
      expect(line?.textContent).not.toContain('CHF');
    });

    it('stacks as a caption under the primary amount (block, label-small, on-surface-variant)', () => {
      const line = render({ originalAmount: 100, originalCurrency: 'CHF' });

      expect(line?.classList.contains('block')).toBe(true);
      expect(line?.classList.contains('text-label-small')).toBe(true);
      expect(line?.classList.contains('text-on-surface-variant')).toBe(true);
    });

    it('carries ph-no-capture for amount-blurring privacy', () => {
      const line = render({ originalAmount: 42.5, originalCurrency: 'CHF' });

      expect(line?.classList.contains('ph-no-capture')).toBe(true);
    });

    it('exposes an aria-label that includes the formatted amount', () => {
      const line = render({ originalAmount: 100, originalCurrency: 'CHF' });

      expect(line?.getAttribute('aria-label')).toContain('100');
      expect(line?.getAttribute('aria-label')).toContain('CHF');
    });
  });

  describe('tooltip surface', () => {
    it('renders as a plain caption when no tooltip text is provided', () => {
      const line = render({ originalAmount: 100, originalCurrency: 'CHF' });

      expect(line?.getAttribute('role')).toBeNull();
      expect(line?.hasAttribute('tabindex')).toBe(false);
      expect(line?.classList.contains('cursor-help')).toBe(false);
    });

    it('becomes an interactive note (role, tabindex, cursor-help) when a tooltip is provided', () => {
      const line = render({
        originalAmount: 100,
        originalCurrency: 'CHF',
        tooltipText: 'Tu as entré 100 CHF · taux 1,0899',
      });

      expect(line?.getAttribute('role')).toBe('note');
      expect(line?.getAttribute('tabindex')).toBe('0');
      expect(line?.classList.contains('cursor-help')).toBe(true);
    });
  });
});
