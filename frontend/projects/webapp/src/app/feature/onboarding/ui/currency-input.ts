import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  afterNextRender,
  ElementRef,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'pulpe-onboarding-currency-input',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="w-full" appearance="fill">
      <mat-label>{{ label() }}</mat-label>
      <input
        matInput
        type="number"
        [value]="value()"
        (input)="onInput($event)"
        [placeholder]="placeholder()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.aria-label]="label() + ' in Swiss Francs'"
        [required]="required()"
        min="0"
        step="0.01"
      />
      <span matTextSuffix class="text-gray-600 font-medium">CHF</span>
      @if (ariaDescribedBy()) {
        <mat-hint [id]="ariaDescribedBy()!"
          >Entre le montant en francs suisses (CHF)</mat-hint
        >
      }
    </mat-form-field>
  `,
})
export class OnboardingCurrencyInput {
  #elementRef = inject(ElementRef);

  label = input.required<string>();
  value = input<number | null>(null);
  placeholder = input<string>('0.00');
  ariaDescribedBy = input<string>();
  required = input<boolean>(false);

  valueChange = output<number | null>();

  constructor() {
    afterNextRender(() => {
      this.#elementRef.nativeElement.querySelector('input')?.focus();
    });
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const numericValue = target.value ? parseFloat(target.value) : null;
    this.valueChange.emit(numericValue);
  }
}
