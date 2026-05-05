import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { CurrencyConversionBadge } from './currency-conversion-badge';

describe('CurrencyConversionBadge', () => {
  let fixture: ComponentFixture<CurrencyConversionBadge>;
  let component: CurrencyConversionBadge;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrencyConversionBadge],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
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

  it('should expose an aria-label on the pill derived from the formatted original amount', () => {
    setTestInput(component.originalAmount, 100);
    setTestInput(component.originalCurrency, 'EUR');
    setTestInput(component.tooltipText, 'Converti depuis 100 EUR');
    TestBed.flushEffects();
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('span[role="note"]');
    expect(pill).not.toBeNull();
    expect(pill.getAttribute('aria-label')).toContain('Converti depuis');
    expect(pill.getAttribute('aria-label')).toContain('100');
  });

  it('displays inline pill text containing the formatted original amount when conversion is present', async () => {
    setTestInput(component.originalAmount, 42.5);
    setTestInput(component.originalCurrency, 'EUR');
    TestBed.flushEffects();
    fixture.detectChanges();
    await fixture.whenStable();

    const pill = fixture.nativeElement.querySelector('.ph-no-capture');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('42,50');
  });

  it('pill is hidden when originalAmount is null', () => {
    setTestInput(component.originalCurrency, 'EUR');
    TestBed.flushEffects();
    fixture.detectChanges();

    const pill = fixture.nativeElement.querySelector('.ph-no-capture');
    expect(pill).toBeNull();
  });

  it('formattedOriginalAmount uses CHF locale fr-CH for CHF currency', async () => {
    setTestInput(component.originalAmount, 100);
    setTestInput(component.originalCurrency, 'CHF');
    TestBed.flushEffects();
    fixture.detectChanges();
    await fixture.whenStable();

    const pill = fixture.nativeElement.querySelector('.ph-no-capture');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('CHF');
    expect(pill.textContent).toContain('100');
  });
});
