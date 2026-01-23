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

  #buildSheetData(budget: BudgetWithDetails): (string | number)[][] {
    const rows: (string | number)[][] = [];

    const monthName = MONTH_NAMES[budget.month - 1] ?? `Mois ${budget.month}`;
    rows.push([`BUDGET ${monthName.toUpperCase()} ${budget.year}`]);
    rows.push([]);
    rows.push(['Report', this.#formatCurrency(budget.rollover)]);
    rows.push(['Reste', this.#formatCurrency(budget.remaining)]);
    rows.push(['Solde final', this.#formatCurrency(budget.endingBalance ?? 0)]);
    rows.push([]);

    rows.push(['PRÉVISIONS']);
    rows.push(['Nom', 'Montant', 'Type', 'Récurrence']);

    for (const line of budget.budgetLines ?? []) {
      rows.push(this.#formatBudgetLine(line));
    }

    rows.push([]);
    rows.push(['TRANSACTIONS']);
    rows.push(['Date', 'Nom', 'Montant', 'Type', 'Catégorie']);

    for (const transaction of budget.transactions ?? []) {
      rows.push(this.#formatTransaction(transaction));
    }

    return rows;
  }

  #formatBudgetLine(line: BudgetLine): (string | number)[] {
    return [
      this.#escapeFormulaInjection(line.name ?? ''),
      this.#formatCurrency(line.amount),
      KIND_LABELS[line.kind] ?? line.kind,
      RECURRENCE_LABELS[line.recurrence] ?? line.recurrence,
    ];
  }

  #formatTransaction(transaction: Transaction): (string | number)[] {
    return [
      this.#formatDate(transaction.transactionDate),
      this.#escapeFormulaInjection(transaction.name ?? ''),
      this.#formatCurrency(transaction.amount),
      KIND_LABELS[transaction.kind] ?? transaction.kind,
      this.#escapeFormulaInjection(transaction.category ?? ''),
    ];
  }

  #formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(amount);
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
    if (formulaChars.some((char) => value.startsWith(char))) {
      return `'${value}`;
    }
    return value;
  }
}
