import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  required,
  validate,
} from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { cachedResource } from 'ngx-ziflux';
import { map } from 'rxjs';
import {
  type BudgetLine,
  type SavingsGoalProgress,
  type TransactionCreate,
} from 'pulpe-shared';

import { transactionCreateFromFormSchema } from '../../components/edit-transaction-form';
import { formatLocalDate } from '@core/date/format-local-date';
import {
  applyAmountValidators,
  type AmountFormSlice,
  AppCurrencyPipe,
  createAmountSlice,
  CurrencyConverterService,
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { SavingsGoalApi } from '@core/savings-goal/savings-goal-api';
import { UserSettingsStore } from '@core/user-settings';
import { touchedFieldErrors } from '@core/validators';
import { Logger } from '@core/logging/logger';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { TagPicker } from '@app/pattern/tag-picker/tag-picker';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { computeBudgetPeriodDateConstraints } from './budget-period-date-constraints';

/**
 * PUL-329 v2 — contexte de réalisation d'un retrait annoncé. Présent seulement
 * quand la ligne porte une source : le formulaire préremplit alors le reste à
 * sortir et rappelle l'objectif débité, qu'on ne peut pas changer ici.
 */
export interface WithdrawalRealizationContext {
  /** `null` quand l'objectif a été supprimé — le nom snapshot subsiste. */
  goalId: string | null;
  goalName: string;
  /** `max(0, prévu − réels alloués)` */
  remainingAmount: number;
}

export interface CreateAllocatedTransactionFormData {
  budgetLine: BudgetLine;
  budgetMonth: number;
  budgetYear: number;
  payDayOfMonth: number | null;
  withdrawalRealization?: WithdrawalRealizationContext | null;
}

interface CreateAllocatedTransactionModel {
  name: string;
  money: AmountFormSlice;
  transactionDate: Date;
  isChecked: boolean;
  tagIds: string[];
}

@Component({
  selector: 'pulpe-create-allocated-transaction-form',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSlideToggleModule,
    TranslocoPipe,
    FormField,
    AmountInput,
    AppCurrencyPipe,
    SavingsGoalSourceLine,
    TagPicker,
  ],
  template: `
    <form
      (ngSubmit)="submit()"
      class="flex flex-col gap-4"
      novalidate
      [attr.aria-label]="'transactionForm.formAriaLabel' | transloco"
    >
      @if (data().withdrawalRealization; as realization) {
        <div
          class="flex flex-col gap-1 rounded-corner-medium bg-surface-container p-3"
          data-testid="realize-withdrawal-context"
        >
          <pulpe-savings-goal-source-line
            class="text-label-small max-w-full"
            [goalId]="realization.goalId"
            [goalName]="realization.goalName"
          />
          @if (confirmedBalance() !== null) {
            <span class="text-label-small text-on-surface-variant">
              {{ 'savingsGoals.currentBalance' | transloco }}
              <span class="ph-no-capture">{{
                confirmedBalance()! | appCurrency: currency() : '1.0-2'
              }}</span>
            </span>
          }
          <span class="text-label-small text-on-surface-variant">
            {{ 'budgetLine.remainingPlannedWithdrawal' | transloco }}
            <span class="ph-no-capture">{{
              realization.remainingAmount | appCurrency: currency() : '1.0-2'
            }}</span>
          </span>
        </div>
      }

      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ 'budget.tableDescription' | transloco }}</mat-label>
        <input
          matInput
          [formField]="transactionForm.name"
          [placeholder]="'transactionForm.namePlaceholder' | transloco"
          data-testid="transaction-name"
        />
        @if (nameErrors().required) {
          <mat-error>{{ 'budget.descriptionRequired' | transloco }}</mat-error>
        } @else if (nameErrors().maxLength) {
          <mat-error>{{ 'budget.descriptionMaxLength' | transloco }}</mat-error>
        }
      </mat-form-field>

      <pulpe-amount-input [control]="transactionForm.money" />

      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ 'budget.dateLabel' | transloco }}</mat-label>
        <input
          matInput
          [matDatepicker]="picker"
          [min]="minDate()"
          [max]="maxDate()"
          [formField]="transactionForm.transactionDate"
          data-testid="transaction-date"
          readonly
        />
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-datepicker #picker />
        <mat-hint>{{ 'transactionForm.dateHintBudget' | transloco }}</mat-hint>
        @if (dateErrors().required) {
          <mat-error>{{
            'transactionForm.dateRequired' | transloco
          }}</mat-error>
        } @else if (dateErrors().dateOutOfRange) {
          <mat-error>{{
            'budget.dateOutOfBudgetPeriod' | transloco
          }}</mat-error>
        }
      </mat-form-field>

      <pulpe-tag-picker [control]="transactionForm.tagIds" />

      <div class="flex items-center justify-between py-2 px-1">
        <span class="text-body-medium text-on-surface">{{
          'transactionForm.checkedToggle' | transloco
        }}</span>
        <mat-slide-toggle
          [formField]="transactionForm.isChecked"
          [attr.aria-label]="'transactionForm.checkedToggle' | transloco"
        />
      </div>
    </form>

    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small pt-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionForm {
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #staleRateNotifier = inject(StaleRateNotifier);
  readonly #savingsGoalApi = inject(SavingsGoalApi);

  readonly data = input.required<CreateAllocatedTransactionFormData>();
  readonly created = output<TransactionCreate>();

  protected readonly currency = this.#settings.currency;

  // PUL-329 v2 — le solde confirmé plafonne ce qu'on peut sortir : il partage la
  // clé de cache du reste de l'app, que toute écriture budgétaire périme déjà.
  readonly #goalProgressResource = cachedResource<
    SavingsGoalProgress,
    { goalId: string }
  >({
    cache: this.#savingsGoalApi.cache,
    cacheKey: (params) => ['savings-goals', 'progress', params.goalId],
    params: () => {
      const goalId = this.data().withdrawalRealization?.goalId;
      return goalId ? { goalId } : undefined;
    },
    loader: ({ params }) =>
      this.#savingsGoalApi.getProgress$(params.goalId).pipe(map((r) => r.data)),
  });

  protected readonly confirmedBalance = computed(
    () => this.#goalProgressResource.value()?.confirmed ?? null,
  );

  readonly #dateConstraints = computed(() =>
    computeBudgetPeriodDateConstraints(
      this.data().budgetMonth,
      this.data().budgetYear,
      this.data().payDayOfMonth,
    ),
  );
  protected readonly minDate = computed(() => this.#dateConstraints().minDate);
  protected readonly maxDate = computed(() => this.#dateConstraints().maxDate);

  protected readonly conversionError = signal(false);
  readonly #isSubmitting = signal(false);

  // `data` is dialog/sheet-injected (MAT_DIALOG_DATA / MAT_BOTTOM_SHEET_DATA) and
  // immutable per instance, so `previous?.value` always wins after the first build —
  // user edits are preserved across any incidental re-runs.
  protected readonly model = linkedSignal<
    CreateAllocatedTransactionFormData,
    CreateAllocatedTransactionModel
  >({
    source: this.data,
    computation: (data, previous) =>
      untracked(
        () =>
          previous?.value ?? {
            // PUL-329 v2 — réaliser un retrait annoncé, c'est recopier la
            // prévision : le nom et ce qu'il en reste à sortir sont préremplis,
            // le montant réel restant libre de diverger.
            name: data.withdrawalRealization ? data.budgetLine.name : '',
            money: createAmountSlice({
              initialCurrency: this.#settings.currency(),
              initialAmount:
                data.withdrawalRealization?.remainingAmount || null,
            }),
            transactionDate: this.#dateConstraints().defaultDate,
            isChecked: false,
            tagIds: [],
          },
      ),
  });

  protected readonly transactionForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 100);
    applyAmountValidators(path.money);
    required(path.transactionDate);
    validate(path.transactionDate, ({ value }) => {
      const date = value();
      if (!date || !(date instanceof Date) || isNaN(date.getTime()))
        return null;
      const time = date.getTime();
      if (time < this.minDate().getTime() || time > this.maxDate().getTime())
        return { kind: 'dateOutOfRange' };
      return null;
    });
  });

  readonly canSubmit = computed(
    () => this.transactionForm().valid() && !this.#isSubmitting(),
  );

  protected readonly nameErrors = touchedFieldErrors(
    () => this.transactionForm.name,
    'required',
    'maxLength',
  );
  protected readonly dateErrors = touchedFieldErrors(
    () => this.transactionForm.transactionDate,
    'required',
    'dateOutOfRange',
  );

  async submit(): Promise<void> {
    await runFormSubmit({
      form: this.transactionForm,
      isSubmitting: this.#isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        const { budgetLine } = this.data();
        return {
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata) =>
            transactionCreateFromFormSchema.parse({
              budgetId: budgetLine.budgetId,
              budgetLineId: budgetLine.id,
              name: m.name.trim(),
              amount,
              kind: budgetLine.kind,
              transactionDate: formatLocalDate(m.transactionDate),
              isChecked: m.isChecked,
              tagIds: m.tagIds,
              conversion: metadata ?? null,
            }),
        };
      },
      onSuccess: (value, outcome) => {
        this.#staleRateNotifier.notify(outcome);
        this.created.emit(value);
      },
    });
  }
}
