import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  afterNextRender,
  ElementRef,
  inject,
  model,
} from '@angular/core';
import {
  CURRENCY_METADATA,
  type SupportedCurrency,
  SUPPORTED_CURRENCIES,
} from 'pulpe-shared';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-currency-input',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="w-full" appearance="outline">
      @if (icon()) {
        <mat-icon matPrefix class="mr-3 text-on-surface-variant/70">{{
          icon()
        }}</mat-icon>
      }
      <mat-label class="ph-no-capture">{{ label() }}</mat-label>
      <input
        matInput
        type="number"
        inputmode="decimal"
        class="ph-no-capture"
        [(ngModel)]="value"
        [placeholder]="placeholder()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.aria-label]="label() + ' in ' + currency()"
        [required]="required()"
        [attr.min]="required() ? '0' : null"
        step="0.01"
        [attr.data-testid]="testId()"
      />
      @if (showCurrencySelector()) {
        <mat-select
          matTextSuffix
          [value]="currency()"
          (selectionChange)="currencyChange.emit($event.value)"
          class="!w-[70px] text-on-surface-variant font-medium"
          [attr.aria-label]="'common.currencySelector' | transloco"
        >
          @for (c of currencies; track c) {
            <mat-option [value]="c">
              <span class="mr-1">{{ CURRENCY_METADATA[c].flag }}</span
              >{{ c }}
            </mat-option>
          }
        </mat-select>
      } @else {
        <span matTextSuffix class="text-on-surface-variant font-medium">{{
          currency()
        }}</span>
      }
      @if (ariaDescribedBy()) {
        <mat-hint [id]="ariaDescribedBy()!" class="ph-no-capture">
          {{ 'currency.inputHint' | transloco: { currency: currency() } }}
        </mat-hint>
      }
    </mat-form-field>
  `,
})
export class CurrencyInput {
  readonly #elementRef = inject(ElementRef);

  readonly label = input.required<string>();
  readonly value = model<number | null>(null);
  readonly placeholder = input<string>('0.00');
  readonly icon = input<string | null>(null);
  readonly ariaDescribedBy = input<string>();
  readonly required = input<boolean>(false);
  readonly testId = input<string>('currency-input');
  readonly currency = input<string>('CHF');
  readonly showCurrencySelector = input<boolean>(false);
  readonly currencyChange = output<SupportedCurrency>();
  readonly autoFocus = input<boolean>(true);
  protected readonly currencies = SUPPORTED_CURRENCIES;
  protected readonly CURRENCY_METADATA = CURRENCY_METADATA;

  constructor() {
    afterNextRender(() => {
      if (this.autoFocus()) {
        this.#elementRef.nativeElement.querySelector('input')?.focus();
      }
    });
  }
}
