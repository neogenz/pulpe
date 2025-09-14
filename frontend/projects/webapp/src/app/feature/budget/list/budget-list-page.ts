import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { ROUTES, TitleDisplay } from '@core/routing';
import { type CalendarMonth, YearCalendar } from '@ui/calendar';
import { type CalendarYear } from '@ui/calendar/calendar-types';
import { BaseLoading } from '@ui/loading';
import { firstValueFrom } from 'rxjs';
import { MonthsError } from '../ui/budget-error';
import { mapToCalendarYear } from './budget-list-mapper/budget-list.mapper';
import { BudgetState } from './budget-state';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';

@Component({
  selector: 'pulpe-budget-list',
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
          [disabled]="state.budgets.isLoading()"
          data-testid="create-budget-btn"
        >
          <mat-icon class="md:inline hidden">add_circle</mat-icon>
          <span class="md:hidden">Ajouter</span>
          <span class="hidden md:inline">Ajouter un budget</span>
        </button>
      </header>

      @switch (true) {
        @case (
          state.budgets.status() === 'loading' ||
          state.budgets.status() === 'reloading'
        ) {
          <pulpe-base-loading
            message="Chargement des données mensuelles..."
            size="large"
            testId="months-loading"
          />
        }
        @case (state.budgets.status() === 'error') {
          <pulpe-months-error (reload)="state.refreshData()" />
        }
        @case (
          state.budgets.status() === 'resolved' ||
          state.budgets.status() === 'local'
        ) {
          <mat-tab-group
            mat-stretch-tabs="false"
            mat-align-tabs="start"
            fitInkBarToContent
            [selectedIndex]="state.selectedYearIndex()"
            (selectedIndexChange)="onTabChange($event)"
          >
            @for (budgetsOfYear of calendarYears(); track budgetsOfYear.year) {
              <mat-tab [label]="budgetsOfYear.year.toString()">
                <div class="pt-6">
                  <pulpe-year-calendar
                    [year]="budgetsOfYear.year"
                    [months]="budgetsOfYear.months"
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
export default class BudgetListPage implements OnInit {
  protected readonly state = inject(BudgetState);
  protected readonly titleDisplay = inject(TitleDisplay);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);

  protected readonly calendarYears = computed<CalendarYear[]>(() => {
    const budgetsGroupedByYears = this.state.allMonthsGroupedByYears();
    return Array.from(budgetsGroupedByYears.entries()).map(([year, budgets]) =>
      mapToCalendarYear(year, budgets),
    );
  });

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

  onMonthClick(month: CalendarMonth): void {
    if (month.hasContent && month.id) {
      this.navigateToDetails(month.id);
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
    const availableYears = this.state.plannedYears();
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
}
