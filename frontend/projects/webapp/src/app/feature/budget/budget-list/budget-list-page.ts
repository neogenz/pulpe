import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { ROUTES, TitleDisplay } from '@core/routing';
import { type CalendarMonth, YearCalendar } from '@ui/calendar';
import { type CalendarYear } from '@ui/calendar/calendar-types';
import { BaseLoading } from '@ui/loading';
import { firstValueFrom, map, shareReplay } from 'rxjs';
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
                    [calendarYear]="budgetsOfYear"
                    [currentDate]="currentDate()"
                    (monthClick)="navigateToDetails($event)"
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
  readonly #breakpointObserver = inject(BreakpointObserver);

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

  readonly #isHandset = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );

  #dialogConfig = computed<MatDialogConfig>(() => {
    const isHandset = this.#isHandset();
    return {
      width: '600px',
      maxWidth: isHandset ? '100dvw' : '90vw',
      minWidth: isHandset ? '100dvw' : undefined,
      height: isHandset ? '100dvh' : undefined,
      maxHeight: isHandset ? '100dvh' : undefined,
      panelClass: isHandset ? 'full-screen-dialog' : undefined,
      disableClose: false,
    };
  });

  ngOnInit(): void {
    this.state.refreshData();
  }

  navigateToDetails(month: CalendarMonth): void {
    if (month.hasContent && month.id) {
      this.#router.navigate([ROUTES.APP, ROUTES.BUDGET, month.id]);
    }
  }

  onCreateMonth(event: { month: number; year: number }): void {
    this.openCreateBudgetDialogForMonth(event.month, event.year);
  }

  async openCreateBudgetDialog(): Promise<void> {
    const dialogConfig = this.#dialogConfig();
    const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
      ...dialogConfig,
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
    const dialogConfig = this.#dialogConfig();
    const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
      ...dialogConfig,
      data: { month, year },
    });

    const result = await firstValueFrom(dialogRef.afterClosed());

    if (result?.success) {
      this.state.refreshData();
    }
  }
}
