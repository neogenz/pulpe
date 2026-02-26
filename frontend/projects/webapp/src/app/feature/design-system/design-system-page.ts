import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import { DashboardHero } from '@features/current-month/components/dashboard-hero';
import { BudgetFinancialOverview } from '@features/budget/budget-details/budget-financial-overview';
import { createMockBudgetLine } from '@app/testing/mock-factories';
import { ThemeService } from '@core/theme';

@Component({
  selector: 'pulpe-design-system-page',
  imports: [
    MatIconModule,
    MatButtonToggleModule,
    DashboardHero,
    BudgetFinancialOverview,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-12">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <mat-icon>palette</mat-icon>
          <h1 class="text-headline-large font-bold">Design System</h1>
        </div>
        <mat-button-toggle-group
          [value]="themeService.isDark() ? 'dark' : 'light'"
          (change)="onThemeChange($event.value)"
          class="text-label-medium"
        >
          <mat-button-toggle value="light">
            <mat-icon class="mat-icon-sm">light_mode</mat-icon>
            Light
          </mat-button-toggle>
          <mat-button-toggle value="dark">
            <mat-icon class="mat-icon-sm">dark_mode</mat-icon>
            Dark
          </mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Section: Dashboard Hero -->
      <section class="space-y-4">
        <h2
          class="text-headline-medium font-semibold border-b border-outline-variant pb-2"
        >
          Dashboard Hero
        </h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="space-y-2">
            <p class="text-label-large text-on-surface-variant">
              On-track (comfortable)
            </p>
            <pulpe-dashboard-hero
              [expenses]="-1500"
              [available]="4000"
              [totalIncome]="5000"
              [remaining]="2500"
              [budgetConsumedPercentage]="37"
              [timeElapsedPercentage]="50"
              [periodDates]="mockPeriodDates"
            />
          </div>
          <div class="space-y-2">
            <p class="text-label-large text-on-surface-variant">
              Warning (&gt;90%)
            </p>
            <pulpe-dashboard-hero
              [expenses]="-3700"
              [available]="4000"
              [totalIncome]="5000"
              [remaining]="300"
              [budgetConsumedPercentage]="92"
              [timeElapsedPercentage]="75"
              [periodDates]="mockPeriodDates"
            />
          </div>
          <div class="space-y-2">
            <p class="text-label-large text-on-surface-variant">
              Over-budget (deficit)
            </p>
            <pulpe-dashboard-hero
              [expenses]="-4500"
              [available]="4000"
              [totalIncome]="5000"
              [remaining]="-500"
              [budgetConsumedPercentage]="112"
              [timeElapsedPercentage]="90"
              [periodDates]="mockPeriodDates"
            />
          </div>
        </div>
      </section>

      <!-- Section: Budget Financial Overview -->
      <section class="space-y-4">
        <h2
          class="text-headline-medium font-semibold border-b border-outline-variant pb-2"
        >
          Budget Financial Overview
        </h2>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="space-y-2">
            <p class="text-label-large text-on-surface-variant">Comfortable</p>
            <pulpe-budget-financial-overview
              [budgetLines]="comfortableBudgetLines"
              [transactions]="emptyTransactions"
              [realizedBalance]="0"
              [realizedExpenses]="0"
              [checkedCount]="0"
              [totalCount]="4"
            />
          </div>
          <div class="space-y-2">
            <p class="text-label-large text-on-surface-variant">Warning</p>
            <pulpe-budget-financial-overview
              [budgetLines]="warningBudgetLines"
              [transactions]="emptyTransactions"
              [realizedBalance]="0"
              [realizedExpenses]="0"
              [checkedCount]="0"
              [totalCount]="5"
            />
          </div>
          <div class="space-y-2">
            <p class="text-label-large text-on-surface-variant">Deficit</p>
            <pulpe-budget-financial-overview
              [budgetLines]="deficitBudgetLines"
              [transactions]="emptyTransactions"
              [realizedBalance]="0"
              [realizedExpenses]="0"
              [checkedCount]="0"
              [totalCount]="5"
            />
          </div>
        </div>
      </section>

      <!-- Section: Financial Colors -->
      <section class="space-y-4">
        <h2
          class="text-headline-medium font-semibold border-b border-outline-variant pb-2"
        >
          Financial Colors
        </h2>

        <h3 class="text-title-medium">Text Colors</h3>
        <div class="flex flex-wrap gap-4">
          @for (color of financialColors; track color.token) {
            <div class="flex flex-col items-center gap-1">
              <div
                class="w-12 h-12 rounded-lg"
                [style.background-color]="'var(' + color.token + ')'"
              ></div>
              <span class="text-label-small text-on-surface-variant">{{
                color.label
              }}</span>
              <code
                class="text-label-small font-mono text-on-surface-variant/60"
                >{{ color.token }}</code
              >
            </div>
          }
        </div>

        <h3 class="text-title-medium">Container Colors</h3>
        <div class="flex flex-wrap gap-4">
          @for (color of financialContainers; track color.token) {
            <div class="flex flex-col items-center gap-1">
              <div
                class="w-12 h-12 rounded-lg border border-outline-variant"
                [style.background-color]="'var(' + color.token + ')'"
              ></div>
              <span class="text-label-small text-on-surface-variant">{{
                color.label
              }}</span>
              <code
                class="text-label-small font-mono text-on-surface-variant/60"
                >{{ color.token }}</code
              >
            </div>
          }
        </div>

        <h3 class="text-title-medium">Hero Gradient Colors</h3>
        <div class="flex flex-wrap gap-4">
          @for (color of heroColors; track color.token) {
            <div class="flex flex-col items-center gap-1">
              <div
                class="w-16 h-12 rounded-lg flex items-center justify-center"
                [style.background-color]="'var(' + color.token + ')'"
                [style.color]="'var(' + color.textToken + ')'"
              >
                <span class="text-label-small font-bold">Aa</span>
              </div>
              <span class="text-label-small text-on-surface-variant">{{
                color.label
              }}</span>
              <code
                class="text-label-small font-mono text-on-surface-variant/60"
                >{{ color.token }}</code
              >
            </div>
          }
        </div>
      </section>

      <!-- Section: Typography -->
      <section class="space-y-4">
        <h2
          class="text-headline-medium font-semibold border-b border-outline-variant pb-2"
        >
          Typography Scale
        </h2>
        <div class="space-y-3">
          @for (scale of typographyScales; track scale) {
            <div class="flex items-baseline gap-4">
              <code
                class="text-label-small text-on-surface-variant w-44 shrink-0 font-mono"
                >{{ scale }}</code
              >
              <span [class]="scale">Le budget de janvier</span>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export default class DesignSystemPage {
  protected readonly themeService = inject(ThemeService);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.themeService.forceTheme(null));
  }

  protected onThemeChange(value: 'light' | 'dark'): void {
    this.themeService.forceTheme(value);
  }

  readonly mockPeriodDates = {
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 0, 31),
  };

  readonly emptyTransactions: Transaction[] = [];

  // Comfortable: income 5000, expenses 2000, savings 500
  readonly comfortableBudgetLines: BudgetLine[] = [
    createMockBudgetLine({
      id: 'c-1',
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'c-2',
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'c-3',
      name: 'Courses',
      amount: 800,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'c-4',
      name: 'Epargne',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
    }),
  ];

  // Warning: income 5000, expenses 4200, savings 500 -> remaining ~300
  readonly warningBudgetLines: BudgetLine[] = [
    createMockBudgetLine({
      id: 'w-1',
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'w-2',
      name: 'Loyer',
      amount: 1800,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'w-3',
      name: 'Courses',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'w-4',
      name: 'Assurances',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'w-5',
      name: 'Epargne',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
    }),
  ];

  // Deficit: income 5000, expenses 5200, savings 500 -> remaining -700
  readonly deficitBudgetLines: BudgetLine[] = [
    createMockBudgetLine({
      id: 'd-1',
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'd-2',
      name: 'Loyer',
      amount: 2000,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'd-3',
      name: 'Courses',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'd-4',
      name: 'Assurances',
      amount: 1700,
      kind: 'expense',
      recurrence: 'fixed',
    }),
    createMockBudgetLine({
      id: 'd-5',
      name: 'Epargne',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
    }),
  ];

  readonly financialColors = [
    { token: '--pulpe-financial-income', label: 'Income' },
    { token: '--pulpe-financial-expense', label: 'Expense' },
    { token: '--pulpe-financial-savings', label: 'Savings' },
    { token: '--pulpe-financial-negative', label: 'Negative' },
    { token: '--pulpe-financial-critical', label: 'Critical' },
  ];

  readonly financialContainers = [
    { token: '--pulpe-financial-income-light', label: 'Income Light' },
    { token: '--pulpe-financial-expense-light', label: 'Expense Light' },
    { token: '--pulpe-financial-savings-light', label: 'Savings Light' },
  ];

  readonly heroColors = [
    {
      token: '--pulpe-hero-primary',
      label: 'Hero Primary',
      textToken: '--pulpe-hero-primary-text',
    },
    {
      token: '--pulpe-hero-warning',
      label: 'Hero Warning',
      textToken: '--pulpe-hero-warning-text',
    },
    {
      token: '--pulpe-hero-error',
      label: 'Hero Error',
      textToken: '--pulpe-hero-error-text',
    },
  ];

  readonly typographyScales = [
    'text-display-large',
    'text-display-medium',
    'text-display-small',
    'text-headline-large',
    'text-headline-medium',
    'text-headline-small',
    'text-title-large',
    'text-title-medium',
    'text-title-small',
    'text-body-large',
    'text-body-medium',
    'text-body-small',
    'text-label-large',
    'text-label-medium',
    'text-label-small',
  ];
}
