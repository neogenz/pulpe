import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { CurrencyPipe } from '@angular/common';
import { BudgetLineItem } from './budget-line-item';
import {
  type BudgetLine,
  type BudgetLineUpdate,
  type TransactionKind,
} from '@pulpe/shared';

interface GroupedBudgetLines {
  income: BudgetLine[];
  expenses: BudgetLine[];
  savings: BudgetLine[];
  incomeTotal: number;
  expensesTotal: number;
  savingsTotal: number;
}

@Component({
  selector: 'pulpe-budget-line-list',
  imports: [
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    CurrencyPipe,
    BudgetLineItem,
  ],
  template: `
    <div class="flex flex-col gap-6">
      <!-- Income Section -->
      <mat-card>
        <mat-card-header>
          <div mat-card-avatar>
            <div
              class="flex justify-center items-center size-11 bg-[color-primary-container] rounded-full"
            >
              <mat-icon class="text-[color-on-primary-container]">
                trending_up
              </mat-icon>
            </div>
          </div>
          <mat-card-title>Revenus</mat-card-title>
          <mat-card-subtitle>
            Total: {{ groupedLines().incomeTotal | currency: 'CHF' }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (groupedLines().income.length === 0) {
            <p class="text-body-medium text-[color-on-surface-variant] py-4">
              Aucun revenu défini
            </p>
          } @else {
            <div class="flex flex-col">
              @for (line of groupedLines().income; track line.id) {
                <pulpe-budget-line-item
                  [budgetLine]="line"
                  (updateClicked)="handleUpdate(line.id, $event)"
                  (deleteClicked)="deleteClicked.emit(line.id)"
                />
                @if (!$last) {
                  <mat-divider />
                }
              }
            </div>
          }
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-stroked-button
            (click)="addClicked.emit('INCOME')"
            data-testid="add-income"
          >
            <mat-icon>add</mat-icon>
            Ajouter un revenu
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Expenses Section -->
      <mat-card>
        <mat-card-header>
          <div mat-card-avatar>
            <div
              class="flex justify-center items-center size-11 bg-[color-error-container] rounded-full"
            >
              <mat-icon class="text-[color-on-error-container]">
                trending_down
              </mat-icon>
            </div>
          </div>
          <mat-card-title>Dépenses fixes</mat-card-title>
          <mat-card-subtitle>
            Total: {{ groupedLines().expensesTotal | currency: 'CHF' }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (groupedLines().expenses.length === 0) {
            <p class="text-body-medium text-[color-on-surface-variant] py-4">
              Aucune dépense définie
            </p>
          } @else {
            <div class="flex flex-col">
              @for (line of groupedLines().expenses; track line.id) {
                <pulpe-budget-line-item
                  [budgetLine]="line"
                  (updateClicked)="handleUpdate(line.id, $event)"
                  (deleteClicked)="deleteClicked.emit(line.id)"
                />
                @if (!$last) {
                  <mat-divider />
                }
              }
            </div>
          }
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-stroked-button
            (click)="addClicked.emit('FIXED_EXPENSE')"
            data-testid="add-expense"
          >
            <mat-icon>add</mat-icon>
            Ajouter une dépense
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Savings Section -->
      <mat-card>
        <mat-card-header>
          <div mat-card-avatar>
            <div
              class="flex justify-center items-center size-11 bg-[color-secondary-container] rounded-full"
            >
              <mat-icon class="text-[color-on-secondary-container]">
                savings
              </mat-icon>
            </div>
          </div>
          <mat-card-title>Épargne</mat-card-title>
          <mat-card-subtitle>
            Total: {{ groupedLines().savingsTotal | currency: 'CHF' }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (groupedLines().savings.length === 0) {
            <p class="text-body-medium text-[color-on-surface-variant] py-4">
              Aucune épargne définie
            </p>
          } @else {
            <div class="flex flex-col">
              @for (line of groupedLines().savings; track line.id) {
                <pulpe-budget-line-item
                  [budgetLine]="line"
                  (updateClicked)="handleUpdate(line.id, $event)"
                  (deleteClicked)="deleteClicked.emit(line.id)"
                />
                @if (!$last) {
                  <mat-divider />
                }
              }
            </div>
          }
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-stroked-button
            (click)="addClicked.emit('SAVINGS_CONTRIBUTION')"
            data-testid="add-savings"
          >
            <mat-icon>add</mat-icon>
            Ajouter une épargne
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetLineList {
  budgetLines = input.required<BudgetLine[]>();
  updateClicked = output<{ id: string; update: BudgetLineUpdate }>();
  deleteClicked = output<string>();
  addClicked = output<TransactionKind>();

  groupedLines = computed<GroupedBudgetLines>(() => {
    const lines = this.budgetLines();
    const grouped: GroupedBudgetLines = {
      income: [],
      expenses: [],
      savings: [],
      incomeTotal: 0,
      expensesTotal: 0,
      savingsTotal: 0,
    };

    lines.forEach((line) => {
      switch (line.kind) {
        case 'INCOME':
          grouped.income.push(line);
          grouped.incomeTotal += line.amount;
          break;
        case 'FIXED_EXPENSE':
          grouped.expenses.push(line);
          grouped.expensesTotal += line.amount;
          break;
        case 'SAVINGS_CONTRIBUTION':
          grouped.savings.push(line);
          grouped.savingsTotal += line.amount;
          break;
      }
    });

    return grouped;
  });

  handleUpdate(id: string, update: BudgetLineUpdate): void {
    this.updateClicked.emit({ id, update });
  }
}
