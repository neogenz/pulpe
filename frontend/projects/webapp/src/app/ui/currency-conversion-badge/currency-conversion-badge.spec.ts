import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

import { setTestInput } from '@app/testing/signal-test-utils';

import { CurrencyConversionBadge } from './currency-conversion-badge';

describe('CurrencyConversionBadge', () => {
  let fixture: ComponentFixture<CurrencyConversionBadge>;
  let component: CurrencyConversionBadge;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrencyConversionBadge],
      providers: [provideZonelessChangeDetection(), provideAnimationsAsync()],
    }).compileComponents();

    fixture = TestBed.createComponent(CurrencyConversionBadge);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render when originalAmount is null', () => {
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon).toBeNull();
  });

  it('should not render when originalCurrency is null', () => {
    setTestInput(component.originalAmount, 100);
    TestBed.flushEffects();
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon).toBeNull();
  });

  it('should render icon when conversion metadata is present', () => {
    setTestInput(component.originalAmount, 100);
    setTestInput(component.originalCurrency, 'EUR');
    TestBed.flushEffects();
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon).not.toBeNull();
    expect(icon.textContent?.trim()).toBe('currency_exchange');
  });

  it('should format tooltip with amount and rate', () => {
    setTestInput(component.originalAmount, 1000);
    setTestInput(component.originalCurrency, 'EUR');
    setTestInput(component.exchangeRate, 0.9412);
    TestBed.flushEffects();
    fixture.detectChanges();
    const tooltip = component['tooltipText']();
    expect(tooltip).toContain('Converti depuis');
    expect(tooltip).toContain('€');
    expect(tooltip).toContain('Taux');
    expect(tooltip).toContain('0.9412');
  });

  it('should format tooltip without rate when exchangeRate is null', () => {
    setTestInput(component.originalAmount, 500);
    setTestInput(component.originalCurrency, 'CHF');
    TestBed.flushEffects();
    fixture.detectChanges();
    const tooltip = component['tooltipText']();
    expect(tooltip).toContain('CHF');
    expect(tooltip).not.toContain('Taux');
  });
});
