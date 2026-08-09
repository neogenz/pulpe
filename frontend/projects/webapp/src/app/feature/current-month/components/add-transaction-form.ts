import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form, required, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';

import { AmountInput } from '@app/pattern/amount-input/amount-input';
import { TagPicker } from '@app/pattern/tag-picker/tag-picker';
import {
  AppCurrencyPipe,
  applyAmountValidators,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  injectLiveConversionPreview,
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { SavingsGoalPickerField } from '@app/pattern/savings-goal-picker/savings-goal-picker-field';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import { TransactionLabelPipe } from '@ui/transaction-display';
import {
  transactionFormDataSchema,
  type TransactionFormData,
} from './add-transaction-form.schema';

export type { TransactionFormData } from './add-transaction-form.schema';

interface AddTransactionModel {
  name: string;
  money: AmountFormSlice;
  kind: 'expense' | 'income' | 'saving';
  tagIds: string[];
  isChecked: boolean;
}

@Component({
  selector: 'pulpe-add-transaction-form',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslocoPipe,
    TransactionLabelPipe,
    AppCurrencyPipe,
    FormField,
    AmountInput,
    TagPicker,
    SavingsGoalPickerField,
  ],
  template: `
    <form
      (ngSubmit)="submit()"
      class="add-transaction-form-grid grid grid-cols-1 gap-4"
      novalidate
      data-testid="transaction-form"
    >
      <div class="flex flex-col gap-4">
        <pulpe-amount-input
          [control]="transactionForm.money"
          class="block tabular-nums"
        />
        <div class="flex flex-col gap-3">
          <div class="text-sm font-medium text-on-surface-variant">
            {{ 'currentMonth.addTransactionQuickAmounts' | transloco }}
          </div>
          <div class="grid grid-cols-4 gap-2">
            @for (amount of predefinedAmounts; track amount) {
              <button
                matButton="tonal"
                type="button"
                (click)="selectPredefinedAmount(amount)"
                class="min-h-11 min-w-0 whitespace-nowrap px-2! tabular-nums transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none motion-reduce:transition-none"
              >
                {{ amount | appCurrency: currency() : '1.0-0' }}
              </button>
            }
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionDescription' | transloco
          }}</mat-label>
          <input
            matInput
            [formField]="transactionForm.name"
            data-testid="transaction-description-input"
            [placeholder]="
              'currentMonth.addTransactionDescriptionPlaceholder' | transloco
            "
          />
          @if (nameError('required')) {
            <mat-error>{{
              'currentMonth.addTransactionDescriptionRequired' | transloco
            }}</mat-error>
          }
          @if (nameError('minLength')) {
            <mat-error>{{
              'currentMonth.addTransactionDescriptionMin' | transloco
            }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>{{
            'currentMonth.addTransactionType' | transloco
          }}</mat-label>
          <mat-select
            [formField]="transactionForm.kind"
            (selectionChange)="onKindChange()"
            [attr.aria-label]="'currentMonth.addTransactionType' | transloco"
            data-testid="transaction-type-select"
          >
            <mat-option value="expense">
              <mat-icon class="mr-2 icon-filled">remove_circle</mat-icon>
              {{ 'expense' | transactionLabel }}
            </mat-option>
            <mat-option value="income">
              <mat-icon class="mr-2 icon-filled">add_circle</mat-icon>
              {{ 'income' | transactionLabel }}
            </mat-option>
            <mat-option value="saving">
              <mat-icon class="mr-2 icon-filled">savings</mat-icon>
              {{ 'saving' | transactionLabel }}
            </mat-option>
          </mat-select>
        </mat-form-field>
        <pulpe-tag-picker [control]="transactionForm.tagIds" />
        @if (model().kind === 'income') {
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between gap-3">
              <span class="text-body-medium text-on-surface">{{
                'currentMonth.addTransactionFromSavingsGoal' | transloco
              }}</span>
              <!-- The inputs, not attr. bindings of the same names. The
                   focusable element is a button carrying role switch inside
                   this component, and it takes its accessible name from the
                   aria-label INPUT; an attr. binding writes the attribute onto
                   the non-focusable host instead, where nothing reads it. With
                   no projected label either, the switch had no accessible name
                   at all. -->
              <mat-slide-toggle
                [checked]="isFromSavingsGoal()"
                (change)="toggleSavingsGoalSource($event.checked)"
                [aria-label]="
                  'currentMonth.addTransactionFromSavingsGoal' | transloco
                "
                [aria-describedby]="SAVINGS_SOURCE_HINT_ID"
                data-testid="transaction-savings-source-toggle"
              />
            </div>
            <p
              [id]="SAVINGS_SOURCE_HINT_ID"
              class="text-body-small text-on-surface-variant m-0"
            >
              {{ 'currentMonth.addTransactionFromSavingsGoalHint' | transloco }}
            </p>
            @if (isFromSavingsGoal()) {
              <pulpe-savings-goal-picker-field
                mode="withdrawal"
                class="mt-2"
                [value]="sourceSavingsGoalId()"
                [withdrawalAmount]="withdrawalAmount()"
                (valueChanged)="sourceSavingsGoalId.set($event)"
              />
            }
          </div>
        }
      </div>
      <div class="add-transaction-form-meta grid grid-cols-1 gap-3">
        <!-- Stated, not dressed as a control. A filled tonal surface with a
             rounded corner and a leading glyph, sitting in a form grid beside a
             live toggle, said "tap to change the date" four ways over a static
             div. The date is always today here; the edit form is where it can
             be chosen. -->
        <p
          class="flex items-center gap-2 px-1 text-body-small text-on-surface-variant"
        >
          <mat-icon class="mat-icon-sm" aria-hidden="true">event</mat-icon>
          <span>{{ 'currentMonth.addTransactionToday' | transloco }}</span>
        </p>
        <div class="flex items-center justify-between py-2 px-1">
          <div class="flex flex-col">
            <span class="text-body-medium text-on-surface">{{
              'transactionForm.checkedToggle' | transloco
            }}</span>
            <!-- "Pointer" was taught on this page for a prévision, then reused
                 here on a real transaction with no gloss and defaulted on —
                 while the rarer savings-source toggle above carries a full
                 explanatory line. Off, the amount lands in "Engagé" rather than
                 "Pointé": both figures the user came to read. -->
            <span
              [id]="CHECKED_HINT_ID"
              class="text-body-small text-on-surface-variant"
              >{{ 'transactionForm.checkedToggleHint' | transloco }}</span
            >
          </div>
          <!-- Described by the line beside it, so the gloss that was just added
               for sighted users reaches a screen reader too: the hint is a
               sibling span, and an accessible name never picks one up. -->
          <mat-slide-toggle
            [formField]="transactionForm.isChecked"
            [aria-label]="'transactionForm.checkedToggle' | transloco"
            [aria-describedby]="CHECKED_HINT_ID"
          />
        </div>
      </div>
    </form>
    @if (conversionError()) {
      <p role="alert" class="text-error text-body-small pt-2">
        {{ 'common.conversionError' | transloco }}
      </p>
    }
  `,
  styles: `
    :host(.add-transaction-form-wide) .add-transaction-form-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--pulpe-section-gap-md);
    }
    :host(.add-transaction-form-wide) .add-transaction-form-meta {
      grid-column: span 2 / span 2;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionForm {
  readonly #userSettings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #staleRateNotifier = inject(StaleRateNotifier);
  readonly #isSubmittingState = signal(false);

  readonly created = output<TransactionFormData>();
  readonly isSubmitting = this.#isSubmittingState.asReadonly();

  protected readonly currency = this.#userSettings.currency;
  protected readonly predefinedAmounts = [10, 15, 20, 30] as const;
  protected readonly CHECKED_HINT_ID = 'add-transaction-checked-hint';
  protected readonly SAVINGS_SOURCE_HINT_ID =
    'add-transaction-savings-source-hint';
  protected readonly conversionError = signal(false);

  protected readonly model = signal<AddTransactionModel>({
    name: '',
    money: createAmountSlice({
      initialCurrency: this.#userSettings.currency(),
    }),
    kind: 'expense',
    tagIds: [],
    isChecked: true,
  });

  // L'origine n'est pas un champ signal-forms : le picker est value-based. Elle
  // est effacée au changement de type (`onKindChange`) plutôt que dérivée du
  // type : une dérivation paresseuse ne verrait pas le passage par « Dépense »
  // et ferait réapparaître l'ancienne sélection au retour sur « Revenu ».
  protected readonly isFromSavingsGoal = signal(false);
  protected readonly sourceSavingsGoalId = signal<string | null>(null);

  protected readonly sourcePicker = viewChild(SavingsGoalPickerField);

  // Le contrôle de solde porte sur le montant réellement retiré, donc converti
  // dans la devise du compte (RG-009) — jamais sur le montant saisi.
  readonly #conversionPreview = injectLiveConversionPreview(
    computed(() => this.model().money.amount),
    computed(() => this.model().money.inputCurrency),
    this.currency,
  );

  protected readonly withdrawalAmount = computed<number | null>(() => {
    const { amount, inputCurrency } = this.model().money;
    if (amount === null || amount <= 0) return null;
    if (inputCurrency === this.currency()) return amount;
    const preview = this.#conversionPreview();
    if (preview.status !== 'ready' && preview.status !== 'fallback')
      return null;
    return preview.convertedAmount ?? null;
  });

  protected toggleSavingsGoalSource(isEnabled: boolean): void {
    this.isFromSavingsGoal.set(isEnabled);
    if (!isEnabled) this.sourceSavingsGoalId.set(null);
  }

  protected onKindChange(): void {
    this.toggleSavingsGoalSource(false);
  }

  protected readonly transactionForm = form(this.model, (path) => {
    required(path.name, {
      message: 'currentMonth.addTransactionDescriptionRequired',
    });
    validate(path.name, ({ value }) => {
      const name = value();
      const length = name.trim().length;
      if (length === 0) {
        return name.length === 0
          ? null
          : {
              kind: 'required',
              message: 'currentMonth.addTransactionDescriptionRequired',
            };
      }
      if (length < 2) {
        return {
          kind: 'minLength',
          message: 'currentMonth.addTransactionDescriptionMin',
        };
      }
      return length <= 100 ? null : { kind: 'maxLength' };
    });
    applyAmountValidators(path.money);
    required(path.kind);
  });

  // Ce que l'utilisateur a tapé, pas ce que le formulaire vaut : les deux
  // coques qui hébergent ce formulaire s'en servent pour savoir si une
  // fermeture accidentelle détruit quelque chose. Le type et le pointage ont
  // une valeur par défaut que personne n'a choisie, donc ils n'entrent pas ;
  // la devise non plus, seule elle ne fait pas une saisie.
  readonly hasInput = computed(() => {
    const { name, money, tagIds } = this.model();
    return (
      name.trim().length > 0 ||
      money.amount !== null ||
      tagIds.length > 0 ||
      this.isFromSavingsGoal()
    );
  });

  readonly canSubmit = computed(() => {
    if (!this.transactionForm().valid() || this.isSubmitting()) return false;
    if (!this.isFromSavingsGoal()) return true;
    return this.sourcePicker()?.isWithdrawalBlocked() === false;
  });

  protected nameError(kind: 'required' | 'minLength'): boolean {
    const field = this.transactionForm.name();
    return (
      field.touched() && field.errors().some((error) => error.kind === kind)
    );
  }

  protected selectPredefinedAmount(amount: number): void {
    const amountField = this.transactionForm.money.amount();
    amountField.value.set(amount);
    amountField.markAsTouched();
  }

  async submit(): Promise<void> {
    await runFormSubmit({
      form: this.transactionForm,
      isSubmitting: this.#isSubmittingState,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        return {
          amountSlice: m.money,
          targetCurrency: this.#userSettings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata): TransactionFormData =>
            transactionFormDataSchema.parse({
              name: m.name,
              amount,
              kind: m.kind,
              tagIds: m.tagIds,
              isChecked: m.isChecked,
              conversion: metadata,
              sourceSavingsGoalId: this.isFromSavingsGoal()
                ? this.sourceSavingsGoalId()
                : null,
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
