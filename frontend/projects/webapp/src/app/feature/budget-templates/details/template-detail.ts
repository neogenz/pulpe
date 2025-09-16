import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  effect,
  Injector,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BaseLoading } from '@ui/loading';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  type FinancialSummaryData,
  FinancialSummary,
} from '@ui/financial-summary/financial-summary';
import {
  TransactionsTable,
  type FinancialEntry,
  EditTransactionsDialog,
} from './components';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { type TemplateLine } from '@pulpe/shared';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { getDeleteConfirmationConfig } from '../delete/template-delete-dialog';
import { TemplateDetailsStore } from './services/template-details-store';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { Logger } from '@core/logging/logger';

@Component({
  selector: 'pulpe-template-detail',

  imports: [
    CommonModule,
    CurrencyPipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    FinancialSummary,
    TransactionsTable,
    BaseLoading,
  ],
  providers: [TemplateDetailsStore, TransactionIconPipe, TransactionLabelPipe],
  template: `
    <!-- Main container with proper surface container background -->
    <div
      class="flex flex-col gap-6 h-full p-4 md:p-6"
      data-testid="template-detail-page"
    >
      @if (templateDetailsStore.isLoading()) {
        <!-- Loading state with proper accessibility -->
        <pulpe-base-loading
          message="Chargement des détails du modèle..."
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
          <!-- Header section with proper semantic structure -->
          <header class="flex flex-shrink-0 gap-4 items-center rounded-xl p-4">
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
                class="text-display-small truncate"
                [title]="templateData.template.name"
                data-testid="page-title"
              >
                {{ templateData.template.name }}
              </h1>
            </div>
          </header>

          <!-- Financial summary cards with responsive grid -->
          <section
            class="flex-shrink-0"
            aria-labelledby="financial-summary-heading"
          >
            <h2 id="financial-summary-heading" class="sr-only">
              Résumé financier du modèle
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <pulpe-financial-summary
                [data]="incomeData()"
                role="region"
                [attr.aria-label]="
                  'Revenus: ' +
                  (incomeData().amount
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH')
                "
              />
              <pulpe-financial-summary
                [data]="expenseData()"
                role="region"
                [attr.aria-label]="
                  'Dépenses: ' +
                  (expenseData().amount
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH')
                "
              />
              <pulpe-financial-summary
                [data]="savingsData()"
                role="region"
                [attr.aria-label]="
                  'Économies: ' +
                  (savingsData().amount
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH')
                "
              />
              <pulpe-financial-summary
                [data]="netBalanceData()"
                role="region"
                [attr.aria-label]="
                  netBalanceData().title +
                  ': ' +
                  (netBalanceData().amount
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH')
                "
              />
            </div>
          </section>

          <!-- Transactions section with proper surface container -->
          <section
            class="flex flex-col flex-1 gap-4 min-h-0 rounded-xl p-4"
            aria-labelledby="transactions-heading"
          >
            <div class="flex gap-4 justify-between items-center">
              <h2
                id="transactions-heading"
                class="flex-shrink-0 text-headline-small"
              >
                Dépenses récurrentes
              </h2>
              <button
                matIconButton
                [matMenuTriggerFor]="transactionsMenu"
                aria-label="Options pour les transactions"
                aria-haspopup="menu"
                [attr.aria-expanded]="false"
                data-testid="template-detail-menu-trigger"
              >
                <mat-icon>more_vert</mat-icon>
              </button>

              <mat-menu
                #transactionsMenu="matMenu"
                aria-label="Menu des options"
              >
                <button
                  mat-menu-item
                  (click)="editTemplate()"
                  aria-label="Éditer les transactions du modèle"
                >
                  <mat-icon aria-hidden="true">edit</mat-icon>
                  <span>Éditer</span>
                </button>
                <button
                  mat-menu-item
                  (click)="deleteTemplate()"
                  aria-label="Supprimer le modèle"
                  class="text-error"
                  data-testid="delete-template-detail-menu-item"
                >
                  <mat-icon aria-hidden="true" class="text-error"
                    >delete</mat-icon
                  >
                  <span>Supprimer</span>
                </button>
              </mat-menu>
            </div>

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
      height: 100%;
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
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transactionIconPipe = inject(TransactionIconPipe);
  readonly #transactionLabelPipe = inject(TransactionLabelPipe);
  readonly #logger = inject(Logger);
  ngOnInit(): void {
    // Get template ID from route parameters
    const templateId = this.#route.snapshot.paramMap.get('templateId');
    if (templateId) {
      this.templateDetailsStore.initializeTemplateId(templateId);
    }
  }

  private get templateId(): string | null {
    return this.#route.snapshot.paramMap.get('templateId');
  }

  // Reactive breakpoint detection with proper signal integration
  readonly isHandset = toSignal(
    this.#breakpointObserver
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  readonly entries = computed<FinancialEntry[]>(() => {
    const transactions = this.templateDetailsStore.transactions();
    return transactions.map((transaction: TemplateLine) => {
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

  // Optimized: Single pass through entries for all totals
  readonly #totals = computed(() => {
    return this.entries().reduce(
      (acc, entry) => ({
        income: acc.income + entry.earned,
        expense: acc.expense + entry.spent,
        savings: acc.savings + entry.saved,
      }),
      { income: 0, expense: 0, savings: 0 },
    );
  });

  readonly incomeData = computed<FinancialSummaryData>(() => ({
    title: this.#transactionLabelPipe.transform('income') + 's',
    amount: this.#totals().income,
    icon: this.#transactionIconPipe.transform('income'),
    type: 'income',
    isClickable: false,
  }));

  readonly expenseData = computed<FinancialSummaryData>(() => ({
    title: this.#transactionLabelPipe.transform('expense') + 's',
    amount: this.#totals().expense,
    icon: this.#transactionIconPipe.transform('expense'),
    type: 'expense',
  }));

  readonly savingsData = computed<FinancialSummaryData>(() => ({
    title: this.#transactionLabelPipe.transform('saving') + ' prévue',
    amount: this.#totals().savings,
    icon: this.#transactionIconPipe.transform('saving'),
    type: 'savings',
  }));

  readonly netBalanceData = computed<FinancialSummaryData>(() => {
    const totals = this.#totals();
    const total = totals.income - totals.expense;
    return {
      title: total >= 0 ? 'Solde net' : 'Déficit',
      amount: total,
      icon: total >= 0 ? 'account_balance_wallet' : 'money_off',
      type: total >= 0 ? 'income' : 'negative',
    };
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
    this.#router.navigate(['..'], { relativeTo: this.#route });
  }

  editTemplate() {
    const template = this.templateDetailsStore.template();
    const transactions = this.templateDetailsStore.transactions();
    const templateId = this.templateId;

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

    dialogRef.afterClosed().subscribe((dialogResult) => {
      if (dialogResult?.saved) {
        // Simply reload the data from the server to get the latest state
        // This is simpler and ensures we have the exact server state
        this.templateDetailsStore.reloadTemplateDetails();

        // Show success feedback
        this.#snackBar.open('Modèle mis à jour avec succès', undefined, {
          duration: 3000,
        });
      } else if (dialogResult?.error) {
        this.#logger.error('Erreur lors de la sauvegarde:', dialogResult.error);
        // Error is already handled by the dialog with user-friendly messages
      }
    });
  }

  async deleteTemplate() {
    const template = this.templateDetailsStore.template();
    const templateId = this.templateId;
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

  async #performDeletion() {
    const templateId = this.templateId;
    if (!templateId) {
      return;
    }

    try {
      await firstValueFrom(this.#budgetTemplatesApi.delete$(templateId));

      this.#snackBar.open('Modèle supprimé avec succès', undefined, {
        duration: 3000,
      });

      // Navigate back to templates list
      this.#router.navigate(['/app/budget-templates']);
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
