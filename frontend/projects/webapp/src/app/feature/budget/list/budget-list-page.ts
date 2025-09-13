import {
  ChangeDetectionStrategy,
  Component,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BaseLoading } from '@ui/loading';
import { MonthsError } from '../ui/budget-error';
import { BudgetState } from './budget-state';
import { MatTabsModule } from '@angular/material/tabs';
import { TitleDisplay } from '@core/routing';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ROUTES } from '@core/routing';
import { YearCalendar } from '@ui/calendar';
import { type CalendarMonth } from '@ui/calendar';
import { type MonthInfo } from '@core/budget/month-info';

@Component({
  selector: 'pulpe-other-months',
  imports: [
    MatIconModule,
    MatButtonModule,
    BaseLoading,
    MonthsError,
    MatTabsModule,
    YearCalendar,
  ],
  template: `
    <div class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">
          {{ titleDisplay.currentTitle() }}
        </h1>
        <button
          matButton="filled"
          (click)="openCreateBudgetDialog()"
          [disabled]="state.monthsData.isLoading()"
          data-testid="create-budget-btn"
        >
          <mat-icon class="md:inline hidden">add_circle</mat-icon>
          <span class="md:hidden">Ajouter</span>
          <span class="hidden md:inline">Ajouter un budget</span>
        </button>
      </header>

      @switch (true) {
        @case (
          state.monthsData.status() === 'loading' ||
          state.monthsData.status() === 'reloading'
        ) {
          <pulpe-base-loading
            message="Chargement des données mensuelles..."
            size="large"
            testId="months-loading"
          />
        }
        @case (state.monthsData.status() === 'error') {
          <pulpe-months-error (reload)="state.refreshData()" />
        }
        @case (
          state.monthsData.status() === 'resolved' ||
          state.monthsData.status() === 'local'
        ) {
          <mat-tab-group
            mat-stretch-tabs="false"
            mat-align-tabs="start"
            fitInkBarToContent
            [selectedIndex]="state.selectedYearIndex()"
            (selectedIndexChange)="onTabChange($event)"
          >
            @for (year of state.availableYears(); track year) {
              <mat-tab [label]="year.toString()">
                <div class="pt-6">
                  <pulpe-year-calendar
                    [year]="year"
                    [months]="getCalendarMonths(year)"
                    [currentDate]="currentDate()"
                    [config]="calendarConfig"
                    (monthClick)="onMonthClick($event)"
                    (createMonth)="onCreateMonth($event)"
                  />
                </div>
              </mat-tab>
            }
          </mat-tab-group>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OtherMonths implements OnInit {
  protected readonly state = inject(BudgetState);
  protected readonly titleDisplay = inject(TitleDisplay);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);

  // Calendar-specific signals
  protected readonly currentDate = signal({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  // Calendar configuration
  protected readonly calendarConfig = {
    showEmptyMonths: true,
    allowEmptyMonthClick: true,
  };

  ngOnInit(): void {
    this.state.refreshData();
  }

  getCalendarMonths(year: number): CalendarMonth[] {
    const budgets = this.state.monthsData.value() || [];
    const yearBudgets = budgets.filter((b) => b.year === year);
    return this.#mapBudgetsToCalendar(yearBudgets, year);
  }

  onMonthClick(month: CalendarMonth): void {
    if (month.hasContent && month.metadata?.['budgetId']) {
      this.navigateToDetails(month.metadata['budgetId'] as string);
    }
  }

  onCreateMonth(event: { month: number; year: number }): void {
    this.openCreateBudgetDialogForMonth(event.month, event.year);
  }

  async openCreateBudgetDialog(): Promise<void> {
    const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: false,
      data: {
        selectedYear: this.state.selectedYear(),
      },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    // Only refresh data if budget was successfully created
    if (result?.success) {
      this.state.refreshData();
    }
  }

  onTabChange(selectedIndex: number): void {
    const availableYears = this.state.availableYears();
    if (selectedIndex >= 0 && selectedIndex < availableYears.length) {
      this.state.setSelectedYear(availableYears[selectedIndex]);
    }
  }

  async openCreateBudgetDialogForMonth(
    month: number,
    year: number,
  ): Promise<void> {
    const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: false,
      data: { month, year },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (result?.success) {
      this.state.refreshData();
    }
  }

  navigateToDetails(budgetId: string): void {
    this.#router.navigate([ROUTES.APP, ROUTES.BUDGET, budgetId]);
  }

  #mapBudgetsToCalendar(
    budgets: MonthInfo[],
    targetYear?: number,
  ): CalendarMonth[] {
    const monthNames = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];

    const year =
      targetYear || this.state.selectedYear() || new Date().getFullYear();
    const allMonths: CalendarMonth[] = [];

    for (let month = 1; month <= 12; month++) {
      const budget = budgets.find((b) => b.month === month && b.year === year);

      allMonths.push({
        id: budget?.budgetId || `empty-${year}-${month}`,
        month,
        year,
        displayName: `${monthNames[month - 1]} ${year}`,
        hasContent: !!budget,
        value: budget?.endingBalance ?? undefined,
        status: budget?.endingBalance
          ? budget.endingBalance > 0
            ? 'positive'
            : budget.endingBalance < 0
              ? 'negative'
              : 'neutral'
          : undefined,
        metadata: budget ? { budgetId: budget.budgetId } : undefined,
      });
    }

    return allMonths;
  }
}
