import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Field, type FieldTree } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';

import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import {
  injectLiveConversionPreview,
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
 * Caller owns: form state (`field`), submit-time `conversionError`, and the
 * `convertWithMetadata` call at submit boundary.
 *
 * Note: `field` is intentionally not `input.required`. `injectLiveConversionPreview`
 * spins up a `resource()` whose params callback runs at field-init (before any
 * binding propagates) — required signal inputs would throw NG0950 there. This
 * mirrors the precedent in `pattern/currency-converter-widget`.
 */
@Component({
  selector: 'pulpe-amount-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Field,
    MatFormFieldModule,
    MatInputModule,
    CurrencySuffix,
    ConversionPreviewLine,
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col">
      @let bound = control();
      @if (bound) {
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full ph-no-capture"
        >
          <mat-label class="ph-no-capture">{{
            'transactionForm.amountLabel' | transloco
          }}</mat-label>
          <input
            matInput
            type="number"
            inputmode="decimal"
            placeholder="0.00"
            step="0.01"
            min="0"
            [field]="$any(bound.amount)"
            data-testid="amount-input-value"
          />
          <pulpe-currency-suffix
            matTextSuffix
            [showSelector]="showSelector()"
            [disabled]="pickerDisabled()"
            [currency]="currentInputCurrency()"
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
      }
    </div>
  `,
  host: { class: 'block' },
})
export class AmountInput {
  readonly control = input<FieldTree<AmountFormSlice> | undefined>(undefined);
  readonly mode = input<AmountInputMode>('create');
  readonly originalCurrency = input<SupportedCurrency | null>(null);

  readonly #settings = inject(UserSettingsStore);
  readonly #flags = inject(FeatureFlagsService);

  protected readonly displayCurrency = this.#settings.currency;

  protected readonly amountValue = computed<number | null>(() => {
    const tree = this.control();
    return tree ? tree.amount().value() : null;
  });

  protected readonly currentInputCurrency = computed<SupportedCurrency>(() => {
    const tree = this.control();
    return tree ? tree.inputCurrency().value() : this.displayCurrency();
  });

  protected readonly showSelector = computed(() => {
    if (!this.#flags.isMultiCurrencyEnabled()) return false;
    if (this.mode() === 'edit') {
      const orig = this.originalCurrency();
      return orig !== null && orig !== this.displayCurrency();
    }
    return this.#settings.showCurrencySelector();
  });

  protected readonly pickerDisabled = computed(() => this.mode() === 'edit');

  protected readonly preview = injectLiveConversionPreview(
    this.amountValue,
    this.currentInputCurrency,
    this.displayCurrency,
  );

  protected readonly amountErrorKey = computed(() => {
    const tree = this.control();
    if (!tree) return null;
    const errors = tree.amount().errors();
    if (errors.length === 0) return null;
    const first = errors[0];
    return typeof first.message === 'string' ? first.message : null;
  });

  protected readonly amountTouched = computed(() => {
    const tree = this.control();
    return tree ? tree.amount().touched() : false;
  });

  protected setInputCurrency(next: SupportedCurrency): void {
    const tree = this.control();
    if (tree) tree.inputCurrency().value.set(next);
  }
}
