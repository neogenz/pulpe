import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, type MatDialogConfig } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { BudgetApi } from '@core/budget/budget-api';
import { downloadAsJsonFile } from '@core/file-download';
import { ROUTES, TitleDisplay } from '@core/routing';
import { type CalendarMonth, YearCalendar } from '@ui/calendar';
import { type CalendarYear } from '@ui/calendar/calendar-types';
import { BaseLoading } from '@ui/loading';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { MonthsError } from '../ui/budget-error';
import { mapToCalendarYear } from './budget-list-mapper/budget-list.mapper';
import { BudgetListStore } from './budget-list-store';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';
import { Logger } from '@core/logging/logger';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { LoadingIndicator } from '@core/loading/loading-indicator';

const YEARS_TO_DISPLAY = 8; // Current year + 7 future years for planning

@Component({
  selector: 'pulpe-budget-list',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    BaseLoading,
    MonthsError,
    MatTabsModule,
    YearCalendar,
  ],
  template: `
    <div class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0 min-w-0">
      <header class="flex flex-wrap justify-between items-center gap-2">
        <h1 class="text-display-small truncate min-w-0 flex-shrink">
          {{ titleDisplay.currentTitle() }}
        </h1>
        <div class="flex gap-2 flex-shrink-0">
          <button
            matIconButton
            (click)="startPageTour()"
            matTooltip="Découvrir cette page"
            aria-label="Aide"
            data-testid="help-button"
          >
            <mat-icon>help_outline</mat-icon>
          </button>
          <button
            matIconButton
            (click)="onExportBudgets()"
            [disabled]="isExporting()"
            matTooltip="Exporter tous les budgets en JSON"
            aria-label="Exporter"
            data-testid="export-budgets-btn"
          >
            @if (isExporting()) {
              <mat-icon>hourglass_empty</mat-icon>
            } @else {
              <mat-icon>download</mat-icon>
            }
          </button>
          <button
            matButton="filled"
            (click)="openCreateBudgetDialog()"
            [disabled]="state.budgets.isLoading()"
            data-testid="create-budget-btn"
            data-tour="create-budget"
          >
            <mat-icon class="md:inline hidden">add_circle</mat-icon>
            <span class="md:hidden">Ajouter</span>
            <span class="hidden md:inline">Ajouter un budget</span>
          </button>
        </div>
      </header>

      @switch (true) {
        @case (state.budgets.status() === 'loading') {
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
          state.budgets.status() === 'local' ||
          state.budgets.status() === 'reloading'
        ) {
          <mat-tab-group
            mat-stretch-tabs="false"
            mat-align-tabs="start"
            fitInkBarToContent
            [selectedIndex]="state.selectedYearIndex()"
            (selectedIndexChange)="onTabChange($event)"
            data-tour="year-tabs"
          >
            @for (budgetsOfYear of calendarYears(); track budgetsOfYear.year) {
              <mat-tab [label]="budgetsOfYear.year.toString()">
                <pulpe-year-calendar
                  [calendarYear]="budgetsOfYear"
                  [currentDate]="currentDate()"
                  (monthClick)="navigateToDetails($event)"
                  (createMonth)="onCreateMonth($event)"
                />
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
export default class BudgetListPage {
  protected readonly state = inject(BudgetListStore);
  protected readonly titleDisplay = inject(TitleDisplay);
  readonly #productTourService = inject(ProductTourService);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetApi = inject(BudgetApi);

  readonly #isExporting = signal(false);
  readonly isExporting = this.#isExporting.asReadonly();

  constructor() {
    // Refresh data on init
    this.state.refreshData();

    effect(() => {
      const status = this.state.budgets.status();
      this.#loadingIndicator.setLoading(status === 'reloading');
    });

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
    });

    // Auto-trigger tour on first visit
    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('budget-list')) {
        setTimeout(
          () => this.#productTourService.startPageTour('budget-list'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  startPageTour(): void {
    this.#productTourService.startPageTour('budget-list');
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

  async onExportBudgets(): Promise<void> {
    this.#isExporting.set(true);
    this.#loadingIndicator.setLoading(true);

    try {
      const data = await firstValueFrom(this.#budgetApi.exportAllBudgets$());
      const today = new Date().toISOString().split('T')[0];
      downloadAsJsonFile(data, `pulpe-export-${today}`);

      this.#snackBar.open(
        'Export réussi ! Le fichier a été téléchargé.',
        'Fermer',
        { duration: 3000 },
      );
    } catch (error) {
      this.#logger.error('Error exporting budgets', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.#snackBar.open(
        `Erreur lors de l'export: ${errorMessage}`,
        'Fermer',
        {
          duration: 5000,
        },
      );
    } finally {
      this.#isExporting.set(false);
      this.#loadingIndicator.setLoading(false);
    }
  }
}
