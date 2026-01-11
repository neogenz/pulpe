import {
  Component,
  input,
  ChangeDetectionStrategy,
  afterNextRender,
  ElementRef,
  inject,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'pulpe-currency-input',
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="w-full" appearance="fill">
      <mat-label class="ph-no-capture">{{ label() }}</mat-label>
      <input
        matInput
        type="number"
        class="ph-no-capture"
        [(ngModel)]="value"
        (input)="onInput($event)"
        [placeholder]="placeholder()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.aria-label]="label() + ' in ' + currency()"
        [required]="required()"
        [attr.min]="required() ? '0' : null"
        step="0.01"
        [attr.data-testid]="testId()"
      />
      <span matTextSuffix class="text-gray-600 font-medium">{{
        currency()
      }}</span>
      @if (ariaDescribedBy()) {
        <mat-hint [id]="ariaDescribedBy()!" class="ph-no-capture"
          >Entre le montant en {{ currency() }}</mat-hint
        >
      }
    </mat-form-field>
  `,
})
export class CurrencyInput {
  readonly #elementRef = inject(ElementRef);

  readonly label = input.required<string>();
  readonly value = model<number | null>(null);
  readonly placeholder = input<string>('0.00');
  readonly ariaDescribedBy = input<string>();
  readonly required = input<boolean>(false);
  readonly testId = input<string>('currency-input');
  readonly currency = input<string>('CHF');
  readonly autoFocus = input<boolean>(true);

  constructor() {
    afterNextRender(() => {
      if (this.autoFocus()) {
        this.#elementRef.nativeElement.querySelector('input')?.focus();
      }
    });
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const numericValue = target.value ? parseFloat(target.value) : null;
    this.value.set(numericValue);
  }
}
