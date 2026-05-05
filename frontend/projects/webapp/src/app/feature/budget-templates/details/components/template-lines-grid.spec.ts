import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import type { TemplateLine, TransactionKind } from 'pulpe-shared';
import { TemplateLinesGrid } from './template-lines-grid';

const makeLine = (
  id: string,
  kind: TransactionKind,
  name: string,
  amount: number,
): TemplateLine => ({
  id,
  templateId: 'template-1',
  name,
  amount,
  kind,
  recurrence: 'fixed',
  description: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('TemplateLinesGrid', () => {
  let fixture: ComponentFixture<TemplateLinesGrid>;
  let component: TemplateLinesGrid;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateLinesGrid],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateLinesGrid);
    component = fixture.componentInstance;
  });

  describe('Component Structure', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should default currency to CHF', () => {
      expect(component.currency()).toBe('CHF');
    });
  });

  describe('groupedLines', () => {
    it('should return empty array when lines is empty', () => {
      setTestInput(component.lines, []);
      expect(component['groupedLines']()).toEqual([]);
    });

    it('should group lines by kind and filter empty groups', () => {
      const lines: TemplateLine[] = [
        makeLine('1', 'income', 'Salaire', 5000),
        makeLine('2', 'expense', 'Loyer', 1500),
        makeLine('3', 'expense', 'Courses', 400),
      ];
      setTestInput(component.lines, lines);

      const groups = component['groupedLines']();

      expect(groups).toHaveLength(2);
      expect(groups.find((g) => g.kind === 'income')?.lines).toHaveLength(1);
      expect(groups.find((g) => g.kind === 'expense')?.lines).toHaveLength(2);
      expect(groups.find((g) => g.kind === 'saving')).toBeUndefined();
    });

    it('should produce 3 groups when every kind has lines', () => {
      const lines: TemplateLine[] = [
        makeLine('1', 'income', 'Salaire', 5000),
        makeLine('2', 'expense', 'Loyer', 1500),
        makeLine('3', 'saving', '3ème pilier', 500),
      ];
      setTestInput(component.lines, lines);

      const groups = component['groupedLines']();

      expect(groups).toHaveLength(3);
      expect(groups.map((g) => g.kind)).toEqual([
        'income',
        'saving',
        'expense',
      ]);
    });

    it('should order groups as [income, saving, expense]', () => {
      const lines: TemplateLine[] = [
        makeLine('1', 'expense', 'Loyer', 1500),
        makeLine('2', 'saving', '3ème pilier', 500),
        makeLine('3', 'income', 'Salaire', 5000),
      ];
      setTestInput(component.lines, lines);

      const groups = component['groupedLines']();

      expect(groups.map((g) => g.kind)).toEqual([
        'income',
        'saving',
        'expense',
      ]);
    });

    it('should use correct icon and labelKey per kind', () => {
      const lines: TemplateLine[] = [
        makeLine('1', 'income', 'Salaire', 5000),
        makeLine('2', 'expense', 'Loyer', 1500),
        makeLine('3', 'saving', '3ème pilier', 500),
      ];
      setTestInput(component.lines, lines);

      const groups = component['groupedLines']();

      expect(groups.find((g) => g.kind === 'income')?.icon).toBe('trending_up');
      expect(groups.find((g) => g.kind === 'saving')?.icon).toBe('savings');
      expect(groups.find((g) => g.kind === 'expense')?.icon).toBe(
        'trending_down',
      );

      expect(groups.find((g) => g.kind === 'income')?.labelKey).toBe(
        'template.incomeGroupLabel',
      );
      expect(groups.find((g) => g.kind === 'saving')?.labelKey).toBe(
        'template.savingsGroupLabel',
      );
      expect(groups.find((g) => g.kind === 'expense')?.labelKey).toBe(
        'template.expensesGroupLabel',
      );
    });
  });

  describe('Outputs', () => {
    it('should emit add event on add.emit', () => {
      const spy = vi.fn();
      component.add.subscribe(spy);

      component.add.emit();

      expect(spy).toHaveBeenCalledOnce();
    });

    it('should emit edit event with line on edit.emit', () => {
      const line = makeLine('1', 'income', 'Salaire', 5000);
      const spy = vi.fn();
      component.edit.subscribe(spy);

      component.edit.emit(line);

      expect(spy).toHaveBeenCalledWith(line);
    });

    it('should emit delete event with id on delete.emit', () => {
      const spy = vi.fn();
      component.delete.subscribe(spy);

      component.delete.emit('line-42');

      expect(spy).toHaveBeenCalledWith('line-42');
    });
  });
});
