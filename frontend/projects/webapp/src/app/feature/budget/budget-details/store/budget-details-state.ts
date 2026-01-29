import { type WritableSignal, signal } from '@angular/core';

export interface BudgetDetailsState {
  readonly budgetId: WritableSignal<string | null>;
  readonly errorMessage: WritableSignal<string | null>;
  readonly rolloverCheckedAt: WritableSignal<string | null>;
}

export function createInitialBudgetDetailsState(): BudgetDetailsState {
  return {
    budgetId: signal<string | null>(null),
    errorMessage: signal<string | null>(null),
    rolloverCheckedAt: signal<string | null>(new Date().toISOString()),
  };
}
