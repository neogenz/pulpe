import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  Component,
  input,
  provideZonelessChangeDetection,
} from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import type { TemplateLine } from 'pulpe-shared';
import { FinancialLineCard } from '@pattern/financial-line-card';
import { TemplateLineCard } from './template-line-card';

@Component({
  selector: 'pulpe-financial-line-card',
  template: '<ng-content select="[footer]" />',
})
class StubFinancialLineCard {
  readonly kind = input();
  readonly name = input();
  readonly amount = input();
  readonly currency = input();
  readonly recurrence = input();
  readonly dataTestId = input();
}

const mockLine: TemplateLine = {
  id: 'line-1',
  templateId: 'template-1',
  savingsGoalId: null,
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
    })
      .overrideComponent(TemplateLineCard, {
        remove: { imports: [FinancialLineCard] },
        add: { imports: [StubFinancialLineCard] },
      })
      .compileComponents();

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

  describe('Savings goal affordance', () => {
    it('shows the current linked goal name with a savings icon', () => {
      setTestInput(component.line, {
        ...mockLine,
        savingsGoalId: 'goal-1',
      });
      setTestInput(component.linkedGoalName, 'Vacances');

      fixture.detectChanges();

      const affordance: HTMLElement | null =
        fixture.nativeElement.querySelector(
          '[data-testid="template-line-linked-goal-line-1"]',
        );
      expect(affordance?.textContent).toContain('Vacances');
      expect(affordance?.querySelector('mat-icon')?.textContent?.trim()).toBe(
        'savings',
      );
    });

    it('leaves an unlinked line unchanged', () => {
      setTestInput(component.line, mockLine);

      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="template-line-linked-goal-line-1"]',
        ),
      ).toBeNull();
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
