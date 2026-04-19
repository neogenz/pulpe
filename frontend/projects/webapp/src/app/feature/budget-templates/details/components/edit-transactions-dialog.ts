import { AppCurrencyPipe, CURRENCY_CONFIG } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrencySuffix } from '@ui/currency-suffix';
import {
  type TemplateLine,
  type TemplateLinesPropagationSummary,
} from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { firstValueFrom } from 'rxjs';
import {
  getTransactionTypes,
  type TransactionFormData,
} from '../../services/transaction-form';
import { type EditableLine } from '../services/template-line-state';
import { TemplateLineStore } from '../services/template-line-store';
import {
  TemplatePropagationDialog,
  type TemplatePropagationChoice,
} from './template-propagation-dialog';

interface EditTransactionsDialogData {
  transactions: TransactionFormData[];
  templateName: string;
  templateId: string;
  originalTemplateLines: TemplateLine[];
}

interface EditTransactionsDialogResult {
  saved: boolean;
  updatedLines?: TemplateLine[];
  deletedIds?: string[];
  error?: string;
  propagation?: TemplateLinesPropagationSummary | null;
}

@Component({
  selector: 'pulpe-edit-transactions-dialog',
  imports: [
    AppCurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    TranslocoPipe,
    CurrencySuffix,
  ],
  providers: [TemplateLineStore],
  template: `
    <h2 mat-dialog-title class="flex gap-2 items-center">
      <mat-icon class="text-primary">edit</mat-icon>
      <span
        >{{ 'template.editTitle' | transloco }} -
        <span class="ph-no-capture">{{ data.templateName }}</span></span
      >
    </h2>

    <mat-dialog-content class="!p-0">
      <!-- Progress bar at the top when loading -->
      @if (isLoading()) {
        <mat-progress-bar
          mode="indeterminate"
          class="!h-1"
          [attr.aria-label]="saveLoadingLabel"
        ></mat-progress-bar>
      }

      <div class="flex flex-col h-full">
        <!-- Fixed header -->
        <div class="flex-shrink-0 p-4 border-b border-outline-variant">
          <div class="flex justify-between items-center">
            <p class="text-body-large">
              {{ transactions().length }} transaction(s)
            </p>
            <button
              matButton="tonal"
              (click)="addNewTransaction()"
              [disabled]="isLoading()"
              class="items-center"
            >
              <mat-icon>add</mat-icon>
              {{ 'template.addTransaction' | transloco }}
            </button>
          </div>
        </div>

        <!-- Table container with fixed height -->
        <div class="overflow-auto flex-1 relative">
          <!-- Subtle loading overlay that preserves data visibility -->
          @if (isLoading()) {
            <div
              class="absolute inset-0 bg-surface/20 z-10"
              aria-hidden="true"
            ></div>
          }

          <table
            mat-table
            [dataSource]="transactions()"
            [trackBy]="trackByTransactionId"
            class="w-full"
            [class.pointer-events-none]="isLoading()"
          >
            <!-- Description Column -->
            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>
                {{ 'template.colDescription' | transloco }}
              </th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    [value]="transaction.formData.description"
                    (input)="updateDescription(transaction.id, $event)"
                    [placeholder]="descriptionPlaceholder"
                    [attr.id]="'desc-' + transaction.id"
                    data-testid="edit-line-description"
                  />
                  @if (!transaction.formData.description?.trim()) {
                    <mat-error>{{
                      'template.descriptionRequired' | transloco
                    }}</mat-error>
                  }
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Amount Column -->
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>
                <span class="ph-no-capture">{{
                  'template.colAmount' | transloco
                }}</span>
              </th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    type="number"
                    class="ph-no-capture"
                    step="0.01"
                    min="0"
                    max="999999"
                    inputmode="decimal"
                    [value]="transaction.formData.amount"
                    (input)="updateAmount(transaction.id, $event)"
                    placeholder="0.00"
                    [attr.id]="'amount-' + transaction.id"
                    data-testid="edit-line-amount"
                  />
                  <pulpe-currency-suffix
                    matTextSuffix
                    [showSelector]="false"
                    [currency]="currency()"
                  />
                  @if (transaction.formData.amount < 0) {
                    <mat-error>{{
                      'template.amountPositive' | transloco
                    }}</mat-error>
                  }
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Type Column -->
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>
                {{ 'template.colType' | transloco }}
              </th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <mat-select
                    [value]="transaction.formData.type"
                    (selectionChange)="updateType(transaction.id, $event.value)"
                    [attr.id]="'type-' + transaction.id"
                    data-testid="edit-line-type"
                  >
                    @for (type of transactionTypes; track type.value) {
                      <mat-option [value]="type.value">
                        {{ type.label }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </td>
            </ng-container>

            <!-- Total Column -->
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>
                {{ 'template.colTotal' | transloco }}
              </th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4 text-right"
              >
                <span
                  [class.text-financial-income]="runningTotals()[i] >= 0"
                  [class.text-financial-negative]="runningTotals()[i] < 0"
                  class="font-medium ph-no-capture"
                >
                  {{ runningTotals()[i] | appCurrency: currency() }}
                </span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-center">
                {{ 'template.colActions' | transloco }}
              </th>
              <td
                mat-cell
                *matCellDef="let transaction; let i = index"
                class="!p-4"
              >
                <button
                  matIconButton
                  color="warn"
                  (click)="removeTransaction(transaction.id)"
                  [disabled]="!canRemoveTransaction() || isLoading()"
                  [attr.aria-disabled]="!canRemoveTransaction() || isLoading()"
                  [matTooltip]="
                    !canRemoveTransaction()
                      ? minLineRequiredTooltip
                      : deleteLineTooltip
                  "
                  matTooltipPosition="left"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr
              mat-header-row
              *matHeaderRowDef="displayedColumns; sticky: true"
            ></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: displayedColumns; let odd = odd"
              [class.!bg-surface-container-highest]="odd"
            ></tr>
          </table>
        </div>

        <!-- Error message display -->
        @if (errorMessage(); as error) {
          <div
            class="p-4 mt-4 bg-error-container rounded-lg"
            role="alert"
            aria-live="polite"
          >
            <div class="flex items-center gap-2">
              <mat-icon class="text-error" aria-hidden="true">error</mat-icon>
              <span class="text-on-error-container">{{ error }}</span>
            </div>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" [disabled]="isLoading()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="save()"
        [disabled]="!isValid() || isLoading()"
        [attr.aria-describedby]="!isValid() ? 'validation-error' : null"
      >
        <div class="flex items-center gap-2">
          @if (isLoading()) {
            <mat-spinner
              diameter="16"
              strokeWidth="2"
              aria-hidden="true"
            ></mat-spinner>
          }
          <span>{{ 'common.save' | transloco }}</span>
        </div>
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      --mat-table-background-color: var(--mat-sys-surface-container-high);
      .mat-mdc-dialog-content {
        max-height: unset;
      }
    }

    /* Clean Mat-Table styling - let Material handle sticky headers */
    .mat-column-description {
      width: 100%;
    }
    .mat-column-amount {
      width: min-content;
    }
    .mat-column-type {
      width: min-content;
    }
    .mat-column-total {
      width: min-content;
      text-align: right;
    }
    .mat-column-actions {
      width: min-content;
    }

    /* Properly align spinner and text in Material button */
    .save-button {
      .mdc-button__label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EditTransactionsDialog {
  readonly #dialogRef = inject(MatDialogRef<EditTransactionsDialog>);
  readonly #dialog = inject(MatDialog);
  readonly #store = inject(TemplateLineStore);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly data = inject<EditTransactionsDialogData>(MAT_DIALOG_DATA);

  protected readonly saveLoadingLabel = this.#transloco.translate(
    'template.saveLoading',
  );
  protected readonly descriptionPlaceholder = this.#transloco.translate(
    'template.descriptionPlaceholder',
  );
  protected readonly minLineRequiredTooltip = this.#transloco.translate(
    'template.minLineRequired',
  );
  protected readonly deleteLineTooltip = this.#transloco.translate(
    'template.deleteLine',
  );
  protected readonly currency = this.#userSettings.currency;
  protected readonly currencySymbol = computed(
    () => CURRENCY_CONFIG[this.#userSettings.currency()].symbol,
  );

  /**
   * The bulk template edit dialog is mono-currency only. Existing alternate-
   * currency lines still render their stored target-currency `amount` and are
   * preserved intact by the backend PATCH semantics when fields other than
   * `amount` change. Per-row multi-currency editing is tracked as a follow-up.
   */
  protected readonly isLoading = this.#store.isLoading;
  protected readonly errorMessage = this.#store.error;
  protected readonly hasUnsavedChanges = this.#store.hasUnsavedChanges;
  protected readonly canRemoveTransaction = this.#store.canRemoveTransaction;
  protected readonly isValid = this.#store.isValid;

  protected readonly transactions = this.#store.activeLines;

  protected readonly displayedColumns: readonly string[] = [
    'description',
    'amount',
    'type',
    'total',
    'actions',
  ];
  protected readonly transactionTypes = getTransactionTypes();

  constructor() {
    this.#store.initialize(
      this.data.originalTemplateLines,
      this.data.transactions,
    );

    this.#dialogRef.disableClose = true;
  }

  protected async removeTransaction(id: string): Promise<void> {
    if (!this.canRemoveTransaction()) {
      return;
    }

    // Show confirmation dialog
    const confirmed = await this.#showConfirmationDialog();
    if (!confirmed) {
      return;
    }

    // Remove transaction by ID
    this.#store.removeTransaction(id);
  }

  protected addNewTransaction(): void {
    this.#store.addTransaction({
      description: '',
      amount: 0,
      type: 'expense',
    });
  }

  protected async save(): Promise<void> {
    if (this.isLoading() || !this.isValid()) return;

    if (!this.hasUnsavedChanges()) {
      this.#dialogRef.close({
        saved: true,
        updatedLines: [],
        deletedIds: [],
        propagation: null,
      } as EditTransactionsDialogResult);
      return;
    }

    const propagationChoice = await this.#askPropagationStrategy();
    if (!propagationChoice) {
      return;
    }

    const propagateToBudgets = propagationChoice === 'propagate';

    // Bulk edit is mono-currency: amounts stay as entered (in the user's
    // currency), and no currency metadata is touched — the backend PATCH
    // preserves any existing originalAmount / originalCurrency /
    // targetCurrency / exchangeRate stored per line.
    const result = await this.#store.saveChanges(
      this.data.templateId,
      propagateToBudgets,
    );

    if (!result.success) return;

    const propagationSummary: TemplateLinesPropagationSummary | null =
      result.propagation ??
      ({
        mode: propagateToBudgets ? 'propagate' : 'template-only',
        affectedBudgetIds: [],
        affectedBudgetsCount: 0,
      } as TemplateLinesPropagationSummary);

    this.#dialogRef.close({
      saved: true,
      updatedLines: result.updatedLines,
      deletedIds: result.deletedIds,
      propagation: propagationSummary,
    } as EditTransactionsDialogResult);
  }

  protected cancel(): void {
    if (this.isLoading()) return;

    this.#dialogRef.close({ saved: false } as EditTransactionsDialogResult);
  }

  protected readonly runningTotals = computed(() => {
    let runningTotal = 0;
    return this.transactions().map((transaction) => {
      const amount = transaction.formData.amount;
      const type = transaction.formData.type;

      switch (type) {
        case 'income':
        case 'saving':
          runningTotal += amount;
          break;
        case 'expense':
          runningTotal -= amount;
          break;
      }

      return runningTotal;
    });
  });

  protected updateDescription(id: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.#store.updateTransaction(id, {
      description: value,
    });
  }

  protected updateAmount(id: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.#store.updateTransaction(id, { amount: value });
  }

  protected updateType(id: string, value: TransactionFormData['type']): void {
    this.#store.updateTransaction(id, { type: value });
  }

  protected trackByTransactionId = (
    _index: number,
    transaction: EditableLine,
  ): string => {
    return transaction.id;
  };

  async #showConfirmationDialog(): Promise<boolean> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('template.confirmDeleteLine'),
        message: this.#transloco.translate('template.confirmDeleteLineMessage'),
        confirmText: this.#transloco.translate('common.delete'),
        cancelText: this.#transloco.translate('common.cancel'),
        confirmColor: 'warn',
      } as ConfirmationDialogData,
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result || false;
  }

  async #askPropagationStrategy(): Promise<TemplatePropagationChoice | null> {
    const dialogRef = this.#dialog.open(TemplatePropagationDialog, {
      width: '640px',
      maxWidth: '95vw',
      data: {
        templateName: this.data.templateName,
      },
      disableClose: true,
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result ?? null;
  }
}
