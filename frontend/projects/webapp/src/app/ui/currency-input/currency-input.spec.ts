import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach } from 'vitest';

import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { CurrencyInput } from './currency-input';

describe('CurrencyInput', () => {
  let fixture: ComponentFixture<CurrencyInput>;
  let component: CurrencyInput;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrencyInput, FormsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CurrencyInput);
    component = fixture.componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have required label input defined', () => {
      expect(component.label).toBeDefined();
    });

    it('should have value model defined', () => {
      expect(component.value).toBeDefined();
      expect(typeof component.value).toBe('function');
    });

    it('should have optional inputs defined', () => {
      expect(component.placeholder).toBeDefined();
      expect(component.ariaDescribedBy).toBeDefined();
      expect(component.required).toBeDefined();
      expect(component.testId).toBeDefined();
      expect(component.currency).toBeDefined();
      expect(component.autoFocus).toBeDefined();
    });
  });

  describe('Default Values', () => {
    it('should have placeholder default to 0.00', () => {
      expect(component.placeholder()).toBe('0.00');
    });

    it('should have currency default to CHF', () => {
      expect(component.currency()).toBe('CHF');
    });

    it('should have required default to false', () => {
      expect(component.required()).toBe(false);
    });

    it('should have testId default to currency-input', () => {
      expect(component.testId()).toBe('currency-input');
    });

    it('should have autoFocus default to true', () => {
      expect(component.autoFocus()).toBe(true);
    });

    it('should have value default to null', () => {
      expect(component.value()).toBeNull();
    });
  });

  describe('Model Binding', () => {
    it('should allow setting value via model', () => {
      component.value.set(250);
      expect(component.value()).toBe(250);
    });

    it('should allow setting value to null', () => {
      component.value.set(100);
      component.value.set(null);
      expect(component.value()).toBeNull();
    });
  });

  describe('Dynamic Currency', () => {
    beforeEach(() => {
      setTestInput(component.label, 'Montant');
    });

    it('should accept EUR currency via input', () => {
      setTestInput(component.currency, 'EUR');
      TestBed.flushEffects();
      expect(component.currency()).toBe('EUR');
    });

    it('should render the currency suffix in the template', async () => {
      setTestInput(component.currency, 'EUR');
      TestBed.flushEffects();
      fixture.detectChanges();
      await fixture.whenStable();

      const suffix = fixture.nativeElement.querySelector('[matTextSuffix]');
      expect(suffix?.textContent?.trim()).toBe('EUR');
    });

    it('should update aria-label with the current currency', async () => {
      setTestInput(component.label, 'Revenu');
      setTestInput(component.currency, 'EUR');
      TestBed.flushEffects();
      fixture.detectChanges();
      await fixture.whenStable();

      const input = fixture.nativeElement.querySelector('input');
      expect(input?.getAttribute('aria-label')).toBe('Revenu in EUR');
    });

    it('should update hint text with the current currency', async () => {
      setTestInput(component.currency, 'EUR');
      setTestInput(component.ariaDescribedBy, 'hint-id');
      TestBed.flushEffects();
      fixture.detectChanges();
      await fixture.whenStable();

      const hint = fixture.nativeElement.querySelector('mat-hint');
      expect(hint?.textContent).toContain('EUR');
    });
  });

  describe('Transloco hint', () => {
    it('mat-hint uses currency.inputHint transloco key with currency interpolation', async () => {
      setTestInput(component.label, 'Montant');
      setTestInput(component.currency, 'CHF');
      setTestInput(component.ariaDescribedBy, 'hint-id');
      TestBed.flushEffects();
      fixture.detectChanges();
      await fixture.whenStable();

      const hint = fixture.nativeElement.querySelector('mat-hint');
      expect(hint?.textContent?.trim()).toBe('Entre le montant en CHF');
    });
  });
});
