import { Injectable } from '@angular/core';
import { utils, type WorkBook } from 'xlsx';
import type {
  BudgetExportResponse,
  BudgetLine,
  BudgetWithDetails,
  Transaction,
  TransactionKind,
  TransactionRecurrence,
} from 'pulpe-shared';

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

const CHF_FORMAT = '"CHF" #,##0.00';

interface CurrencyCell {
  t: 'n';
  v: number;
  z: string;
}

interface FormulaCell {
  t: 'n';
  f: string;
  z: string;
}

type CellValue = string | number | CurrencyCell | FormulaCell;

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  buildWorkbook(response: BudgetExportResponse): WorkBook {
    const workbook = utils.book_new();
    const budgets = response.data?.budgets ?? [];

    for (const budget of budgets) {
      const sheetName = this.#formatSheetName(budget.month, budget.year);
      const sheetData = this.#buildSheetData(budget);
      const worksheet = utils.aoa_to_sheet(sheetData);

      worksheet['!cols'] = [
        { wch: 25 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
      ];

      utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    return workbook;
  }

  #formatSheetName(month: number, year: number): string {
    const paddedMonth = month.toString().padStart(2, '0');
    return `${paddedMonth}-${year}`;
  }

  #buildSheetData(budget: BudgetWithDetails): CellValue[][] {
    const rows: CellValue[][] = [];

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
    rows.push(['Date', 'Nom', 'Montant', 'Type', 'Catégorie']);

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

  #formatBudgetLine(line: BudgetLine): CellValue[] {
    return [
      this.#escapeFormulaInjection(line.name ?? ''),
      this.#currencyCell(line.amount),
      KIND_LABELS[line.kind] ?? line.kind,
      RECURRENCE_LABELS[line.recurrence] ?? line.recurrence,
    ];
  }

  #formatTransaction(transaction: Transaction): CellValue[] {
    return [
      this.#formatDate(transaction.transactionDate),
      this.#escapeFormulaInjection(transaction.name ?? ''),
      this.#currencyCell(transaction.amount),
      KIND_LABELS[transaction.kind] ?? transaction.kind,
      this.#escapeFormulaInjection(transaction.category ?? ''),
    ];
  }

  #currencyCell(amount: number): CurrencyCell {
    return { t: 'n', v: amount, z: CHF_FORMAT };
  }

  #formulaCell(formula: string): FormulaCell {
    return { t: 'n', f: formula, z: CHF_FORMAT };
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
