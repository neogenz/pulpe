import { inject, LOCALE_ID, Service } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
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

const KIND_KEYS: Record<TransactionKind, string> = {
  income: 'transactionKind.income',
  expense: 'transactionKind.expense',
  saving: 'transactionKind.saving',
};

const RECURRENCE_KEYS: Record<TransactionRecurrence, string> = {
  fixed: 'recurrence.fixed',
  one_off: 'recurrence.oneOff',
};

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
  readonly #transloco = inject(TranslocoService);
  readonly #localeId = inject(LOCALE_ID);

  get #currencyFormat(): string {
    return CURRENCY_EXCEL_FORMATS[this.#userSettings.currency()];
  }

  // The month name comes from CLDR rather than from the catalog: the twelve
  // names exist in every locale Angular already registers, and a downloaded
  // file that says "Janvier" inside a German app is the most visible leak
  // this service could ship.
  #monthName(month: number): string {
    const name = new Intl.DateTimeFormat(this.#localeId, {
      month: 'long',
    }).format(new Date(2000, month - 1, 1));
    return name.charAt(0).toUpperCase() + name.slice(1);
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

    const t = (key: string) => this.#transloco.translate(`export.${key}`);

    const monthName = this.#monthName(budget.month);
    rows.push([
      `${t('budgetTitle')} ${monthName.toUpperCase()} ${budget.year}`,
    ]);
    rows.push([]);
    rows.push([t('rollover'), this.#currencyCell(budget.rollover)]);
    rows.push([t('remaining'), this.#currencyCell(budget.remaining)]);
    rows.push([
      t('endingBalance'),
      this.#currencyCell(budget.endingBalance ?? 0),
    ]);
    rows.push([]);

    rows.push([t('budgetLinesTitle')]);
    rows.push([t('name'), t('amount'), t('type'), t('recurrence')]);

    const budgetLines = budget.budgetLines ?? [];
    const budgetLinesStartRow = rows.length + 1;
    for (const line of budgetLines) {
      rows.push(this.#formatBudgetLine(line));
    }
    const budgetLinesEndRow = rows.length;

    if (budgetLines.length > 0) {
      rows.push([
        t('budgetLinesTotal'),
        this.#formulaCell(`SUM(B${budgetLinesStartRow}:B${budgetLinesEndRow})`),
      ]);
    }

    rows.push([]);
    rows.push([t('transactionsTitle')]);
    rows.push([t('date'), t('name'), t('amount'), t('type'), t('tags')]);

    const transactions = budget.transactions ?? [];
    const transactionsStartRow = rows.length + 1;
    for (const transaction of transactions) {
      rows.push(this.#formatTransaction(transaction));
    }
    const transactionsEndRow = rows.length;

    if (transactions.length > 0) {
      rows.push([
        '',
        t('transactionsTotal'),
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
      this.#kindLabel(line.kind),
      this.#recurrenceLabel(line.recurrence),
    ];
  }

  #formatTransaction(transaction: Transaction): Row {
    return [
      this.#formatDate(transaction.transactionDate),
      this.#escapeFormulaInjection(transaction.name ?? ''),
      this.#currencyCell(transaction.amount),
      this.#kindLabel(transaction.kind),
      this.#escapeFormulaInjection(this.#formatTags(transaction.tagIds)),
    ];
  }

  #kindLabel(kind: TransactionKind): string {
    const key = KIND_KEYS[kind];
    return key ? this.#transloco.translate(key) : kind;
  }

  #recurrenceLabel(recurrence: TransactionRecurrence): string {
    const key = RECURRENCE_KEYS[recurrence];
    return key ? this.#transloco.translate(key) : recurrence;
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
