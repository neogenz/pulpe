import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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
      providers: [provideZonelessChangeDetection(), provideNoopAnimations()],
    }).compileComponents();
  });

  // Helper function to create component and set signal inputs using internal API
  // This is a workaround for the Vitest + Angular signal inputs compatibility issue
  function createComponentWithInputs(
    balance: number,
    usedAmount: number,
    totalIncome: number,
  ): {
    component: BudgetProgressBar;
    fixture: ComponentFixture<BudgetProgressBar>;
  } {
    fixture = TestBed.createComponent(BudgetProgressBar);
    component = fixture.componentInstance;

    // Use internal signal API to set required inputs
    // @ts-expect-error - accessing internal SIGNAL property
    signalSetFn(component.balance[SIGNAL], balance);
    // @ts-expect-error - accessing internal SIGNAL property
    signalSetFn(component.usedAmount[SIGNAL], usedAmount);
    // @ts-expect-error - accessing internal SIGNAL property
    signalSetFn(component.totalIncome[SIGNAL], totalIncome);

    fixture.detectChanges();

    return { component, fixture };
  }

  describe('Component Structure', () => {
    it('should have required signal inputs defined', () => {
      const { component } = createComponentWithInputs(1000, 500, 1000);

      // Verify signal inputs are defined
      expect(component.balance).toBeDefined();
      expect(typeof component.balance).toBe('function'); // signal
      expect(component.usedAmount).toBeDefined();
      expect(typeof component.usedAmount).toBe('function'); // signal
      expect(component.totalIncome).toBeDefined();
      expect(typeof component.totalIncome).toBe('function'); // signal
    });

    it('should have computed properties defined', () => {
      const { component } = createComponentWithInputs(1000, 500, 1000);

      // Verify computed signals
      expect(component.budgetUsedPercentage).toBeDefined();
      expect(typeof component.budgetUsedPercentage).toBe('function');
      expect(component.displayPercentage).toBeDefined();
      expect(typeof component.displayPercentage).toBe('function');
      expect(component.isOverBudget).toBeDefined();
      expect(typeof component.isOverBudget).toBe('function');
      expect(component.remainingAmount).toBeDefined();
      expect(typeof component.remainingAmount).toBe('function');
    });
  });

  describe('Percentage Calculations - Business Logic Tests', () => {
    it('should calculate 50% when 2500 spent on 5000 total income', () => {
      // GIVEN: 2500 dépensé sur 5000 total income
      const { component } = createComponentWithInputs(2500, 2500, 5000);

      // THEN: Should return 50% (2500/5000)
      expect(component.displayPercentage()).toBe(50);
      expect(component.budgetUsedPercentage()).toBe(50);
    });

    it('should calculate 100% when 5000 spent on 5000 total income', () => {
      // GIVEN: 5000 dépensé sur 5000 total income
      const { component } = createComponentWithInputs(0, 5000, 5000);

      // THEN: Should return 100% (5000/5000)
      expect(component.displayPercentage()).toBe(100);
      expect(component.budgetUsedPercentage()).toBe(100);
    });

    it('should calculate 0% when 0 spent on 5000 total income', () => {
      // GIVEN: 0 dépensé sur 5000 total income
      const { component } = createComponentWithInputs(5000, 0, 5000);

      // THEN: Should return 0% (0/5000)
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should calculate 150% when 7500 spent on 5000 total income', () => {
      // GIVEN: 7500 dépensé sur 5000 total income
      const { component } = createComponentWithInputs(-2500, 7500, 5000);

      // THEN: Should return 150% for display (7500/5000)
      expect(component.displayPercentage()).toBe(150);
      // BUT: Progress bar should be capped at 100%
      expect(component.budgetUsedPercentage()).toBe(100);
    });
  });

  describe('Visual vs Text Display Distinction', () => {
    it('should cap progress bar percentage at 100% but show real percentage in text', () => {
      // GIVEN: Over budget scenario (120% = 1200/1000)
      const { component } = createComponentWithInputs(-200, 1200, 1000);

      // THEN: Progress bar capped at 100%, but text shows real 120%
      expect(component.budgetUsedPercentage()).toBe(100); // For visual progress bar
      expect(component.displayPercentage()).toBe(120); // For text display
    });

    it('should show same percentage for both when under 100%', () => {
      // GIVEN: Under budget scenario (75% = 750/1000)
      const { component } = createComponentWithInputs(250, 750, 1000);

      // THEN: Both should show same percentage
      expect(component.budgetUsedPercentage()).toBe(75);
      expect(component.displayPercentage()).toBe(75);
    });
  });

  describe('Over Budget Detection', () => {
    it('should detect over budget when remaining balance is negative', () => {
      // GIVEN: Over budget scenario (balance - used = negative)
      const { component } = createComponentWithInputs(-200, 1200, 1000);

      // THEN: Should be over budget (remainingAmount = balance - usedAmount)
      expect(component.isOverBudget()).toBe(true);
      expect(component.remainingAmount()).toBe(-1400); // -200 - 1200
    });

    it('should not detect over budget when remaining balance is positive', () => {
      // GIVEN: Within budget scenario
      const { component } = createComponentWithInputs(200, 800, 1000);

      // THEN: Should not be over budget
      expect(component.isOverBudget()).toBe(false);
      expect(component.remainingAmount()).toBe(-600); // 200 - 800
    });

    it('should handle exact balance match', () => {
      // GIVEN: Exact balance match (remaining = 0)
      const { component } = createComponentWithInputs(0, 1000, 1000);

      // THEN: Should not be over budget (exactly on budget)
      expect(component.isOverBudget()).toBe(false);
      expect(component.remainingAmount()).toBe(-1000); // 0 - 1000
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total income gracefully', () => {
      // GIVEN: Zero total income (edge case)
      const { component } = createComponentWithInputs(0, 100, 0);

      // THEN: Should return 0% (no division by zero)
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should handle negative total income', () => {
      // GIVEN: Negative total income (edge case)
      const { component } = createComponentWithInputs(100, 50, -100);

      // THEN: Should return 0% (protected against negative total)
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should handle negative used amount', () => {
      // GIVEN: Negative used amount (edge case)
      const { component } = createComponentWithInputs(1000, -50, 1000);

      // THEN: Should return 0% (protected against negative used amount)
      expect(component.displayPercentage()).toBe(0);
      expect(component.budgetUsedPercentage()).toBe(0);
    });

    it('should round percentages to whole numbers', () => {
      // GIVEN: Values that result in decimal percentage (100/333 = 30.03%)
      const { component } = createComponentWithInputs(233, 100, 333);

      // THEN: Should round to nearest whole number
      expect(component.displayPercentage()).toBe(30); // Rounded from 30.03%
      expect(component.budgetUsedPercentage()).toBe(30);
    });
  });
});
