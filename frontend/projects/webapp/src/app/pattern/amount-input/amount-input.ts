import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { type FieldTree } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';

import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import {
  injectLiveConversionPreview,
  isCurrencyPickerVisible,
  type AmountFormSlice,
} from '@core/currency';
import { CurrencySuffix } from '@ui/currency-suffix';
import { ConversionPreviewLine } from '@ui/conversion-preview-line';

export type AmountInputMode = 'create' | 'edit';

/**
 * Composite "amount + currency + live conversion preview" form field.
 *
 * Owns: visibility rules (flag x user pref x edit-mode original currency),
 * picker enabled/disabled state, and live conversion preview rendering.
 *
 * Caller owns: form state (`control`), submit-time `conversionError`, and the
 * `convertWithMetadata` call at submit boundary.
 */
@Component({
  selector: 'pulpe-amount-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    CurrencySuffix,
    ConversionPreviewLine,
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col">
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full ph-no-capture"
      >
        <mat-label class="ph-no-capture">{{
          'transactionForm.amountLabel' | transloco
        }}</mat-label>
        <input
          #amountInput
          matInput
          type="number"
          inputmode="decimal"
          placeholder="0.00"
          step="0.01"
          [value]="amountValue() ?? ''"
          (input)="onAmountInput($event)"
          (blur)="onAmountBlur()"
          data-testid="amount-input-value"
        />
        <pulpe-currency-suffix
          matTextSuffix
          [showSelector]="showSelector()"
          [disabled]="pickerDisabled()"
          [currency]="currentInputCurrency() ?? displayCurrency()"
          (currencyChange)="setInputCurrency($event)"
        />
        @if (amountTouched() && amountErrorKey(); as key) {
          <mat-error>{{ key | transloco }}</mat-error>
        }
      </mat-form-field>

      <pulpe-conversion-preview-line
        [amount]="preview().convertedAmount ?? null"
        [inputCurrency]="currentInputCurrency()"
        [displayCurrency]="displayCurrency()"
        [rate]="preview().rate ?? null"
        [cachedDate]="preview().cachedDate ?? null"
        [status]="preview().status"
      />
    </div>
  `,
  host: { class: 'block' },
})
export class AmountInput {
  readonly control = input.required<FieldTree<AmountFormSlice>>();
  readonly mode = input<AmountInputMode>('create');
  readonly originalCurrency = input<SupportedCurrency | null>(null);

  private readonly amountInputRef =
    viewChild<ElementRef<HTMLInputElement>>('amountInput');

  focus(): void {
    this.amountInputRef()?.nativeElement?.focus();
  }

  readonly #settings = inject(UserSettingsStore);
  readonly #flags = inject(FeatureFlagsService);

  protected readonly displayCurrency = this.#settings.currency;

  /**
   * Required-input deferred read. `injectLiveConversionPreview` (called in a
   * class field below) reads the signals during view init — at that point a
   * direct `this.control()` throws NG0950 because input bindings haven't
   * propagated yet. Wrapping the read in a `computed` defers it to the next
   * change-detection tick when the binding is set. After the first run the
   * `try` is a no-op.
   */
  readonly #safeControl = computed(() => {
    try {
      return this.control();
    } catch {
      return null;
    }
  });

  protected readonly amountValue = computed<number | null>(
    () => this.#safeControl()?.amount().value() ?? null,
  );

  protected onAmountInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const next = target.valueAsNumber;
    this.control()
      .amount()
      .value.set(Number.isNaN(next) ? null : next);
  }

  protected onAmountBlur(): void {
    this.control().amount().markAsTouched();
  }

  protected readonly currentInputCurrency = computed<SupportedCurrency | null>(
    () => this.#safeControl()?.inputCurrency().value() ?? null,
  );

  protected readonly showSelector = computed(() => {
    if (this.mode() === 'edit') {
      return isCurrencyPickerVisible({
        isMultiCurrencyEnabled: this.#flags.isMultiCurrencyEnabled(),
        originalCurrency: this.originalCurrency(),
        userCurrency: this.displayCurrency(),
      });
    }
    return (
      this.#flags.isMultiCurrencyEnabled() &&
      this.#settings.showCurrencySelector()
    );
  });

  protected readonly pickerDisabled = computed(() => this.mode() === 'edit');

  protected readonly preview = injectLiveConversionPreview(
    this.amountValue,
    this.currentInputCurrency,
    this.displayCurrency,
  );

  protected readonly amountErrorKey = computed(() => {
    const tree = this.#safeControl();
    if (!tree) return null;
    const errors = tree.amount().errors();
    if (errors.length === 0) return null;
    const first = errors[0];
    return typeof first.message === 'string' ? first.message : null;
  });

  protected readonly amountTouched = computed(
    () => this.#safeControl()?.amount().touched() ?? false,
  );

  protected setInputCurrency(next: SupportedCurrency): void {
    this.control().inputCurrency().value.set(next);
  }
}
