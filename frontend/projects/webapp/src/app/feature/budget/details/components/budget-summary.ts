import {
  Component,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import { type BudgetLine } from '@pulpe/shared';

@Component({
  selector: 'pulpe-budget-summary',
  imports: [MatCardModule, MatIconModule, CurrencyPipe],
  template: `
    <mat-card class="bg-[color-surface-container-highest]">
      <mat-card-header>
        <div mat-card-avatar>
          <div
            class="flex justify-center items-center size-11 bg-[color-tertiary-container] rounded-full"
          >
            <mat-icon class="text-[color-on-tertiary-container]">
              account_balance
            </mat-icon>
          </div>
        </div>
        <mat-card-title>Résumé du budget</mat-card-title>
        <mat-card-subtitle>Vue d'ensemble mensuelle</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <!-- Income -->
          <div class="flex items-center gap-3">
            <mat-icon class="text-financial-income">trending_up</mat-icon>
            <div class="flex-1">
              <div class="text-label-medium text-[color-on-surface-variant]">
                Total des revenus
              </div>
              <p class="text-title-large font-medium text-financial-income">
                {{ totals().income | currency: 'CHF' }}
              </p>
            </div>
          </div>

          <!-- Expenses -->
          <div class="flex items-center gap-3">
            <mat-icon class="text-financial-negative">trending_down</mat-icon>
            <div class="flex-1">
              <div class="text-label-medium text-[color-on-surface-variant]">
                Total des dépenses
              </div>
              <p class="text-title-large font-medium text-financial-negative">
                {{ totals().expenses | currency: 'CHF' }}
              </p>
            </div>
          </div>

          <!-- Savings -->
          <div class="flex items-center gap-3">
            <mat-icon class="text-[color-primary]">savings</mat-icon>
            <div class="flex-1">
              <div class="text-label-medium text-[color-on-surface-variant]">
                Total de l'épargne
              </div>
              <p class="text-title-large font-medium text-[color-primary]">
                {{ totals().savings | currency: 'CHF' }}
              </p>
            </div>
          </div>

          <!-- Remaining -->
          <div class="flex items-center gap-3">
            <mat-icon [class]="remainingClass()">
              {{ totals().remaining >= 0 ? 'check_circle' : 'warning' }}
            </mat-icon>
            <div class="flex-1">
              <div class="text-label-medium text-[color-on-surface-variant]">
                Reste disponible
              </div>
              <p
                class="text-title-large font-medium"
                [class]="remainingClass()"
              >
                {{ totals().remaining | currency: 'CHF' }}
              </p>
            </div>
          </div>
        </div>

        @if (totals().remaining < 0) {
          <div
            class="mt-4 p-3 bg-[color-error-container] rounded-[radius-corner-medium] flex items-center gap-2"
          >
            <mat-icon class="text-[color-on-error-container]">warning</mat-icon>
            <span class="text-body-medium text-[color-on-error-container]">
              Attention: vos dépenses et épargnes dépassent vos revenus de
              {{ Math.abs(totals().remaining) | currency: 'CHF' }}
            </span>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetSummary {
  budgetLines = input.required<BudgetLine[]>();
  Math = Math;

  totals = computed(() => {
    const lines = this.budgetLines();
    let income = 0;
    let expenses = 0;
    let savings = 0;

    lines.forEach((line) => {
      switch (line.kind) {
        case 'INCOME':
          income += line.amount;
          break;
        case 'FIXED_EXPENSE':
          expenses += line.amount;
          break;
        case 'SAVINGS_CONTRIBUTION':
          savings += line.amount;
          break;
      }
    });

    const remaining = income - expenses - savings;

    return {
      income,
      expenses,
      savings,
      remaining,
    };
  });

  remainingClass = computed(() => {
    return this.totals().remaining >= 0
      ? 'text-financial-income'
      : 'text-financial-negative';
  });
}
