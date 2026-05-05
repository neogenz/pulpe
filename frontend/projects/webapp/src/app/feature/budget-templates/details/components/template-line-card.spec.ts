import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import type { TemplateLine } from 'pulpe-shared';
import { TemplateLineCard } from './template-line-card';

const mockLine: TemplateLine = {
  id: 'line-1',
  templateId: 'template-1',
  name: 'Loyer',
  amount: 1500,
  kind: 'expense',
  recurrence: 'fixed',
  description: 'Mensuel',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('TemplateLineCard', () => {
  let fixture: ComponentFixture<TemplateLineCard>;
  let component: TemplateLineCard;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateLineCard],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateLineCard);
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

  describe('Inputs', () => {
    it('should expose line input', () => {
      setTestInput(component.line, mockLine);
      expect(component.line()).toEqual(mockLine);
    });
  });

  describe('Outputs', () => {
    it('should emit edit event with the full line on edit.emit', () => {
      setTestInput(component.line, mockLine);

      const spy = vi.fn();
      component.edit.subscribe(spy);

      component.edit.emit(component.line());

      expect(spy).toHaveBeenCalledWith(mockLine);
    });

    it('should emit delete event with the line id on delete.emit', () => {
      setTestInput(component.line, mockLine);

      const spy = vi.fn();
      component.delete.subscribe(spy);

      component.delete.emit(component.line().id);

      expect(spy).toHaveBeenCalledWith(mockLine.id);
    });
  });
});
