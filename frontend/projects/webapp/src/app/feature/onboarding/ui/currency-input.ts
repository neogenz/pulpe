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
  selector: 'pulpe-onboarding-currency-input',

  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="w-full" appearance="fill">
      <mat-label class="ph-no-capture">{{ label() }}</mat-label>
      <input
        matInput
        type="number"
        [(ngModel)]="value"
        (input)="onInput($event)"
        [placeholder]="placeholder()"
        [attr.aria-describedby]="ariaDescribedBy()"
        [attr.aria-label]="label() + ' in Swiss Francs'"
        [required]="required()"
        [attr.min]="required() ? '0' : null"
        step="0.01"
        [attr.data-testid]="testId()"
      />
      <span matTextSuffix class="text-gray-600 font-medium">CHF</span>
      @if (ariaDescribedBy()) {
        <mat-hint [id]="ariaDescribedBy()!" class="ph-no-capture"
          >Entre le montant en francs suisses (CHF)</mat-hint
        >
      }
    </mat-form-field>
  `,
})
export class OnboardingCurrencyInput {
  #elementRef = inject(ElementRef);

  label = input.required<string>();
  value = model<number | null>(null);
  placeholder = input<string>('0.00');
  ariaDescribedBy = input<string>();
  required = input<boolean>(false);
  testId = input<string>('currency-input');

  constructor() {
    afterNextRender(() => {
      this.#elementRef.nativeElement.querySelector('input')?.focus();
    });
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const numericValue = target.value ? parseFloat(target.value) : null;
    this.value.set(numericValue);
  }
}
