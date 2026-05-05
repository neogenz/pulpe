import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import type { TransactionKind, TransactionRecurrence } from 'pulpe-shared';
import { FinancialLineCard } from './financial-line-card';

describe('FinancialLineCard', () => {
  let fixture: ComponentFixture<FinancialLineCard>;
  let component: FinancialLineCard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialLineCard],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancialLineCard);
    component = fixture.componentInstance;
  });

  describe('Component Structure', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should default currency to CHF', () => {
      expect(component.currency()).toBe('CHF');
    });

    it('should default isStriked to false', () => {
      expect(component.isStriked()).toBe(false);
    });

    it('should default recurrence to undefined', () => {
      expect(component.recurrence()).toBeUndefined();
    });

    it('should default dataTestId to undefined', () => {
      expect(component.dataTestId()).toBeUndefined();
    });
  });

  describe('Input signals', () => {
    it('should expose kind input value', () => {
      setTestInput(component.kind, 'income' as TransactionKind);
      expect(component.kind()).toBe('income');
    });

    it('should expose name input value', () => {
      setTestInput(component.name, 'Loyer');
      expect(component.name()).toBe('Loyer');
    });

    it('should expose amount input value', () => {
      setTestInput(component.amount, 1500);
      expect(component.amount()).toBe(1500);
    });

    it('should expose recurrence input value', () => {
      setTestInput(component.recurrence, 'fixed' as TransactionRecurrence);
      expect(component.recurrence()).toBe('fixed');
    });

    it('should expose isStriked input value', () => {
      setTestInput(component.isStriked, true);
      expect(component.isStriked()).toBe(true);
    });

    it('should expose dataTestId input value', () => {
      setTestInput(component.dataTestId, 'line-loyer');
      expect(component.dataTestId()).toBe('line-loyer');
    });
  });
});
