import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import type { TransactionKind } from 'pulpe-shared';
import { FinancialKindIndicator } from './financial-kind-indicator';

describe('FinancialKindIndicator', () => {
  let fixture: ComponentFixture<FinancialKindIndicator>;
  let component: FinancialKindIndicator;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinancialKindIndicator],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FinancialKindIndicator);
    component = fixture.componentInstance;
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should default size to 12', () => {
      expect(component.size()).toBe(12);
    });
  });

  describe('Background color by kind', () => {
    const kindColorCases: { kind: TransactionKind; cssVar: string }[] = [
      { kind: 'income', cssVar: '--pulpe-financial-income' },
      { kind: 'expense', cssVar: '--pulpe-financial-expense' },
      { kind: 'saving', cssVar: '--pulpe-financial-savings' },
    ];

    for (const { kind, cssVar } of kindColorCases) {
      it(`should apply ${cssVar} background for kind=${kind}`, () => {
        setTestInput(component.kind, kind);
        fixture.detectChanges();

        const indicator: HTMLElement =
          fixture.nativeElement.querySelector('div');
        expect(indicator.style.backgroundColor).toContain(`var(${cssVar})`);
      });
    }
  });

  describe('Size input', () => {
    it('should apply custom size to width and height', () => {
      setTestInput(component.kind, 'income' as TransactionKind);
      setTestInput(component.size, 24);
      fixture.detectChanges();

      const indicator: HTMLElement = fixture.nativeElement.querySelector('div');
      expect(indicator.style.width).toBe('24px');
      expect(indicator.style.height).toBe('24px');
    });

    it('should apply default size 12px when size is not provided', () => {
      setTestInput(component.kind, 'expense' as TransactionKind);
      fixture.detectChanges();

      const indicator: HTMLElement = fixture.nativeElement.querySelector('div');
      expect(indicator.style.width).toBe('12px');
      expect(indicator.style.height).toBe('12px');
    });
  });
});
