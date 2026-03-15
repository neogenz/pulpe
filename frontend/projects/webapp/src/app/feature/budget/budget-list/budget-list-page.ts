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
import { ExcelExportService } from '@core/budget/excel-export.service';
import { downloadAsExcelFile, downloadAsJsonFile } from '@core/file-download';
import { ROUTES, TitleDisplay } from '@core/routing';
import { type CalendarMonth, YearCalendar } from '@ui/calendar';
import { type CalendarYear } from '@ui/calendar/calendar-types';
import { BaseLoading } from '@ui/loading';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { MonthsError } from '../ui/budget-error';
import { mapToCalendarYear } from './budget-list-mapper/budget-list.mapper';
import { BudgetListStore } from './budget-list-store';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';
import SearchTransactionsDialogComponent from './search-transactions-dialog/search-transactions-dialog';
import { Logger } from '@core/logging/logger';
import {
  type TransactionSearchResult,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { UserSettingsStore } from '@core/user-settings';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';

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
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col 2xl:h-full gap-4 2xl:min-h-0 min-w-0">
      <header class="pulpe-page-header" data-testid="page-header">
        <h1
          class="text-headline-medium md:text-display-small truncate min-w-0 flex-shrink"
          data-testid="page-title"
        >
          {{ titleDisplay.currentTitle() }}
        </h1>
        <div class="flex gap-2 items-center flex-shrink-0 ml-auto">
          <button
            matIconButton
            (click)="onExportBudgets()"
            [disabled]="isExporting()"
            [matTooltip]="'budget.exportJsonTooltip' | transloco"
            [attr.aria-label]="'budget.exportJsonAriaLabel' | transloco"
            data-testid="export-budgets-btn"
          >
            @if (isExporting()) {
              <mat-icon>hourglass_empty</mat-icon>
            } @else {
              <mat-icon>download</mat-icon>
            }
          </button>
          <button
            matIconButton
            (click)="onExportBudgetsAsExcel()"
            [disabled]="isExportingExcel()"
            [matTooltip]="'budget.exportExcelTooltip' | transloco"
            [attr.aria-label]="'budget.exportExcelAriaLabel' | transloco"
            data-testid="export-budgets-excel-btn"
          >
            @if (isExportingExcel()) {
              <mat-icon>hourglass_empty</mat-icon>
            } @else {
              <mat-icon>table_view</mat-icon>
            }
          </button>
          <button
            matIconButton
            (click)="openSearchDialog()"
            [matTooltip]="'budget.searchTooltip' | transloco"
            [attr.aria-label]="'budget.searchAriaLabel' | transloco"
            data-testid="search-transactions-btn"
          >
            <mat-icon>search</mat-icon>
          </button>
          <button
            matButton="filled"
            (click)="openCreateBudgetDialog()"
            [disabled]="state.isLoading()"
            data-testid="create-budget-btn"
            data-tour="create-budget"
          >
            <mat-icon class="md:inline hidden">add_circle</mat-icon>
            <span class="md:hidden">{{ 'budget.addShort' | transloco }}</span>
            <span class="hidden md:inline">{{
              'budget.addBudget' | transloco
            }}</span>
          </button>
        </div>
      </header>

      @if (state.isLoading()) {
        <pulpe-base-loading
          [message]="'budget.loadingBudgets' | transloco"
          size="large"
          testId="months-loading"
        />
      } @else if (state.error()) {
        <pulpe-months-error (reload)="state.refreshData()" />
      } @else {
        <mat-tab-group
          mat-stretch-tabs="false"
          mat-align-tabs="start"
          fitInkBarToContent
          [selectedIndex]="selectedYearIndex()"
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
  readonly #userSettingsStore = inject(UserSettingsStore);
  readonly #excelExportService = inject(ExcelExportService);
  readonly #transloco = inject(TranslocoService);

  protected readonly isExporting = signal(false);
  protected readonly isExportingExcel = signal(false);

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

  protected readonly selectedYearIndex = computed(() => {
    const year = this.state.selectedYear();
    const years = this.calendarYears();
    if (!year || years.length === 0) return 0;
    const idx = years.findIndex((y) => y.year === year);
    return Math.max(0, idx);
  });

  protected readonly calendarYears = computed<CalendarYear[]>(() => {
    const currentYear = new Date().getFullYear();
    const budgetsGroupedByYears = this.state.allMonthsGroupedByYears();
    const payDayOfMonth = this.#userSettingsStore.payDayOfMonth();

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
    ).toSorted((a, b) => a - b);

    return years.map((year) => {
      // Récupérer les budgets existants ou créer des placeholders
      const existingBudgets = budgetsGroupedByYears.get(year);

      if (existingBudgets) {
        return mapToCalendarYear(year, existingBudgets, payDayOfMonth);
      } else {
        // Créer 12 mois vides pour l'année
        const emptyMonths = Array.from({ length: 12 }, (_, monthIndex) => ({
          month: monthIndex + 1,
          year,
        }));
        return mapToCalendarYear(year, emptyMonths, payDayOfMonth);
      }
    });
  });

  // Current budget period based on payday setting
  protected readonly currentDate = computed(() => {
    const payDay = this.#userSettingsStore.payDayOfMonth();
    return getBudgetPeriodForDate(new Date(), payDay);
  });

  readonly #isHandset = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay({ bufferSize: 1, refCount: true }),
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
      this.#router.navigate(['/', ROUTES.BUDGET, month.id]);
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

      // Store auto-refreshes via cache invalidation when budget is created
      await firstValueFrom(dialogRef.afterClosed());
    } catch (error) {
      this.#logger.error('Error opening create budget dialog', error);
      this.#snackBar.open(
        this.#transloco.translate('budget.openDialogError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    }
  }

  onTabChange(selectedIndex: number): void {
    const years = this.calendarYears();
    if (selectedIndex >= 0 && selectedIndex < years.length) {
      this.state.setSelectedYear(years[selectedIndex].year);
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

      // Store auto-refreshes via cache invalidation when budget is created
      await firstValueFrom(dialogRef.afterClosed());
    } catch (error) {
      this.#logger.error('Error opening create budget dialog', error);
      this.#snackBar.open(
        this.#transloco.translate('budget.openDialogError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    }
  }

  async onExportBudgets(): Promise<void> {
    this.isExporting.set(true);
    this.#loadingIndicator.setLoading(true);

    try {
      const data = await this.state.exportAllBudgets();
      const today = new Date().toISOString().split('T')[0];
      downloadAsJsonFile(data, `pulpe-export-${today}`);

      this.#snackBar.open(
        this.#transloco.translate('budget.exportDone'),
        this.#transloco.translate('common.close'),
        { duration: 3000 },
      );
    } catch (error) {
      this.#logger.error('Error exporting budgets', error);
      this.#snackBar.open(
        this.#transloco.translate('budget.exportError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    } finally {
      this.isExporting.set(false);
      this.#loadingIndicator.setLoading(false);
    }
  }

  async onExportBudgetsAsExcel(): Promise<void> {
    this.isExportingExcel.set(true);
    this.#loadingIndicator.setLoading(true);

    try {
      const data = await this.state.exportAllBudgets();
      const workbook = this.#excelExportService.buildWorkbook(data);
      const today = new Date().toISOString().split('T')[0];
      downloadAsExcelFile(workbook, `pulpe-export-${today}`);

      this.#snackBar.open(
        this.#transloco.translate('budget.exportExcelDone'),
        this.#transloco.translate('common.close'),
        { duration: 3000 },
      );
    } catch (error) {
      this.#logger.error('Error exporting budgets as Excel', error);
      this.#snackBar.open(
        this.#transloco.translate('budget.exportExcelError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    } finally {
      this.isExportingExcel.set(false);
      this.#loadingIndicator.setLoading(false);
    }
  }

  async openSearchDialog(): Promise<void> {
    try {
      const dialogRef = this.#dialog.open(SearchTransactionsDialogComponent, {
        ...this.#dialogConfig(),
      });

      const result = await firstValueFrom<TransactionSearchResult | undefined>(
        dialogRef.afterClosed(),
      );

      if (result) {
        this.#router.navigate(['/', ROUTES.BUDGET, result.budgetId]);
      }
    } catch (error) {
      this.#logger.error('Error opening search dialog', error);
      this.#snackBar.open(
        this.#transloco.translate('budget.openDialogError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    }
  }
}
