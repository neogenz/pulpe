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
import { BaseLoading } from '@ui/loading';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { MonthsError } from './ui/budget-error';
import { BudgetListStore } from './budget-list-store';
import { CreateBudgetDialogComponent } from './create-budget/budget-creation-dialog';
import SearchTransactionsDialogComponent from './search-transactions-dialog/search-transactions-dialog';
import { Logger } from '@core/logging/logger';
import {
  type BudgetExportResponse,
  type TransactionSearchResult,
} from 'pulpe-shared';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { CURRENCY_CONFIG } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';

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
          class="text-headline-medium md:text-display-small truncate min-w-0 shrink"
          data-testid="page-title"
        >
          {{ titleDisplay.currentTitle() }}
        </h1>
        <div class="flex gap-2 items-center shrink-0 ml-auto">
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
            [disabled]="state.budgets.isInitialLoading()"
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

      @if (state.budgets.isInitialLoading()) {
        <pulpe-base-loading
          [message]="'budget.loadingBudgets' | transloco"
          size="large"
          testId="months-loading"
        />
      } @else if (state.budgets.error()) {
        <pulpe-months-error (reload)="state.refreshData()" />
      } @else {
        <mat-tab-group
          mat-stretch-tabs="false"
          mat-align-tabs="start"
          fitInkBarToContent
          [selectedIndex]="state.selectedYearIndex()"
          (selectedIndexChange)="onTabChange($event)"
          data-tour="year-tabs"
        >
          @for (
            budgetsOfYear of state.calendarYears();
            track budgetsOfYear.year
          ) {
            <mat-tab [label]="budgetsOfYear.year.toString()">
              <pulpe-year-calendar
                [calendarYear]="budgetsOfYear"
                [currency]="currency()"
                [locale]="currencyLocale()"
                [currentDate]="state.currentDate()"
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
  readonly #excelExportService = inject(ExcelExportService);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettingsStore = inject(UserSettingsStore);

  protected readonly currency = this.#userSettingsStore.currency;
  protected readonly currencyLocale = computed(
    () => CURRENCY_CONFIG[this.currency()].numberLocale,
  );
  protected readonly isExporting = signal(false);
  protected readonly isExportingExcel = signal(false);

  constructor() {
    this.state.refreshData();

    effect(() => {
      const status = this.state.budgets.status();
      this.#loadingIndicator.setLoading(status === 'reloading');
    });

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
    });

    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('budget-list')) {
        setTimeout(
          () => this.#productTourService.startPageTour('budget-list'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  readonly #isHandset = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay({ bufferSize: 1, refCount: true }),
    ),
    { initialValue: false },
  );

  readonly #dialogConfig = computed<MatDialogConfig>(() => {
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
    const { month, year } = this.state.nextAvailableMonth();
    return this.openCreateBudgetDialogForMonth(month, year);
  }

  onTabChange(selectedIndex: number): void {
    const years = this.state.calendarYears();
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
    const today = new Date().toISOString().split('T')[0];
    return this.#executeExport({
      isLoadingSignal: this.isExporting,
      download: (data) => downloadAsJsonFile(data, `pulpe-export-${today}`),
      successKey: 'budget.exportDone',
      errorKey: 'budget.exportError',
    });
  }

  async onExportBudgetsAsExcel(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    return this.#executeExport({
      isLoadingSignal: this.isExportingExcel,
      download: (data) => {
        const workbook = this.#excelExportService.buildWorkbook(data);
        downloadAsExcelFile(workbook, `pulpe-export-${today}`);
      },
      successKey: 'budget.exportExcelDone',
      errorKey: 'budget.exportExcelError',
    });
  }

  async #executeExport(options: {
    isLoadingSignal: ReturnType<typeof signal<boolean>>;
    download: (data: BudgetExportResponse) => void;
    successKey: string;
    errorKey: string;
  }): Promise<void> {
    options.isLoadingSignal.set(true);
    this.#loadingIndicator.setLoading(true);

    try {
      const data = await this.state.exportAllBudgets();
      options.download(data);
      this.#snackBar.open(
        this.#transloco.translate(options.successKey),
        this.#transloco.translate('common.close'),
        { duration: 3000 },
      );
    } catch (error) {
      this.#logger.error('Export failed', error);
      this.#snackBar.open(
        this.#transloco.translate(options.errorKey),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    } finally {
      options.isLoadingSignal.set(false);
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
