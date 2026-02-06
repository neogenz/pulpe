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
import { DecimalPipe, NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { ROUTES } from '@core/routing';
import { Logger } from '@core/logging/logger';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import {
  type TemplateLine,
  type TemplateLinesPropagationSummary,
} from 'pulpe-shared';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { BaseLoading } from '@ui/loading';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { firstValueFrom } from 'rxjs';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';
import { getDeleteConfirmationConfig } from '../delete/template-delete-dialog';
import {
  BudgetTemplatesApi,
  type BudgetTemplateDetailViewModel,
} from '../services/budget-templates-api';
import {
  EditTransactionsDialog,
  TransactionsTable,
  type FinancialEntry,
} from './components';
import { TemplateDetailsStore } from './services/template-details-store';

@Component({
  selector: 'pulpe-template-detail',

  imports: [
    DecimalPipe,
    NgClass,
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
          message="Préparation du modèle..."
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
            <mat-icon class="mb-4 !text-4xl" aria-hidden="true">
              error_outline
            </mat-icon>
            <p class="text-body-large">
              Une erreur est survenue lors du chargement des détails du modèle.
            </p>
            <button
              matButton="outlined"
              (click)="templateDetailsStore.reloadTemplateDetails()"
              class="mt-4"
              aria-label="Réessayer le chargement"
            >
              Réessayer
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
              aria-label="Retour à la liste des modèles"
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
                aria-label="Modifier les transactions du modèle"
                data-testid="template-detail-edit-button-mobile"
              >
                <mat-icon>edit</mat-icon>
              </button>
              <button
                matIconButton
                color="warn"
                (click)="deleteTemplate()"
                aria-label="Supprimer le modèle"
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
                aria-label="Modifier les transactions du modèle"
                data-testid="template-detail-edit-button"
              >
                <mat-icon>edit</mat-icon>
                Modifier
              </button>
              <button
                matButton="filled"
                color="warn"
                (click)="deleteTemplate()"
                aria-label="Supprimer le modèle"
                data-testid="delete-template-detail-button"
              >
                <mat-icon>delete</mat-icon>
                Supprimer
              </button>
            </div>
          </header>

          <!-- Financial overview: Hero + Pills -->
          <section
            class="flex-shrink-0 space-y-6"
            aria-labelledby="financial-summary-heading"
          >
            <h2 id="financial-summary-heading" class="sr-only">
              Résumé financier du modèle
            </h2>

            <!-- Hero: Net balance -->
            <div
              class="text-center py-6 px-4 sm:py-8 sm:px-6 rounded-3xl"
              [class.bg-primary-container]="netBalance() >= 0"
              [class.bg-error-container]="netBalance() < 0"
            >
              <p
                class="text-body-large mb-3"
                [class.text-on-primary-container]="netBalance() >= 0"
                [class.text-on-error-container]="netBalance() < 0"
              >
                @if (netBalance() >= 0) {
                  Solde net du modèle
                } @else {
                  Déficit du modèle
                }
              </p>
              <div
                class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
                [class.text-on-primary-container]="netBalance() >= 0"
                [class.text-on-error-container]="netBalance() < 0"
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
                  <mat-icon class="mat-icon-sm" [ngClass]="pill.colorClass">{{
                    pill.icon
                  }}</mat-icon>
                  <div class="flex flex-col">
                    <span
                      class="text-label-small leading-tight text-on-financial-light"
                      >{{ pill.label }}</span
                    >
                    <span
                      class="text-label-large font-semibold ph-no-capture"
                      [ngClass]="pill.colorClass"
                    >
                      {{ pill.amount | number: '1.0-0' : 'de-CH' }} CHF
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
            <h2
              id="transactions-heading"
              class="flex-shrink-0 text-headline-small"
            >
              Prévisions du modèle
            </h2>

            <div class="flex-1 min-h-0 rounded-lg">
              <pulpe-transactions-table
                class="flex-1 min-h-0"
                [entries]="entries()"
                role="table"
                aria-label="Liste des transactions fixes du modèle"
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
  readonly templateDetailsStore = inject(TemplateDetailsStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #titleStrategy = inject(PulpeTitleStrategy);
  readonly #dialog = inject(MatDialog);
  readonly #injector = inject(Injector);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #destroyRef = inject(DestroyRef);
  ngOnInit(): void {
    const templateId = this.#route.snapshot.paramMap.get('templateId');
    if (!templateId) return;

    // Extract stale data from router state (if navigated from create page)
    // Note: Use history.state because getCurrentNavigation() returns null in ngOnInit
    // (navigation is already complete when component initializes)
    const staleData = history.state?.['initialData'] as
      | BudgetTemplateDetailViewModel
      | undefined;

    this.templateDetailsStore.initializeTemplateId(templateId, staleData);
  }

  get #templateId(): string | null {
    return this.#route.snapshot.paramMap.get('templateId');
  }

  // Define sort order for transaction kinds
  readonly #KIND_ORDER: Record<string, number> = {
    income: 1,
    saving: 2,
    expense: 3,
  } as const;

  readonly entries = computed<FinancialEntry[]>(() => {
    const transactions = this.templateDetailsStore.transactions();

    // Sort transactions by kind first, then by createdAt
    const sortedTransactions = [...transactions].sort((a, b) => {
      // First sort by kind (income → saving → expense)
      const kindDiff =
        (this.#KIND_ORDER[a.kind] ?? 999) - (this.#KIND_ORDER[b.kind] ?? 999);
      if (kindDiff !== 0) return kindDiff;

      // Then sort by createdAt (ascending)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return sortedTransactions.map((transaction: TemplateLine) => {
      const spent = transaction.kind === 'expense' ? transaction.amount : 0;
      const earned = transaction.kind === 'income' ? transaction.amount : 0;
      const saved = transaction.kind === 'saving' ? transaction.amount : 0;
      return {
        description: transaction.name,
        spent,
        earned,
        saved,
        total: earned - spent,
      };
    });
  });

  readonly totals = computed(() => {
    return this.entries().reduce(
      (acc, entry) => ({
        income: acc.income + entry.earned,
        expense: acc.expense + entry.spent,
        savings: acc.savings + entry.saved,
      }),
      { income: 0, expense: 0, savings: 0 },
    );
  });

  readonly netBalance = computed(() => {
    const t = this.totals();
    return t.income - t.expense - t.savings;
  });

  readonly absNetBalance = computed(() => Math.abs(this.netBalance()));

  readonly financialPills = computed(() => {
    const t = this.totals();
    return [
      {
        testId: 'income-pill',
        bgStyle: 'var(--pulpe-financial-income-light)',
        colorClass: 'text-financial-income',
        icon: 'trending_up',
        label: 'Revenus',
        amount: t.income,
      },
      {
        testId: 'expense-pill',
        bgStyle: 'var(--pulpe-financial-expense-light)',
        colorClass: 'text-financial-expense',
        icon: 'trending_down',
        label: 'Dépenses',
        amount: t.expense,
      },
      {
        testId: 'savings-pill',
        bgStyle: 'var(--pulpe-financial-savings-light)',
        colorClass: 'text-financial-savings',
        icon: 'savings',
        label: 'Épargne',
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
      const usageResponse = await firstValueFrom(
        this.#budgetTemplatesApi.checkUsage$(templateId),
      );

      if (usageResponse.data.isUsed) {
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
        dialogInstance.setUsageData(usageResponse.data.budgets);
      } else {
        // Template is not used, show confirmation dialog
        const dialogRef = this.#dialog.open(ConfirmationDialog, {
          data: getDeleteConfirmationConfig(template.name),
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
        'Une erreur est survenue lors de la vérification',
        'Fermer',
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
      return 'Aucune modification à enregistrer';
    }

    if (propagation.mode !== 'propagate') {
      return 'Modèle mis à jour (budgets non modifiés).';
    }
    if (propagation.affectedBudgetsCount > 0) {
      const plural = propagation.affectedBudgetsCount > 1 ? 's' : '';
      return `Modèle et budgets futurs mis à jour (${propagation.affectedBudgetsCount} budget${plural} ajusté${plural})`;
    }
    return 'Modèle mis à jour (budgets non modifiés).';
  }

  async #performDeletion() {
    const templateId = this.#templateId;
    if (!templateId) {
      return;
    }

    try {
      await firstValueFrom(this.#budgetTemplatesApi.delete$(templateId));

      this.#snackBar.open('Modèle supprimé avec succès', undefined, {
        duration: 3000,
      });

      // Navigate back to templates list
      this.navigateBack();
    } catch (error) {
      this.#logger.error('Error deleting template:', error);
      this.#snackBar.open(
        'Une erreur est survenue lors de la suppression',
        'Fermer',
        {
          duration: 5000,
        },
      );
    }
  }
}
