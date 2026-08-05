import { inject, Service } from '@angular/core';
import type { Cell, Row } from 'write-excel-file/browser';
import type {
  SupportedCurrency,
  BudgetExportResponse,
  BudgetLine,
  BudgetWithDetails,
  Transaction,
  TransactionKind,
  TransactionRecurrence,
} from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { TagStore } from '@core/tag';
import { type ExcelSheet } from '@core/file-download';

const KIND_LABELS: Record<TransactionKind, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  saving: 'Épargne',
};

const RECURRENCE_LABELS: Record<TransactionRecurrence, string> = {
  fixed: 'Récurrent',
  one_off: 'Prévu',
};

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const CURRENCY_EXCEL_FORMATS: Record<SupportedCurrency, string> = {
  CHF: '"CHF" #,##0.00',
  EUR: '"€" #,##0.00',
};

const COLUMN_WIDTHS = [
  { width: 25 },
  { width: 15 },
  { width: 12 },
  { width: 12 },
  { width: 15 },
];

@Service()
export class ExcelExportService {
  readonly #userSettings = inject(UserSettingsStore);
  readonly #tagStore = inject(TagStore);

  get #currencyFormat(): string {
    return CURRENCY_EXCEL_FORMATS[this.#userSettings.currency()];
  }

  async buildSheets(response: BudgetExportResponse): Promise<ExcelSheet[]> {
    await this.#tagStore.ensureLoaded();
    const budgets = response.data?.budgets ?? [];

    return budgets.map((budget) => ({
      sheet: this.#formatSheetName(budget.month, budget.year),
      columns: COLUMN_WIDTHS,
      data: this.#buildSheetData(budget),
    }));
  }

  #formatSheetName(month: number, year: number): string {
    const paddedMonth = month.toString().padStart(2, '0');
    return `${paddedMonth}-${year}`;
  }

  #buildSheetData(budget: BudgetWithDetails): Row[] {
    const rows: Row[] = [];

    const monthName = MONTH_NAMES[budget.month - 1] ?? `Mois ${budget.month}`;
    rows.push([`BUDGET ${monthName.toUpperCase()} ${budget.year}`]);
    rows.push([]);
    rows.push(['Report', this.#currencyCell(budget.rollover)]);
    rows.push(['Reste', this.#currencyCell(budget.remaining)]);
    rows.push(['Solde final', this.#currencyCell(budget.endingBalance ?? 0)]);
    rows.push([]);

    rows.push(['PRÉVISIONS']);
    rows.push(['Nom', 'Montant', 'Type', 'Récurrence']);

    const budgetLines = budget.budgetLines ?? [];
    const budgetLinesStartRow = rows.length + 1;
    for (const line of budgetLines) {
      rows.push(this.#formatBudgetLine(line));
    }
    const budgetLinesEndRow = rows.length;

    if (budgetLines.length > 0) {
      rows.push([
        'Total prévisions',
        this.#formulaCell(`SUM(B${budgetLinesStartRow}:B${budgetLinesEndRow})`),
      ]);
    }

    rows.push([]);
    rows.push(['TRANSACTIONS']);
    rows.push(['Date', 'Nom', 'Montant', 'Type', 'Tags']);

    const transactions = budget.transactions ?? [];
    const transactionsStartRow = rows.length + 1;
    for (const transaction of transactions) {
      rows.push(this.#formatTransaction(transaction));
    }
    const transactionsEndRow = rows.length;

    if (transactions.length > 0) {
      rows.push([
        '',
        'Total transactions',
        this.#formulaCell(
          `SUM(C${transactionsStartRow}:C${transactionsEndRow})`,
        ),
      ]);
    }

    return rows;
  }

  #formatBudgetLine(line: BudgetLine): Row {
    return [
      this.#escapeFormulaInjection(line.name ?? ''),
      this.#currencyCell(line.amount),
      KIND_LABELS[line.kind] ?? line.kind,
      RECURRENCE_LABELS[line.recurrence] ?? line.recurrence,
    ];
  }

  #formatTransaction(transaction: Transaction): Row {
    return [
      this.#formatDate(transaction.transactionDate),
      this.#escapeFormulaInjection(transaction.name ?? ''),
      this.#currencyCell(transaction.amount),
      KIND_LABELS[transaction.kind] ?? transaction.kind,
      this.#escapeFormulaInjection(this.#formatTags(transaction.tagIds)),
    ];
  }

  #formatTags(tagIds: readonly string[] | undefined): string {
    if (!tagIds?.length) return '';
    const tagNameById = this.#tagStore.tagNameById();
    return tagIds
      .map((id) => tagNameById.get(id))
      .filter((name): name is string => !!name)
      .join(', ');
  }

  #currencyCell(amount: number): Cell {
    return { type: Number, value: amount, format: this.#currencyFormat };
  }

  // No leading `=`: the library writes the string straight into the `<f>` tag.
  #formulaCell(formula: string): Cell {
    return { type: 'Formula', value: formula, format: this.#currencyFormat };
  }

  #formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  #escapeFormulaInjection(value: string): string {
    const formulaChars = ['=', '+', '-', '@'];
    const trimmed = value.trimStart();
    if (formulaChars.some((char) => trimmed.startsWith(char))) {
      return `'${value}`;
    }
    return value;
  }
}
