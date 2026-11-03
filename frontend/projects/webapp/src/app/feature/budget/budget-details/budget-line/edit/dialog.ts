import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
  signal,
} from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import {
  FEATURE_FLAGS,
  type BudgetLine,
  type BudgetLineUpdate,
  type BudgetPeriod,
  type TransactionKind,
  type TransactionRecurrence,
} from 'pulpe-shared';
import { TranslocoPipe } from '@jsverse/transloco';
import { TransactionIconPipe } from '@ui/transaction-display';
import { TransactionLabelPipe } from '@ui/transaction-display';
import {
  applyAmountValidators,
  type AmountFormSlice,
  createInitialAmountSlice,
  CurrencyConverterService,
  isCurrencyPickerVisible,
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsStore } from '@core/user-settings';
import { Logger } from '@core/logging/logger';
import { touchedFieldErrors } from '@core/validators';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { TagPicker } from '@app/pattern/tag-picker/tag-picker';
import {
  AssetPickerField,
  assetDirectionForKind,
  injectNetWorthResource,
} from '@app/pattern/asset-picker/asset-picker-field';
import { SavingsGoalPickerField } from '@app/pattern/savings-goal-picker/savings-goal-picker-field';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { budgetLineUpdateFromFormSchema } from './dialog.schema';

export interface EditBudgetLineDialogData {
  budgetLine: BudgetLine;
  /** Period of the budget the line belongs to — bounds its savings-goal links. */
  budgetPeriod: BudgetPeriod;
}

interface EditBudgetLineModel {
  name: string;
  money: AmountFormSlice;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  tagIds: string[];
  savingsGoalId: string | null;
  assetId: string | null;
}

@Component({
  selector: 'pulpe-edit-budget-line-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    FormField,
    AmountInput,
    TagPicker,
    SavingsGoalPickerField,
    AssetPickerField,
    SavingsGoalSourceLine,
  ],
  host: { 'data-testid': 'edit-budget-line-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.editForecast' | transloco }}
    </h2>

    <mat-dialog-content>
      <div class="pt-4">
        <div class="flex flex-col gap-4">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastNameLabel' | transloco }}</mat-label>
            <input
              matInput
              [formField]="editForm.name"
              [placeholder]="'budget.forecastNamePlaceholder' | transloco"
              data-testid="edit-line-name"
            />
            @if (nameErrors().required) {
              <mat-error>{{
                'budget.forecastNameRequired' | transloco
              }}</mat-error>
            } @else if (nameErrors().minLength) {
              <mat-error>{{
                'budget.forecastNameMinLength' | transloco
              }}</mat-error>
            }
          </mat-form-field>

          <pulpe-amount-input
            [control]="editForm.money"
            mode="edit"
            [originalCurrency]="originalCurrency"
          />

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select
              [formField]="editForm.kind"
              (selectionChange)="onKindChange()"
              data-testid="edit-line-kind"
            >
              <mat-option value="income">
                <mat-icon class="text-financial-income">{{
                  'income' | transactionIcon
                }}</mat-icon>
                <span>{{ 'income' | transactionLabel }}</span>
              </mat-option>
              <mat-option value="expense">
                <mat-icon class="text-financial-negative">{{
                  'expense' | transactionIcon
                }}</mat-icon>
                <span>{{ 'expense' | transactionLabel }}</span>
              </mat-option>
              <mat-option value="saving">
                <mat-icon class="text-primary">{{
                  'saving' | transactionIcon
                }}</mat-icon>
                <span>{{ 'saving' | transactionLabel }}</span>
              </mat-option>
            </mat-select>
            @if (kindErrors().required) {
              <mat-error>{{
                'budget.forecastTypeRequired' | transloco
              }}</mat-error>
            }
          </mat-form-field>

          <pulpe-tag-picker [control]="editForm.tagIds" />
          @if (model().kind === 'saving') {
            <pulpe-savings-goal-picker-field
              [value]="model().savingsGoalId"
              [budgetPeriod]="budgetPeriod"
              (valueChanged)="
                model.update((m) => ({ ...m, savingsGoalId: $event }))
              "
            />
          }
          @if (assetDirection(); as direction) {
            <pulpe-asset-picker-field
              [direction]="direction"
              [value]="model().assetId"
              (valueChanged)="model.update((m) => ({ ...m, assetId: $event }))"
            />
          }
          <!--
            L'origine est en lecture seule : aucune API ne déplace un retrait
            d'un objectif à un autre. Un second sélecteur laisserait croire
            qu'elle se change.
          -->
          @if (sourceSavingsGoalName) {
            <pulpe-savings-goal-source-line
              variant="detail"
              [goalId]="sourceSavingsGoalId"
              [goalName]="sourceSavingsGoalName"
            />
          }
          <!--
            Même règle pour un revenu tiré du patrimoine : son origine se fixe
            à la création, aucune API ne la déplace.
          -->
          @if (originAssetName(); as assetName) {
            <span
              class="inline-flex items-center gap-1 min-w-0 text-on-surface-variant"
              data-testid="asset-origin-line"
            >
              <mat-icon
                class="text-sm! shrink-0 h-auto! w-auto!"
                aria-hidden="true"
                >account_balance_wallet</mat-icon
              >
              <span>
                {{ 'netWorth.link.drawnFrom' | transloco }}
                · <span class="ph-no-capture">{{ assetName }}</span>
              </span>
            </span>
          }
        </div>
      </div>
    </mat-dialog-content>

    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small px-6 pb-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
    <mat-dialog-actions align="end">
      <button matButton (click)="handleCancel()" data-testid="cancel-edit-line">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="handleSubmit()"
        [disabled]="!canSubmit()"
        data-testid="save-edit-line"
      >
        <mat-icon>save</mat-icon>
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditBudgetLineDialog {
  readonly #dialogRef = inject(MatDialogRef<EditBudgetLineDialog>);
  readonly #data = inject<EditBudgetLineDialogData>(MAT_DIALOG_DATA);
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #staleRateNotifier = inject(StaleRateNotifier);
  readonly #isAssetLinkEnabled = inject(PostHogService).isFeatureEnabled(
    FEATURE_FLAGS.NET_WORTH,
  );

  protected readonly originalCurrency =
    this.#data.budgetLine.originalCurrency ?? null;

  protected readonly budgetPeriod = this.#data.budgetPeriod;

  protected readonly sourceSavingsGoalId =
    this.#data.budgetLine.sourceSavingsGoalId ?? null;
  protected readonly sourceSavingsGoalName =
    this.#data.budgetLine.sourceSavingsGoalName ?? null;

  protected readonly showCurrencySelector = computed(() =>
    isCurrencyPickerVisible({
      originalCurrency: this.originalCurrency,
      userCurrency: this.#settings.currency(),
    }),
  );

  protected readonly model = signal<EditBudgetLineModel>({
    name: this.#data.budgetLine.name,
    money: this.#computeInitialSlice(),
    kind: this.#data.budgetLine.kind,
    recurrence: this.#data.budgetLine.recurrence,
    tagIds: this.#data.budgetLine.tagIds ?? [],
    savingsGoalId: this.#data.budgetLine.savingsGoalId,
    assetId: this.#data.budgetLine.assetId,
  });

  protected readonly editForm = form(this.model, (path) => {
    required(path.name, { message: 'budget.forecastNameRequired' });
    minLength(path.name, 2, { message: 'budget.forecastNameMinLength' });
    applyAmountValidators(path.money);
    required(path.kind, { message: 'budget.forecastTypeRequired' });
    required(path.recurrence);
  });

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly canSubmit = computed(
    () => this.editForm().valid() && !this.isSubmitting(),
  );

  // Which assets the kind can be linked to; null hides the field (flag off, or
  // a Revenu: its asset origin is read-only here).
  protected readonly assetDirection = computed(() =>
    this.#isAssetLinkEnabled ? assetDirectionForKind(this.model().kind) : null,
  );

  // The origin line only names a link the Revenu already had on opening, so the
  // net-worth read (same cached one as the picker) is made for that case alone.
  readonly #netWorth =
    this.#isAssetLinkEnabled &&
    this.#data.budgetLine.kind === 'income' &&
    this.#data.budgetLine.assetId
      ? injectNetWorthResource()
      : null;
  protected readonly originAssetName = computed(() => {
    const { kind, assetId } = this.model();
    if (kind !== 'income') return null;
    return (
      this.#netWorth?.value()?.assets.find((asset) => asset.id === assetId)
        ?.name ?? null
    );
  });

  // Épargne and Dépense list different assets: a pick never survives the switch.
  protected onKindChange(): void {
    this.model.update((model) => ({ ...model, assetId: null }));
  }

  protected readonly nameErrors = touchedFieldErrors(
    () => this.editForm.name,
    'required',
    'minLength',
  );
  protected readonly kindErrors = touchedFieldErrors(
    () => this.editForm.kind,
    'required',
  );

  #computeInitialSlice(): AmountFormSlice {
    const line = this.#data.budgetLine;
    return createInitialAmountSlice({
      isPickerVisible: this.showCurrencySelector(),
      originalAmount: line.originalAmount,
      originalCurrency: line.originalCurrency,
      fallbackAmount: line.amount,
      userCurrency: this.#settings.currency(),
    });
  }

  async handleSubmit(): Promise<void> {
    await runFormSubmit({
      form: this.editForm,
      isSubmitting: this.isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        return {
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata): BudgetLineUpdate => {
            const formPart = budgetLineUpdateFromFormSchema.parse({
              name: m.name,
              amount,
              kind: m.kind,
              recurrence: m.recurrence,
              tagIds: m.tagIds,
              savingsGoalId: m.kind === 'saving' ? m.savingsGoalId : null,
              assetId: this.#isAssetLinkEnabled ? m.assetId : undefined,
              conversion: metadata,
            });
            return {
              id: this.#data.budgetLine.id,
              templateLineId: this.#data.budgetLine.templateLineId,
              ...formPart,
            };
          },
        };
      },
      onSuccess: (value, outcome) => {
        this.#staleRateNotifier.notify(outcome);
        this.#dialogRef.close(value);
      },
    });
  }

  handleCancel(): void {
    this.#dialogRef.close();
  }
}
