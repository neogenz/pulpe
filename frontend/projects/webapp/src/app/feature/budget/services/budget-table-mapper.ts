import { Injectable, inject } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { BudgetCalculator } from '@core/budget/budget-calculator';

/**
 * View model for budget items display with all computed properties
 */
export interface BudgetItemViewModel {
  id: string;
  name: string;
  amount: number;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  itemType: 'budget_line' | 'transaction';
  kindIcon: string;
  kindLabel: string;
  kindIconClass: string;
  amountClass: string;
  recurrenceLabel: string;
  recurrenceChipClass: string;
  cumulativeBalance: number;
  cumulativeBalanceClass: string;
}

/**
 * Section header for grouping items in the table
 */
export interface SectionHeaderRow {
  type: 'section_header';
  id: string;
  title: string;
}

/**
 * Data row containing the budget item view model
 */
export interface DataRow extends BudgetItemViewModel {
  type: 'data_row';
  isEditing: boolean;
  isLoading: boolean;
  isRollover: boolean;
}

/**
 * Union type for all possible table rows
 */
export type TableRow = SectionHeaderRow | DataRow;

/**
 * Complete view model for the budget table
 */
export interface BudgetTableViewModel {
  rows: TableRow[];
  hasOneOffItems: boolean;
  hasTransactions: boolean;
  isEmpty: boolean;
}

/**
 * Service that organizes budget data for table display.
 * Handles all presentation logic including grouping, sorting, and view model transformation.
 */
@Injectable()
export class BudgetTableMapper {
  readonly #budgetCalculator = inject(BudgetCalculator);

  // Display configuration constants
  readonly #KIND_ICONS: Record<TransactionKind, string> = {
    income: 'trending_up',
    expense: 'trending_down',
    saving: 'savings',
  };

  readonly #KIND_LABELS: Record<TransactionKind, string> = {
    income: 'Revenu',
    expense: 'Dépense',
    saving: 'Épargne',
  };

  readonly #KIND_ICON_CLASSES: Record<TransactionKind, string> = {
    income: 'text-financial-income',
    expense: 'text-financial-negative',
    saving: 'text-primary',
  };

  readonly #AMOUNT_CLASSES: Record<TransactionKind, string> = {
    income: 'text-financial-income',
    expense: 'text-financial-negative',
    saving: 'text-primary',
  };

  readonly #RECURRENCE_LABELS: Record<TransactionRecurrence, string> = {
    fixed: 'Tous les mois',
    variable: 'Variable',
    one_off: 'Une seule fois',
  };

  readonly #RECURRENCE_CHIP_CLASSES: Record<TransactionRecurrence, string> = {
    fixed: 'bg-primary-container text-on-primary-container',
    variable: 'bg-tertiary-container text-on-tertiary-container',
    one_off: 'bg-secondary-container text-on-secondary-container',
  };

  /**
   * Prepares complete budget table data for view consumption
   */
  prepareBudgetTableData(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    operationsInProgress: Set<string>,
    editingLineId: string | null,
  ): BudgetTableViewModel {
    // Get sorted items with cumulative balance from calculator
    const itemsWithBalance =
      this.#budgetCalculator.composeBudgetItemsWithBalanceGrouped(
        budgetLines,
        transactions,
      );

    // Transform to view models and group by type
    const { fixedBudgetLineRows, oneOffBudgetLineRows, transactionRows } =
      this.#groupItemsByType(
        itemsWithBalance,
        operationsInProgress,
        editingLineId,
      );

    // Build final table rows with section headers
    const rows = this.#buildTableRows(
      fixedBudgetLineRows,
      oneOffBudgetLineRows,
      transactionRows,
    );

    return {
      rows,
      hasOneOffItems: oneOffBudgetLineRows.length > 0,
      hasTransactions: transactionRows.length > 0,
      isEmpty: rows.length === 0,
    };
  }

  /**
   * Groups items by type and recurrence, converting to view models
   */
  #groupItemsByType(
    itemsWithBalance: ReturnType<
      BudgetCalculator['composeBudgetItemsWithBalanceGrouped']
    >,
    operationsInProgress: Set<string>,
    editingLineId: string | null,
  ): {
    fixedBudgetLineRows: DataRow[];
    oneOffBudgetLineRows: DataRow[];
    transactionRows: DataRow[];
  } {
    const fixedBudgetLineRows: DataRow[] = [];
    const oneOffBudgetLineRows: DataRow[] = [];
    const transactionRows: DataRow[] = [];

    itemsWithBalance.forEach((itemDisplay) => {
      const item = itemDisplay.item;
      const recurrence: TransactionRecurrence =
        'recurrence' in item ? item.recurrence : 'one_off';

      const dataRow = this.#createDataRow(
        item,
        itemDisplay,
        recurrence,
        operationsInProgress,
        editingLineId,
      );

      if (itemDisplay.itemType === 'budget_line') {
        if (recurrence === 'one_off') {
          oneOffBudgetLineRows.push(dataRow);
        } else {
          // fixed and variable are grouped together
          fixedBudgetLineRows.push(dataRow);
        }
      } else {
        transactionRows.push(dataRow);
      }
    });

    return { fixedBudgetLineRows, oneOffBudgetLineRows, transactionRows };
  }

  /**
   * Creates a data row view model from a budget item
   */
  #createDataRow(
    item: BudgetLine | Transaction,
    itemDisplay: ReturnType<
      BudgetCalculator['composeBudgetItemsWithBalanceGrouped']
    >[0],
    recurrence: TransactionRecurrence,
    operationsInProgress: Set<string>,
    editingLineId: string | null,
  ): DataRow {
    const isRollover = item.id.startsWith('rollover-');

    return {
      type: 'data_row',
      id: item.id,
      name: item.name,
      amount: item.amount,
      kind: item.kind as TransactionKind,
      recurrence,
      itemType: itemDisplay.itemType,
      kindIcon: this.#KIND_ICONS[item.kind as TransactionKind],
      kindLabel: this.#KIND_LABELS[item.kind as TransactionKind],
      kindIconClass: this.#KIND_ICON_CLASSES[item.kind as TransactionKind],
      amountClass: this.#AMOUNT_CLASSES[item.kind as TransactionKind],
      recurrenceLabel: this.#RECURRENCE_LABELS[recurrence],
      recurrenceChipClass: this.#RECURRENCE_CHIP_CLASSES[recurrence],
      isEditing:
        itemDisplay.itemType === 'budget_line' &&
        editingLineId === item.id &&
        !isRollover,
      isLoading: operationsInProgress.has(item.id),
      isRollover,
      cumulativeBalance: itemDisplay.cumulativeBalance,
      cumulativeBalanceClass:
        itemDisplay.cumulativeBalance >= 0
          ? 'text-financial-income'
          : 'text-financial-negative',
    };
  }

  /**
   * Builds the final table rows with section headers
   */
  #buildTableRows(
    fixedBudgetLineRows: DataRow[],
    oneOffBudgetLineRows: DataRow[],
    transactionRows: DataRow[],
  ): TableRow[] {
    const result: TableRow[] = [];

    // Separate rollover line from other fixed budget lines
    const rolloverLine = fixedBudgetLineRows.find((row) => row.isRollover);
    const nonRolloverFixedLines = fixedBudgetLineRows.filter(
      (row) => !row.isRollover,
    );

    // 1. Add "Tous les mois" budget lines (fixed + variable) excluding rollover
    result.push(...nonRolloverFixedLines);

    // 2. Add "Une seule fois" budget lines with header if they exist
    if (oneOffBudgetLineRows.length > 0) {
      result.push({
        type: 'section_header',
        id: 'one-off-header',
        title: 'Une seule fois',
      });

      // Separate rollover from regular one-off items
      const rolloverOneOff = oneOffBudgetLineRows.find((row) => row.isRollover);
      const nonRolloverOneOff = oneOffBudgetLineRows.filter(
        (row) => !row.isRollover,
      );

      result.push(...nonRolloverOneOff);

      // Add rollover if it's a one-off item
      if (rolloverOneOff) {
        result.push(rolloverOneOff);
      }
    }

    // 3. Add rollover line at the end of budget lines (if it's a fixed item)
    if (rolloverLine) {
      result.push(rolloverLine);
    }

    // 4. Add transactions with header if they exist
    if (transactionRows.length > 0) {
      result.push({
        type: 'section_header',
        id: 'transactions-header',
        title: 'Ajouté durant le mois',
      });
      result.push(...transactionRows);
    }

    return result;
  }

  /**
   * Calculates summary statistics for the budget
   */
  calculateBudgetSummary(budgetLines: BudgetLine[]): {
    fixedBlock: number;
    plannedIncome: number;
    livingAllowance: number;
  } {
    return {
      fixedBlock: this.#budgetCalculator.calculateFixedBlock(budgetLines),
      plannedIncome: this.#budgetCalculator.calculatePlannedIncome(budgetLines),
      livingAllowance:
        this.#budgetCalculator.calculateLivingAllowance(budgetLines),
    };
  }
}
