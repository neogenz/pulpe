import { type WritableSignal, signal } from '@angular/core';

export interface BudgetDetailsState {
  readonly budgetId: WritableSignal<string | null>;
}

export function createInitialBudgetDetailsState(): BudgetDetailsState {
  return {
    budgetId: signal<string | null>(null),
  };
}
