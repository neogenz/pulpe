import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ROUTES } from '@core/routing';
import { Logger } from '@core/logging/logger';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import {
  type TemplateLine,
  type TemplateLinesPropagationSummary,
} from 'pulpe-shared';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { BaseLoading } from '@ui/loading';
import { TransactionLabelPipe } from '@pattern/transaction-display';
import { firstValueFrom } from 'rxjs';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';
import { EditTransactionsDialog, TransactionsTable } from './components';
import { BudgetTemplatesStore } from '../services/budget-templates-store';
import { TemplateDetailsStore } from './services/template-details-store';

@Component({
  selector: 'pulpe-template-detail',

  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    TransactionsTable,
    BaseLoading,
  ],
  providers: [TemplateDetailsStore, TransactionLabelPipe],
  template: `
    <!-- Main container with proper surface container background -->
    <div class="flex flex-col gap-8 min-w-0" data-testid="template-detail-page">
      @if (templateDetailsStore.isLoading()) {
        <!-- Loading state with proper accessibility -->
        <pulpe-base-loading
          [message]="loadingMessage"
          size="large"
          [fullHeight]="true"
          testId="template-details-loading"
        ></pulpe-base-loading>
      } @else if (templateDetailsStore.error()) {
        <!-- Error state with proper ARIA roles -->
        <div
          class="flex justify-center items-center h-full bg-error rounded-xl p-6"
          role="alert"
          aria-live="assertive"
        >
          <div class="text-center">
            <mat-icon
              class="mb-4"
              style="font-size: 2.25rem; width: 2.25rem; height: 2.25rem;"
              aria-hidden="true"
            >
              error_outline
            </mat-icon>
            <p class="text-body-large">{{ loadingError }}</p>
            <button
              matButton="outlined"
              (click)="templateDetailsStore.reloadTemplateDetails()"
              class="mt-4"
              [attr.aria-label]="retryLoadingLabel"
            >
              {{ retryLabel }}
            </button>
          </div>
        </div>
      } @else {
        @let templateData = templateDetailsStore.templateDetails();
        @if (templateData) {
          <!-- Header with back button, title, and actions -->
          <header class="flex flex-shrink-0 gap-4 items-center">
            <button
              matIconButton
              (click)="navigateBack()"
              [attr.aria-label]="backLabel"
              class="flex-shrink-0"
            >
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="flex-1 min-w-0">
              <h1
                class="text-headline-medium md:text-display-small truncate"
                [title]="templateData.template.name"
                data-testid="page-title"
              >
                {{ templateData.template.name }}
              </h1>
            </div>
            <!-- Mobile: icon-only buttons -->
            <div class="flex items-center gap-1 flex-shrink-0 md:hidden">
              <button
                matIconButton
                (click)="editTemplate()"
                [attr.aria-label]="editAriaLabel"
                data-testid="template-detail-edit-button-mobile"
              >
                <mat-icon>edit</mat-icon>
              </button>
              <button
                matIconButton
                color="warn"
                (click)="deleteTemplate()"
                [attr.aria-label]="deleteAriaLabel"
                data-testid="delete-template-detail-button-mobile"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
            <!-- Desktop: full buttons with text -->
            <div class="hidden md:flex items-center gap-2 flex-shrink-0">
              <button
                matButton="tonal"
                (click)="editTemplate()"
                [attr.aria-label]="editAriaLabel"
                data-testid="template-detail-edit-button"
              >
                <mat-icon>edit</mat-icon>
                {{ editLabel }}
              </button>
              <button
                matButton="filled"
                color="warn"
                (click)="deleteTemplate()"
                [attr.aria-label]="deleteAriaLabel"
                data-testid="delete-template-detail-button"
              >
                <mat-icon>delete</mat-icon>
                {{ deleteLabel }}
              </button>
            </div>
          </header>

          <!-- Financial overview: Hero + Pills -->
          <section
            class="flex-shrink-0 space-y-6"
            aria-labelledby="financial-summary-heading"
          >
            <h2 id="financial-summary-heading" class="sr-only">
              {{ financialSummaryHeading }}
            </h2>

            <!-- Hero: Net balance -->
            <div
              class="text-center py-6 px-4 sm:py-8 sm:px-6 rounded-3xl"
              [class.bg-primary-container]="isPositiveBalance()"
              [class.bg-error-container]="!isPositiveBalance()"
            >
              <p
                class="text-body-large mb-3"
                [class.text-on-primary-container]="isPositiveBalance()"
                [class.text-on-error-container]="!isPositiveBalance()"
              >
                @if (isPositiveBalance()) {
                  {{ netBalanceLabel }}
                } @else {
                  {{ deficitLabel }}
                }
              </p>
              <div
                class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
                [class.text-on-primary-container]="isPositiveBalance()"
                [class.text-on-error-container]="!isPositiveBalance()"
              >
                {{ absNetBalance() | number: '1.0-0' : 'de-CH' }}
                <span class="text-headline-small font-normal">CHF</span>
              </div>
            </div>

            <!-- Pills: Income, Expenses, Savings -->
            <div
              class="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:justify-center scrollbar-hide"
            >
              @for (pill of financialPills(); track pill.testId) {
                <div
                  [attr.data-testid]="pill.testId"
                  class="snap-start flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full"
                  [style.background-color]="pill.bgStyle"
                >
                  <mat-icon [class]="'mat-icon-sm ' + pill.colorClass">{{
                    pill.icon
                  }}</mat-icon>
                  <div class="flex flex-col">
                    <span
                      class="text-label-small leading-tight text-on-financial-light"
                      >{{ pill.label }}</span
                    >
                    <span
                      [class]="
                        'text-label-large font-semibold ph-no-capture ' +
                        pill.colorClass
                      "
                    >
                      {{ pill.amount | number: '1.0-0' : 'de-CH' }}
                      CHF
                    </span>
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Transactions section -->
          <section
            class="flex flex-col flex-1 gap-4 min-h-0"
            aria-labelledby="transactions-heading"
          >
            <h2 id="transactions-heading" class="shrink-0 text-headline-small">
              {{ forecastsHeading }}
            </h2>

            <div class="flex-1 min-h-0 rounded-lg">
              <pulpe-transactions-table
                class="flex-1 min-h-0"
                [entries]="templateDetailsStore.entries()"
                role="table"
                [attr.aria-label]="forecastsTableLabel"
              />
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TemplateDetail implements OnInit {
  protected readonly templateDetailsStore = inject(TemplateDetailsStore);
  readonly #budgetTemplatesStore = inject(BudgetTemplatesStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #titleStrategy = inject(PulpeTitleStrategy);
  readonly #dialog = inject(MatDialog);
  readonly #injector = inject(Injector);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #destroyRef = inject(DestroyRef);
  readonly #transloco = inject(TranslocoService);

  protected readonly loadingMessage =
    this.#transloco.translate('template.loading');
  protected readonly loadingError = this.#transloco.translate(
    'template.loadingError',
  );
  protected readonly retryLoadingLabel = this.#transloco.translate(
    'template.retryLoading',
  );
  protected readonly retryLabel = this.#transloco.translate('common.retry');
  protected readonly backLabel =
    this.#transloco.translate('template.backLabel');
  protected readonly editLabel = this.#transloco.translate('common.edit');
  protected readonly editAriaLabel =
    this.#transloco.translate('template.editTitle');
  protected readonly deleteLabel = this.#transloco.translate('common.delete');
  protected readonly deleteAriaLabel = this.#transloco.translate(
    'template.deleteTitle',
  );
  protected readonly financialSummaryHeading = this.#transloco.translate(
    'template.financialSummary',
  );
  protected readonly netBalanceLabel = this.#transloco.translate(
    'template.netBalance',
  );
  protected readonly deficitLabel =
    this.#transloco.translate('template.deficit');
  protected readonly forecastsHeading = this.#transloco.translate(
    'template.forecastsHeading',
  );
  protected readonly forecastsTableLabel = this.#transloco.translate(
    'template.forecastsTableLabel',
  );
  ngOnInit(): void {
    const templateId = this.#route.snapshot.paramMap.get('templateId');
    if (!templateId) return;

    this.templateDetailsStore.initializeTemplateId(templateId);
  }

  get #templateId(): string | null {
    return this.#route.snapshot.paramMap.get('templateId');
  }

  readonly absNetBalance = computed(() =>
    Math.abs(this.templateDetailsStore.netBalance()),
  );

  protected readonly isPositiveBalance = computed(
    () => this.templateDetailsStore.netBalance() >= 0,
  );

  readonly #incomeLabel = this.#transloco.translate('template.incomeLabel');
  readonly #expensesLabel = this.#transloco.translate('template.expensesLabel');
  readonly #savingsLabel = this.#transloco.translate('template.savingsLabel');

  readonly financialPills = computed(() => {
    const t = this.templateDetailsStore.totals();
    return [
      {
        testId: 'income-pill',
        bgStyle: 'var(--pulpe-financial-income-light)',
        colorClass: 'text-financial-income',
        icon: 'trending_up',
        label: this.#incomeLabel,
        amount: t.income,
      },
      {
        testId: 'expense-pill',
        bgStyle: 'var(--pulpe-financial-expense-light)',
        colorClass: 'text-financial-expense',
        icon: 'trending_down',
        label: this.#expensesLabel,
        amount: t.expense,
      },
      {
        testId: 'savings-pill',
        bgStyle: 'var(--pulpe-financial-savings-light)',
        colorClass: 'text-financial-savings',
        icon: 'savings',
        label: this.#savingsLabel,
        amount: t.savings,
      },
    ];
  });

  constructor() {
    // Mettre à jour le titre de la page avec le nom du modèle
    effect(() => {
      const template = this.templateDetailsStore.template();
      if (template && template.name) {
        this.#titleStrategy.setTitle(template.name);
      }
    });
  }

  navigateBack() {
    this.#router.navigate(['/', ROUTES.BUDGET_TEMPLATES]);
  }

  editTemplate() {
    const template = this.templateDetailsStore.template();
    const transactions = this.templateDetailsStore.transactions();
    const templateId = this.#templateId;

    if (!template || !transactions || !templateId) {
      return;
    }

    // Store original template lines for ID mapping
    const originalTemplateLines = transactions;

    const transactionData = originalTemplateLines.map(
      (transaction: TemplateLine) => ({
        description: transaction.name,
        amount: transaction.amount,
        type: transaction.kind,
      }),
    );

    const dialogRef = this.#dialog.open(EditTransactionsDialog, {
      data: {
        transactions: transactionData,
        templateName: template.name,
        templateId: templateId,
        originalTemplateLines,
      },
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh',
      maxHeight: '90vh',
      disableClose: false, // Dialog now handles its own close protection during loading
      autoFocus: true,
      restoreFocus: true,
      injector: this.#injector,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((dialogResult) => {
        if (dialogResult?.saved) {
          const propagation = dialogResult.propagation ?? null;

          if (propagation) {
            // Reload to sync with server state when changes were applied
            this.templateDetailsStore.reloadTemplateDetails();
          }

          const message = this.#buildSuccessMessage(propagation);
          this.#snackBar.open(message, undefined, {
            duration: 4000,
          });
        } else if (dialogResult?.error) {
          this.#logger.error(
            'Erreur lors de la sauvegarde:',
            dialogResult.error,
          );
          // Error is already handled by the dialog with user-friendly messages
        }
      });
  }

  async deleteTemplate() {
    const template = this.templateDetailsStore.template();
    const templateId = this.#templateId;
    if (!template || !templateId) {
      return;
    }

    try {
      // First check if template is being used
      const usageData = await this.templateDetailsStore.checkUsage(templateId);

      if (usageData.isUsed) {
        // Show dialog with list of budgets using this template
        const dialogRef = this.#dialog.open(TemplateUsageDialogComponent, {
          data: {
            templateId: templateId,
            templateName: template.name,
          },
          width: '90vw',
          maxWidth: '600px',
          disableClose: false,
        });

        // Set the usage data after opening the dialog
        const dialogInstance = dialogRef.componentInstance;
        dialogInstance.setUsageData(usageData.budgets);
      } else {
        // Template is not used, show confirmation dialog
        const dialogRef = this.#dialog.open(ConfirmationDialog, {
          data: {
            title: this.#transloco.translate('template.deleteTitle'),
            message: this.#transloco.translate('template.deleteConfirm', {
              name: template.name,
            }),
            confirmText: this.#transloco.translate('common.delete'),
            cancelText: this.#transloco.translate('common.cancel'),
            confirmColor: 'warn' as const,
          },
          width: '400px',
        });

        const confirmed = await firstValueFrom(dialogRef.afterClosed());
        if (confirmed) {
          await this.#performDeletion();
        }
      }
    } catch (error) {
      this.#logger.error('Error checking template usage:', error);
      this.#snackBar.open(
        this.#transloco.translate('template.verificationCheckError'),
        this.#transloco.translate('common.close'),
        {
          duration: 5000,
        },
      );
    }
  }

  #buildSuccessMessage(
    propagation: TemplateLinesPropagationSummary | null,
  ): string {
    if (!propagation) {
      return this.#transloco.translate('template.noChanges');
    }

    if (propagation.mode !== 'propagate') {
      return this.#transloco.translate('template.updatedWithoutBudgets');
    }
    if (propagation.affectedBudgetsCount > 0) {
      const key =
        propagation.affectedBudgetsCount === 1
          ? 'template.updatedWithBudgetsSingular'
          : 'template.updatedWithBudgetsPlural';
      return this.#transloco.translate(key, {
        count: propagation.affectedBudgetsCount,
      });
    }
    return this.#transloco.translate('template.updatedWithoutBudgets');
  }

  async #performDeletion() {
    const templateId = this.#templateId;
    if (!templateId) {
      return;
    }

    await this.#budgetTemplatesStore.deleteTemplate.mutate(templateId);

    if (this.#budgetTemplatesStore.deleteTemplate.error()) {
      this.#logger.error(
        'Error deleting template:',
        this.#budgetTemplatesStore.deleteTemplate.error(),
      );
      this.#snackBar.open(
        this.#transloco.translate('template.deleteCheckError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
      return;
    }

    this.#snackBar.open(
      this.#transloco.translate('template.deleted'),
      undefined,
      { duration: 3000 },
    );
    this.navigateBack();
  }
}
