import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'pulpe-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      @if (icon()) {
        <div
          class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500"
        >
          <ng-content select="[slot=icon]"></ng-content>
        </div>
      }
      <input
        [type]="type()"
        [value]="value()"
        (input)="onInput($event)"
        [placeholder]="placeholder()"
        [class]="inputClasses()"
      />
    </div>
  `,
})
export class TextInputComponent {
  value = input<string>('');
  placeholder = input<string>('');
  type = input<string>('text');
  icon = input<boolean>(false);

  valueChange = output<string>();

  protected inputClasses(): string {
    const baseClasses =
      'w-full py-4 bg-gray-100 border-0 rounded-xl text-lg focus:ring-2 focus:ring-green-500 focus:bg-white transition-all';
    const paddingClasses = this.icon() ? 'pl-16 pr-4' : 'px-4';
    return `${baseClasses} ${paddingClasses}`;
  }

  protected onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.valueChange.emit(target.value);
  }
}
