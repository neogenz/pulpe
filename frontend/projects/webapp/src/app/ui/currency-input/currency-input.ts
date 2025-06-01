import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'pulpe-currency-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <div
        class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium"
      >
        CHF
      </div>
      <input
        type="number"
        [value]="value()"
        (input)="onInput($event)"
        [placeholder]="placeholder()"
        class="w-full pl-16 pr-4 py-4 bg-gray-100 border-0 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
        min="0"
        step="0.01"
      />
    </div>
  `,
})
export class CurrencyInputComponent {
  value = input<number | null>(null);
  placeholder = input<string>('0.00');

  valueChange = output<number | null>();

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const numericValue = target.value ? parseFloat(target.value) : null;
    this.valueChange.emit(numericValue);
  }
}
