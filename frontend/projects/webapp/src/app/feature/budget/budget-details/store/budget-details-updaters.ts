import type { BudgetLine, Transaction } from 'pulpe-shared';
import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';

// Pure state updaters (Redux reducer pattern)
// Each function: (viewModel, ...args) => newViewModel

export function addBudgetLine(
  vm: BudgetDetailsViewModel,
  line: BudgetLine,
): BudgetDetailsViewModel {
  return { ...vm, budgetLines: [...vm.budgetLines, line] };
}

export function replaceBudgetLine(
  vm: BudgetDetailsViewModel,
  oldId: string,
  newLine: BudgetLine,
): BudgetDetailsViewModel {
  return {
    ...vm,
    budgetLines: vm.budgetLines.map((l) => (l.id === oldId ? newLine : l)),
  };
}

export function patchBudgetLine(
  vm: BudgetDetailsViewModel,
  data: Partial<BudgetLine> & { id: string },
): BudgetDetailsViewModel {
  return {
    ...vm,
    budgetLines: vm.budgetLines.map((l) =>
      l.id === data.id
        ? { ...l, ...data, updatedAt: new Date().toISOString() }
        : l,
    ),
  };
}

export function removeBudgetLine(
  vm: BudgetDetailsViewModel,
  id: string,
): BudgetDetailsViewModel {
  return { ...vm, budgetLines: vm.budgetLines.filter((l) => l.id !== id) };
}

export function addTransaction(
  vm: BudgetDetailsViewModel,
  tx: Transaction,
): BudgetDetailsViewModel {
  return { ...vm, transactions: [...(vm.transactions ?? []), tx] };
}

export function replaceTransaction(
  vm: BudgetDetailsViewModel,
  oldId: string,
  newTx: Transaction,
): BudgetDetailsViewModel {
  return {
    ...vm,
    transactions: (vm.transactions ?? []).map((t) =>
      t.id === oldId ? newTx : t,
    ),
  };
}

export function removeTransaction(
  vm: BudgetDetailsViewModel,
  id: string,
): BudgetDetailsViewModel {
  return {
    ...vm,
    transactions: vm.transactions?.filter((t) => t.id !== id) ?? [],
  };
}

export function applyToggleResult(
  vm: BudgetDetailsViewModel,
  result: {
    updatedBudgetLines: BudgetLine[];
    updatedTransactions: Transaction[];
  },
): BudgetDetailsViewModel {
  return {
    ...vm,
    budgetLines: result.updatedBudgetLines,
    transactions: result.updatedTransactions,
  };
}
