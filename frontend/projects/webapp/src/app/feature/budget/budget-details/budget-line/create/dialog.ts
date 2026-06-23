import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { type TransactionKind, type TransactionRecurrence } from 'pulpe-shared';

import {
  applyAmountValidators,
  AppCurrencyPipe,
  type AmountFormSlice,
  createAmountSlice,
  CurrencyConverterService,
  runFormSubmit,
  StaleRateNotifier,
} from '@core/currency';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import { dateFnsLocaleFor } from '@core/locale';
import { touchedFieldErrors } from '@core/validators';
import { AmountInput } from '@app/pattern/amount-input/amount-input';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { formatDate } from 'date-fns';

import { budgetLineCreateFromFormSchema } from './dialog.schema';
import { budgetLineSpreadCreateFromFormSchema } from './spread.schema';
import {
  defaultSpreadEnd,
  enumerateMonths,
  MAX_SPREAD_MONTHS,
  monthKey,
  monthSpan,
  type SpreadMonth,
} from './spread.utils';
import type { AddBudgetLineDialogResult } from './dialog-result';

export interface BudgetLineDialogData {
  budgetId: string;
  budgetMonth: number;
  budgetYear: number;
}

type EntryMode = 'single' | 'spread';

interface AddBudgetLineModel {
  name: string;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  isChecked: boolean;
  money: AmountFormSlice;
}

@Component({
  selector: 'pulpe-budget-line-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
    TranslocoPipe,
    AppCurrencyPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    FormField,
    AmountInput,
  ],
  host: { 'data-testid': 'add-budget-line-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budget.newForecast' | transloco }}
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
              [formField]="addForm.name"
              [placeholder]="'budget.forecastNamePlaceholder' | transloco"
              data-testid="new-line-name"
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

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'budget.forecastTypeLabel' | transloco }}</mat-label>
            <mat-select [formField]="addForm.kind" data-testid="new-line-kind">
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

          @if (isSpreadAvailable()) {
            <mat-button-toggle-group
              [value]="mode()"
              (change)="setMode($event.value)"
              hideSingleSelectionIndicator
              [attr.aria-label]="'budget.spreadModeLabel' | transloco"
              class="w-full"
              data-testid="spread-mode-toggle"
            >
              <mat-button-toggle value="single" class="flex-1">
                {{ 'budget.spreadModeOnce' | transloco }}
              </mat-button-toggle>
              <mat-button-toggle value="spread" class="flex-1">
                <mat-icon class="mr-1 align-middle">calendar_month</mat-icon>
                {{ 'budget.spreadModeSpread' | transloco }}
              </mat-button-toggle>
            </mat-button-toggle-group>
          }

          <pulpe-amount-input
            [control]="addForm.money"
            [label]="amountLabel()"
          />

          @if (mode() === 'spread') {
            <div class="flex flex-col gap-4" data-testid="spread-section">
              <div class="flex gap-3">
                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="flex-1"
                >
                  <mat-label>{{
                    'budget.spreadFromLabel' | transloco
                  }}</mat-label>
                  <mat-select
                    [value]="startKey()"
                    (selectionChange)="setStart($event.value)"
                    data-testid="spread-from"
                  >
                    @for (m of monthOptions(); track m.key) {
                      <mat-option [value]="m.key">{{ m.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="flex-1"
                >
                  <mat-label>{{
                    'budget.spreadToLabel' | transloco
                  }}</mat-label>
                  <mat-select
                    [value]="endKey()"
                    (selectionChange)="setEnd($event.value)"
                    data-testid="spread-to"
                  >
                    @for (m of monthOptions(); track m.key) {
                      <mat-option [value]="m.key">{{ m.label }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <p class="text-body-small text-on-surface-variant">
                {{ 'budget.spreadHelp' | transloco }}
              </p>

              @if (rangeMonths().length > 0) {
                <div
                  role="group"
                  [attr.aria-label]="'budget.spreadMonthsLabel' | transloco"
                  class="flex flex-wrap gap-2"
                  data-testid="spread-months-grid"
                >
                  @for (m of rangeMonths(); track m.key) {
                    <button
                      type="button"
                      class="spread-month-chip"
                      [class.is-selected]="isSelected(m.key)"
                      [attr.aria-pressed]="isSelected(m.key)"
                      (click)="toggleMonth(m.key)"
                      [attr.data-testid]="'spread-month-' + m.key"
                    >
                      {{ m.shortLabel }}
                    </button>
                  }
                </div>
              }

              @if (spreadError(); as errorKey) {
                <p
                  role="alert"
                  class="text-error text-body-small"
                  data-testid="spread-error"
                >
                  {{ errorKey | transloco }}
                </p>
              } @else if (selectedCount() > 0) {
                <div
                  class="flex items-center justify-between rounded-corner-medium bg-surface-container px-4 py-3"
                  data-testid="spread-total-echo"
                >
                  <span class="text-body-medium text-on-surface-variant">
                    {{
                      'budget.spreadTotalLabel'
                        | transloco: { count: selectedCount() }
                    }}
                  </span>
                  <span class="text-title-medium font-medium ph-no-capture">
                    {{ spreadTotal() | appCurrency: currency() : '1.0-0' }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="flex items-center justify-between py-2 px-1">
              <span class="text-body-medium text-on-surface">{{
                'budget.forecastCheckedToggle' | transloco
              }}</span>
              <mat-slide-toggle
                [formField]="addForm.isChecked"
                [attr.aria-label]="'budget.forecastCheckedToggle' | transloco"
              />
            </div>
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
      <button matButton (click)="cancel()" data-testid="cancel-new-line">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        (click)="handleSubmit()"
        [disabled]="!canSubmit()"
        data-testid="add-new-line"
      >
        <mat-icon>add</mat-icon>
        {{ 'common.add' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .spread-month-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 4.5rem;
      min-height: 2.75rem;
      padding: 0.375rem 0.75rem;
      border-radius: var(--mat-sys-corner-full);
      border: 1px solid var(--mat-sys-outline);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      cursor: pointer;
      transition:
        background-color 150ms var(--pulpe-ease-standard),
        color 150ms var(--pulpe-ease-standard),
        border-color 150ms var(--pulpe-ease-standard);

      &.is-selected {
        background-color: var(--mat-sys-primary);
        border-color: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        text-decoration: none;
      }

      &:not(.is-selected) {
        text-decoration: line-through;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddBudgetLineDialog {
  readonly #dialogRef =
    inject<MatDialogRef<AddBudgetLineDialog, AddBudgetLineDialogResult>>(
      MatDialogRef,
    );
  readonly #data = inject<BudgetLineDialogData>(MAT_DIALOG_DATA);
  readonly #settings = inject(UserSettingsStore);
  readonly #converter = inject(CurrencyConverterService);
  readonly #logger = inject(Logger);
  readonly #staleRateNotifier = inject(StaleRateNotifier);

  protected readonly currency = this.#settings.currency;

  protected readonly model = signal<AddBudgetLineModel>({
    name: '',
    kind: 'expense',
    recurrence: 'one_off',
    isChecked: false,
    money: createAmountSlice({ initialCurrency: this.#settings.currency() }),
  });

  protected readonly addForm = form(this.model, (path) => {
    required(path.name, { message: 'budget.forecastNameRequired' });
    minLength(path.name, 2, { message: 'budget.forecastNameMinLength' });
    applyAmountValidators(path.money);
    required(path.kind, { message: 'budget.forecastTypeRequired' });
  });

  protected readonly nameErrors = touchedFieldErrors(
    () => this.addForm.name,
    'required',
    'minLength',
  );
  protected readonly kindErrors = touchedFieldErrors(
    () => this.addForm.kind,
    'required',
  );

  // ── Spread (PUL-17) state ──
  readonly #mode = signal<EntryMode>('single');
  protected readonly mode = this.#mode.asReadonly();

  readonly #start = signal<SpreadMonth>({
    year: this.#data.budgetYear,
    month: this.#data.budgetMonth,
  });
  readonly #end = signal<SpreadMonth>(
    defaultSpreadEnd({
      year: this.#data.budgetYear,
      month: this.#data.budgetMonth,
    }),
  );
  // Months explicitly deselected by the user (a month not in this set is selected).
  readonly #deselected = signal<ReadonlySet<string>>(new Set());

  protected readonly startKey = computed(() => monthKey(this.#start()));
  protected readonly endKey = computed(() => monthKey(this.#end()));

  // Spread is offered for expense/saving only — revenu lissé is out of scope (V1).
  protected readonly isSpreadAvailable = computed(
    () => this.model().kind !== 'income',
  );

  protected readonly amountLabel = computed(() =>
    this.#mode() === 'spread'
      ? 'budget.spreadAmountPerMonthLabel'
      : 'transactionForm.amountLabel',
  );

  readonly #dateFnsLocale = computed(() =>
    dateFnsLocaleFor(this.#settings.currency()),
  );

  // 36-month horizon from the start budget month for the De/À pickers.
  protected readonly monthOptions = computed(() => {
    const base = { year: this.#data.budgetYear, month: this.#data.budgetMonth };
    const last = {
      year:
        base.year + Math.floor((base.month - 1 + MAX_SPREAD_MONTHS - 1) / 12),
      month: ((base.month - 1 + MAX_SPREAD_MONTHS - 1) % 12) + 1,
    };
    return enumerateMonths(base, last).map((m) => ({
      key: monthKey(m),
      label: this.#formatMonth(m, 'MMMM yyyy'),
      shortLabel: this.#formatMonth(m, 'MMM yy'),
    }));
  });

  protected readonly rangeMonths = computed(() =>
    enumerateMonths(this.#start(), this.#end()).map((m) => ({
      key: monthKey(m),
      shortLabel: this.#formatMonth(m, 'MMM yy'),
    })),
  );

  protected readonly selectedMonths = computed<SpreadMonth[]>(() => {
    const deselected = this.#deselected();
    return enumerateMonths(this.#start(), this.#end()).filter(
      (m) => !deselected.has(monthKey(m)),
    );
  });

  protected readonly selectedCount = computed(
    () => this.selectedMonths().length,
  );

  protected readonly spreadTotal = computed(() => {
    const perMonth = this.model().money.amount ?? 0;
    return perMonth * this.selectedCount();
  });

  protected readonly spreadError = computed<string | null>(() => {
    const span = monthSpan(this.#start(), this.#end());
    if (span < 1) return 'budget.spreadErrorEndBeforeStart';
    if (span > MAX_SPREAD_MONTHS) return 'budget.spreadErrorTooManyMonths';
    if (this.selectedCount() === 0) return 'budget.spreadErrorNoMonths';
    return null;
  });

  protected isSelected(key: string): boolean {
    return !this.#deselected().has(key);
  }

  protected setMode(mode: EntryMode): void {
    this.#mode.set(mode);
  }

  protected setStart(key: string): void {
    const period = this.#parseKey(key);
    if (period) this.#start.set(period);
  }

  protected setEnd(key: string): void {
    const period = this.#parseKey(key);
    if (period) this.#end.set(period);
  }

  protected toggleMonth(key: string): void {
    this.#deselected.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected readonly conversionError = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly canSubmit = computed(() => {
    if (this.isSubmitting()) return false;
    if (this.#mode() === 'spread') {
      return this.addForm().valid() && this.spreadError() === null;
    }
    return this.addForm().valid();
  });

  constructor() {
    // Revenu lissé hors scope V1: switching to income drops spread mode.
    effect(() => {
      if (
        this.model().kind === 'income' &&
        untracked(this.#mode) === 'spread'
      ) {
        this.#mode.set('single');
      }
    });
  }

  protected async handleSubmit(): Promise<void> {
    if (this.#mode() === 'spread') {
      await this.#submitSpread();
      return;
    }
    await this.#submitSingle();
  }

  async #submitSingle(): Promise<void> {
    await runFormSubmit({
      form: this.addForm,
      isSubmitting: this.isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        return {
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (amount, metadata) =>
            budgetLineCreateFromFormSchema.parse({
              budgetId: this.#data.budgetId,
              name: m.name.trim(),
              amount,
              kind: m.kind,
              recurrence: m.recurrence,
              isChecked: m.isChecked,
              conversion: metadata,
            }),
        };
      },
      onSuccess: (value, outcome) => {
        this.#staleRateNotifier.notify(outcome);
        this.#dialogRef.close({ mode: 'single', value });
      },
    });
  }

  async #submitSpread(): Promise<void> {
    await runFormSubmit({
      form: this.addForm,
      isSubmitting: this.isSubmitting,
      conversionError: this.conversionError,
      prepare: () => {
        const m = this.model();
        return {
          amountSlice: m.money,
          targetCurrency: this.#settings.currency(),
          converter: this.#converter,
          logger: this.#logger,
          build: (perMonthAmount, metadata) =>
            budgetLineSpreadCreateFromFormSchema.parse({
              name: m.name.trim(),
              kind: m.kind,
              perMonthAmount,
              months: this.selectedMonths(),
              conversion: metadata,
            }),
        };
      },
      onSuccess: (value, outcome) => {
        this.#staleRateNotifier.notify(outcome);
        this.#dialogRef.close({ mode: 'spread', value });
      },
    });
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }

  #formatMonth(period: SpreadMonth, pattern: string): string {
    return formatDate(new Date(period.year, period.month - 1, 1), pattern, {
      locale: this.#dateFnsLocale(),
    });
  }

  #parseKey(key: string): SpreadMonth | null {
    const [year, month] = key.split('-').map(Number);
    if (Number.isNaN(year) || Number.isNaN(month)) return null;
    return { year, month };
  }
}
