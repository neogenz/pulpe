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

  it('should set aria-label from tooltipText input', () => {
    setTestInput(component.originalAmount, 100);
    setTestInput(component.originalCurrency, 'EUR');
    setTestInput(component.tooltipText, 'Converti depuis 100 EUR');
    TestBed.flushEffects();
    fixture.detectChanges();
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.getAttribute('aria-label')).toBe('Converti depuis 100 EUR');
  });
});
