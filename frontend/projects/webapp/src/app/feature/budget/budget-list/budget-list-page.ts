import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  type OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { Logger } from '@core/logging/logger';
import { ROUTES, TitleDisplay } from '@core/routing';
import { TutorialService } from '@core/tutorial/tutorial.service';
import { type CalendarMonth, YearCalendar } from '@ui/calendar';
import { type CalendarYear } from '@ui/calendar/calendar-types';
import { BaseLoading } from '@ui/loading';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { MonthsError } from '../ui/budget-error';
import { mapToCalendarYear } from './budget-list-mapper/budget-list.mapper';
import { BudgetListStore } from './budget-list-store';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';

const YEARS_TO_DISPLAY = 8; // Current year + 7 future years for planning

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
            data-testid="budget-year-tabs"
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
  protected readonly state = inject(BudgetListStore);
  protected readonly titleDisplay = inject(TitleDisplay);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #tutorialService = inject(TutorialService);
  readonly #injector = inject(Injector);
  readonly #isDataLoaded = computed(
    () =>
      this.state.budgets.status() === 'resolved' ||
      this.state.budgets.status() === 'local',
  );

  constructor() {
    this.#tutorialService.autoStartWhenReady(
      'budget-calendar',
      this.#isDataLoaded,
      this.#injector,
    );
  }

  protected readonly calendarYears = computed<CalendarYear[]>(() => {
    const currentYear = new Date().getFullYear();
    const budgetsGroupedByYears = this.state.allMonthsGroupedByYears();

    // Récupérer toutes les années existantes dans budgetsGroupedByYears
    const existingYears = Array.from(budgetsGroupedByYears.keys());

    // Générer la plage d'années à partir de l'année courante (année courante + 7 années suivantes)
    const calculatedYears = Array.from(
      { length: YEARS_TO_DISPLAY },
      (_, i) => currentYear + i,
    );

    // Fusionner les années existantes et calculées, puis supprimer les doublons et trier
    const years = Array.from(
      new Set([...existingYears, ...calculatedYears]),
    ).sort((a, b) => a - b);

    return years.map((year) => {
      // Récupérer les budgets existants ou créer des placeholders
      const existingBudgets = budgetsGroupedByYears.get(year);

      if (existingBudgets) {
        return mapToCalendarYear(year, existingBudgets);
      } else {
        // Créer 12 mois vides pour l'année
        const emptyMonths = Array.from({ length: 12 }, (_, monthIndex) => ({
          month: monthIndex + 1,
          year,
        }));
        return mapToCalendarYear(year, emptyMonths);
      }
    });
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
    try {
      const dialogConfig = this.#dialogConfig();
      const nextAvailableMonth = this.state.nextAvailableMonth();
      const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
        ...dialogConfig,
        data: {
          month: nextAvailableMonth.month,
          year: nextAvailableMonth.year,
        },
      });

      const result = await firstValueFrom(dialogRef.afterClosed());

      // Only refresh data if budget was successfully created
      if (result?.success) {
        this.state.refreshData();
      }
    } catch (error) {
      this.#logger.error('Error opening create budget dialog', error);
      this.#snackBar.open(
        `Une erreur est survenue lors de l'ouverture du dialogue: ${error}`,
        'Fermer',
        {
          duration: 5000,
        },
      );
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
    try {
      const dialogConfig = this.#dialogConfig();
      const dialogRef = this.#dialog.open(CreateBudgetDialogComponent, {
        ...dialogConfig,
        data: { month, year },
      });

      const result = await firstValueFrom(dialogRef.afterClosed());

      if (result?.success) {
        this.state.refreshData();
      }
    } catch (error) {
      this.#logger.error('Error opening create budget dialog', error);
      this.#snackBar.open(
        `Une erreur est survenue lors de l'ouverture du dialogue: ${error}`,
        'Fermer',
        {
          duration: 5000,
        },
      );
    }
  }
}
