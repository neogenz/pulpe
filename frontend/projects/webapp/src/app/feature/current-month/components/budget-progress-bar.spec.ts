import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MonthBudgetProgress } from './budget-progress-bar';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerLocaleData } from '@angular/common';
import { setTestInput } from '../../../testing/signal-test-utils';
import localeDE from '@angular/common/locales/de-CH';

// Register locale data for Swiss German
registerLocaleData(localeDE);

describe('MonthBudgetProgress', () => {
  let component: MonthBudgetProgress;
  let fixture: ComponentFixture<MonthBudgetProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthBudgetProgress],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  function createComponentWithInputs(
    expenses: number,
    available: number,
  ): {
    component: MonthBudgetProgress;
    fixture: ComponentFixture<MonthBudgetProgress>;
  } {
    fixture = TestBed.createComponent(MonthBudgetProgress);
    component = fixture.componentInstance;

    setTestInput(component.expenses, expenses);
    setTestInput(component.available, available);

    fixture.detectChanges();

    return { component, fixture };
  }

  describe('Percentage Calculations', () => {
    it('should calculate 50% when 2500 spent on 5000 available', () => {
      // GIVEN: expenses=2500, available=5000, remaining=2500
      // Formula: 2500 / 5000 = 50%
      const { component } = createComponentWithInputs(2500, 5000);

      // THEN: Should return 50%
      expect(component.displayPercentage()).toBe(50);
      expect(component.budgetUsedPercentage()).toBe(50);
    });

    it('should calculate 100% when 5000 spent on 5000 available', () => {
      // GIVEN: expenses=5000, available=5000, remaining=0 (budget épuisé)
      // Formula: 5000 / 5000 = 100%
      const { component } = createComponentWithInputs(5000, 5000);

      // THEN: Should return 100%
      expect(component.displayPercentage()).toBe(100);
      expect(component.budgetUsedPercentage()).toBe(100);
    });

    it('should calculate 0% when 0 spent on 5000 available', () => {
      // GIVEN: expenses=0, available=5000, remaining=5000 (rien dépensé)
      // Formula: 0 / 5000 = 0%
      const { component } = createComponentWithInputs(0, 5000);

      // THEN: Should return 0%
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should calculate 150% when 7500 spent on 5000 available', () => {
      // GIVEN: expenses=7500, available=5000, remaining=-2500 (dépassement)
      // Formula: 7500 / 5000 = 150%
      const { component } = createComponentWithInputs(7500, 5000);

      // THEN: Should return 150% for display
      expect(component.displayPercentage()).toBe(150);
      // BUT: Progress bar should be capped at 100%
      expect(component.budgetUsedPercentage()).toBe(100);
    });
  });

  describe('Visual vs Text Display Distinction', () => {
    it('should cap progress bar percentage at 100% but show real percentage in text', () => {
      // GIVEN: Over budget scenario
      // Formula: 1200 / 1000 = 120%
      const { component } = createComponentWithInputs(1200, 1000);

      // THEN: Progress bar capped at 100%, but text shows real 120%
      expect(component.budgetUsedPercentage()).toBe(100); // For visual progress bar
      expect(component.displayPercentage()).toBe(120); // For text display
    });

    it('should show same percentage for both when under 100%', () => {
      // GIVEN: Under budget scenario
      // Formula: 750 / 1000 = 75%
      const { component } = createComponentWithInputs(750, 1000);

      // THEN: Both should show same percentage
      expect(component.budgetUsedPercentage()).toBe(75);
      expect(component.displayPercentage()).toBe(75);
    });
  });

  describe('Over Budget Detection', () => {
    it('should detect over budget when remaining is negative', () => {
      // GIVEN: expenses=1200, available=1000, remaining=-200 (dépassement)
      const { component } = createComponentWithInputs(1200, 1000);

      // THEN: Should be over budget (remaining < 0)
      expect(component.isOverBudget()).toBe(true);
    });

    it('should not detect over budget when remaining is positive', () => {
      // GIVEN: expenses=800, available=1000, remaining=200 (dans le budget)
      const { component } = createComponentWithInputs(800, 1000);

      // THEN: Should not be over budget
      expect(component.isOverBudget()).toBe(false);
    });

    it('should handle exact budget match', () => {
      // GIVEN: expenses=1000, available=1000, remaining=0 (exactement à l'équilibre)
      const { component } = createComponentWithInputs(1000, 1000);

      // THEN: Should not be over budget (exactly on budget)
      expect(component.isOverBudget()).toBe(false);
    });
  });

  describe('CSS Class Application for Styling', () => {
    it('should apply over-budget class to progress bar when over budget', () => {
      // GIVEN: Over budget scenario
      const { fixture } = createComponentWithInputs(1200, 1000);

      // WHEN: Component is rendered
      const progressBar =
        fixture.nativeElement.querySelector('mat-progress-bar');

      // THEN: Should have over-budget class
      expect(progressBar.classList.contains('over-budget')).toBe(true);
    });

    it('should not apply over-budget class to progress bar when under budget', () => {
      // GIVEN: Under budget scenario
      const { fixture } = createComponentWithInputs(800, 1000);

      // WHEN: Component is rendered
      const progressBar =
        fixture.nativeElement.querySelector('mat-progress-bar');

      // THEN: Should not have over-budget class
      expect(progressBar.classList.contains('over-budget')).toBe(false);
    });

    it('should not apply over-budget class when exactly on budget', () => {
      // GIVEN: Exactly on budget (remaining = 0)
      const { fixture } = createComponentWithInputs(1000, 1000);

      // WHEN: Component is rendered
      const progressBar =
        fixture.nativeElement.querySelector('mat-progress-bar');

      // THEN: Should not have over-budget class
      expect(progressBar.classList.contains('over-budget')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero available with expenses gracefully', () => {
      // GIVEN: available=0 with expenses=100 (edge case - no budget but spending)
      const { component } = createComponentWithInputs(100, 0);

      // THEN: Should return -1 for display (special case) and 100% for progress bar
      expect(component.displayPercentage()).toBe(-1); // Special case indicator
      expect(component.budgetUsedPercentage()).toBe(100); // Progress bar at 100%
    });

    it('should handle zero available without expenses', () => {
      // GIVEN: available=0 with expenses=0 (edge case - no budget, no spending)
      const { component } = createComponentWithInputs(0, 0);

      // THEN: Should return 0% for both
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should handle negative available with expenses', () => {
      // GIVEN: available=-100 with expenses=50 (edge case - rollover négatif important)
      const { component } = createComponentWithInputs(50, -100);

      // THEN: Should return -1 for display (special case) and 100% for progress bar
      expect(component.displayPercentage()).toBe(-1); // Special case indicator
      expect(component.budgetUsedPercentage()).toBe(100); // Progress bar at 100%
    });

    it('should handle negative available without expenses', () => {
      // GIVEN: available=-100 with expenses=0 (edge case - negative rollover, no spending)
      const { component } = createComponentWithInputs(0, -100);

      // THEN: Should return 0% for both
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should handle the specific case from user: 1524 expenses with 0 available', () => {
      // GIVEN: The exact case from user - expenses=1524, available=0, remaining=-1524
      const { component } = createComponentWithInputs(1524, 0);

      // THEN: Should return -1 for display (special case) and 100% for progress bar
      expect(component.displayPercentage()).toBe(-1); // Special case: "Budget totalement dépassé"
      expect(component.budgetUsedPercentage()).toBe(100); // Progress bar at 100%
      expect(component.isOverBudget()).toBe(true); // Over budget status
    });

    it('should handle negative expenses', () => {
      // GIVEN: expenses=-50 (edge case)
      const { component } = createComponentWithInputs(-50, 1000);

      // THEN: Should handle gracefully (negative expenses unlikely but possible)
      const percentage = Math.round((-50 / 1000) * 100);
      expect(component.displayPercentage()).toBe(percentage); // -5%
      expect(component.budgetUsedPercentage()).toBe(0); // Visual bar capped at 0
    });

    it('should round percentages to whole numbers', () => {
      // GIVEN: Values that result in decimal percentage
      // Formula: 100 / 333 = 30.03%
      const { component } = createComponentWithInputs(100, 333);

      // THEN: Should round to nearest whole number
      expect(component.displayPercentage()).toBe(30); // Rounded from 30.03%
      expect(component.budgetUsedPercentage()).toBe(30);
    });
  });
});
