import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BudgetProgressBar } from './budget-progress-bar';
import { describe, it, expect, beforeEach } from 'vitest';
// Import the internal API for signal manipulation in tests
// This is a workaround for the signal inputs testing issue with Vitest
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals';

describe('BudgetProgressBar - TDD Approach', () => {
  let component: BudgetProgressBar;
  let fixture: ComponentFixture<BudgetProgressBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetProgressBar],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  // Helper function to create component and set signal inputs using internal API
  // This is a workaround for the Vitest + Angular signal inputs compatibility issue
  function createComponentWithInputs(
    expenses: number,
    available: number,
    remaining: number,
  ): {
    component: BudgetProgressBar;
    fixture: ComponentFixture<BudgetProgressBar>;
  } {
    fixture = TestBed.createComponent(BudgetProgressBar);
    component = fixture.componentInstance;

    // Use internal signal API to set required inputs - Because of missing input.required support in Vitest
    signalSetFn(component.expenses[SIGNAL], expenses);
    signalSetFn(component.available[SIGNAL], available);
    signalSetFn(component.remaining[SIGNAL], remaining);

    fixture.detectChanges();

    return { component, fixture };
  }

  describe('Percentage Calculations', () => {
    it('should calculate 50% when 2500 spent on 5000 available', () => {
      // GIVEN: expenses=2500, available=5000, remaining=2500
      // Formula: 2500 / 5000 = 50%
      const { component } = createComponentWithInputs(2500, 5000, 2500);

      // THEN: Should return 50%
      expect(component.displayPercentage()).toBe(50);
      expect(component.budgetUsedPercentage()).toBe(50);
    });

    it('should calculate 100% when 5000 spent on 5000 available', () => {
      // GIVEN: expenses=5000, available=5000, remaining=0 (budget épuisé)
      // Formula: 5000 / 5000 = 100%
      const { component } = createComponentWithInputs(5000, 5000, 0);

      // THEN: Should return 100%
      expect(component.displayPercentage()).toBe(100);
      expect(component.budgetUsedPercentage()).toBe(100);
    });

    it('should calculate 0% when 0 spent on 5000 available', () => {
      // GIVEN: expenses=0, available=5000, remaining=5000 (rien dépensé)
      // Formula: 0 / 5000 = 0%
      const { component } = createComponentWithInputs(0, 5000, 5000);

      // THEN: Should return 0%
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should calculate 150% when 7500 spent on 5000 available', () => {
      // GIVEN: expenses=7500, available=5000, remaining=-2500 (dépassement)
      // Formula: 7500 / 5000 = 150%
      const { component } = createComponentWithInputs(7500, 5000, -2500);

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
      const { component } = createComponentWithInputs(1200, 1000, -200);

      // THEN: Progress bar capped at 100%, but text shows real 120%
      expect(component.budgetUsedPercentage()).toBe(100); // For visual progress bar
      expect(component.displayPercentage()).toBe(120); // For text display
    });

    it('should show same percentage for both when under 100%', () => {
      // GIVEN: Under budget scenario
      // Formula: 750 / 1000 = 75%
      const { component } = createComponentWithInputs(750, 1000, 250);

      // THEN: Both should show same percentage
      expect(component.budgetUsedPercentage()).toBe(75);
      expect(component.displayPercentage()).toBe(75);
    });
  });

  describe('Over Budget Detection', () => {
    it('should detect over budget when remaining is negative', () => {
      // GIVEN: expenses=1200, available=1000, remaining=-200 (dépassement)
      const { component } = createComponentWithInputs(1200, 1000, -200);

      // THEN: Should be over budget (remaining < 0)
      expect(component.isOverBudget()).toBe(true);
    });

    it('should not detect over budget when remaining is positive', () => {
      // GIVEN: expenses=800, available=1000, remaining=200 (dans le budget)
      const { component } = createComponentWithInputs(800, 1000, 200);

      // THEN: Should not be over budget
      expect(component.isOverBudget()).toBe(false);
    });

    it('should handle exact budget match', () => {
      // GIVEN: expenses=1000, available=1000, remaining=0 (exactement à l'équilibre)
      const { component } = createComponentWithInputs(1000, 1000, 0);

      // THEN: Should not be over budget (exactly on budget)
      expect(component.isOverBudget()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero available gracefully', () => {
      // GIVEN: available=0 (edge case)
      const { component } = createComponentWithInputs(100, 0, -100);

      // THEN: Should return 0% (no division by zero)
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should handle negative available', () => {
      // GIVEN: available=-100 (edge case - rollover négatif important)
      const { component } = createComponentWithInputs(50, -100, -150);

      // THEN: Should return 0% (protected against negative available)
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should handle negative expenses', () => {
      // GIVEN: expenses=-50 (edge case)
      const { component } = createComponentWithInputs(-50, 1000, 1050);

      // THEN: Should handle gracefully (negative expenses unlikely but possible)
      const percentage = Math.round((-50 / 1000) * 100);
      expect(component.displayPercentage()).toBe(percentage); // -5%
      expect(component.budgetUsedPercentage()).toBe(0); // Visual bar capped at 0
    });

    it('should round percentages to whole numbers', () => {
      // GIVEN: Values that result in decimal percentage
      // Formula: 100 / 333 = 30.03%
      const { component } = createComponentWithInputs(100, 333, 233);

      // THEN: Should round to nearest whole number
      expect(component.displayPercentage()).toBe(30); // Rounded from 30.03%
      expect(component.budgetUsedPercentage()).toBe(30);
    });
  });
});
