import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import {
  ConversionPreviewLine,
  type ConversionPreviewStatus,
} from './conversion-preview-line';

describe('ConversionPreviewLine', () => {
  let fixture: ComponentFixture<ConversionPreviewLine>;
  let component: ConversionPreviewLine;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversionPreviewLine],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversionPreviewLine);
    component = fixture.componentInstance;
  });

  const render = (inputs: {
    amount?: number | null;
    inputCurrency?: 'CHF' | 'EUR' | null;
    displayCurrency?: 'CHF' | 'EUR';
    rate?: number | null;
    cachedDate?: string | null;
    status?: ConversionPreviewStatus;
  }): HTMLElement | null => {
    setTestInput(component.amount, inputs.amount ?? null);
    setTestInput(component.inputCurrency, inputs.inputCurrency ?? null);
    setTestInput(component.displayCurrency, inputs.displayCurrency ?? 'EUR');
    setTestInput(component.rate, inputs.rate ?? null);
    setTestInput(component.cachedDate, inputs.cachedDate ?? null);
    setTestInput(component.status, inputs.status ?? 'hidden');
    TestBed.flushEffects();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector(
      '[data-testid="conversion-preview-line"]',
    );
  };

  describe('rendering gate', () => {
    it('renders no live region when status is hidden', () => {
      const root = render({ status: 'hidden' });

      expect(root).toBeNull();
    });
  });

  describe('ready state', () => {
    it('displays the formatted converted amount and rate', () => {
      const root = render({
        amount: 108.99,
        rate: 1.0899,
        displayCurrency: 'EUR',
        status: 'ready',
      });

      expect(root).not.toBeNull();
      const amount = root?.querySelector(
        '[data-testid="conversion-preview-amount"]',
      );
      expect(amount?.textContent).toContain('108,99');
      expect(amount?.textContent).toContain('€');
      expect(amount?.textContent).toContain('1,0899');
    });

    it('carries ph-no-capture for amount-blurring privacy', () => {
      const root = render({
        amount: 100,
        rate: 1,
        displayCurrency: 'EUR',
        status: 'ready',
      });

      expect(root?.classList.contains('ph-no-capture')).toBe(true);
    });

    it('exposes role=status with polite live region', () => {
      const root = render({
        amount: 100,
        rate: 1,
        displayCurrency: 'EUR',
        status: 'ready',
      });

      expect(root?.getAttribute('role')).toBe('status');
      expect(root?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('loading state', () => {
    it('renders a spinner and the loading caption', () => {
      const root = render({ status: 'loading' });

      expect(root).not.toBeNull();
      expect(root?.querySelector('mat-progress-spinner')).not.toBeNull();
      expect(root?.textContent).toContain('Calcul du taux');
    });
  });

  describe('error state', () => {
    it('renders a muted unavailable message', () => {
      const root = render({ status: 'error' });

      expect(root).not.toBeNull();
      const message = root?.querySelector(
        '[data-testid="conversion-preview-error"]',
      );
      expect(message?.textContent).toContain('Taux indisponible');
    });
  });

  describe('fallback state', () => {
    it('renders the amount and a cached-date chip when a cached date is provided', () => {
      const root = render({
        amount: 108,
        rate: 1.08,
        cachedDate: '2026-04-22',
        displayCurrency: 'EUR',
        status: 'fallback',
      });

      expect(root).not.toBeNull();
      const chip = root?.querySelector(
        '[data-testid="conversion-preview-fallback-date"]',
      );
      expect(chip?.textContent).toContain('Taux du');
      expect(chip?.textContent).toContain('avr');
    });

    it('omits the chip when the cached date is missing', () => {
      const root = render({
        amount: 108,
        rate: 1.08,
        displayCurrency: 'EUR',
        status: 'fallback',
      });

      expect(
        root?.querySelector('[data-testid="conversion-preview-fallback-date"]'),
      ).toBeNull();
    });
  });
});
