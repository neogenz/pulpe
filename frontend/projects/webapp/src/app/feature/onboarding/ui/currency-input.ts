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
        min="0"
        step="0.01"
      />
      <span matSuffix class="text-gray-600 font-medium">CHF</span>
    </mat-form-field>
  `,
  styles: [
    `
      :host
        ::ng-deep
        .mat-mdc-form-field-has-icon-suffix
        .mat-mdc-text-field-wrapper {
        padding-right: 16px !important;
      }
    `,
  ],
})
export class OnboardingCurrencyInput {
  #elementRef = inject(ElementRef);

  label = input.required<string>();
  value = input<number | null>(null);
  placeholder = input<string>('0.00');

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
