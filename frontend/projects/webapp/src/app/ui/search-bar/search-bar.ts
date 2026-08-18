import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'pulpe-search-bar',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-3 rounded-full bg-surface-container-high px-4 h-14"
    >
      <mat-icon class="text-on-surface-variant">search</mat-icon>
      <input
        class="flex-1 bg-transparent outline-none text-on-surface placeholder:text-on-surface-variant text-body-large"
        [placeholder]="placeholder()"
        [value]="value()"
        (input)="value.set(searchInput.value)"
        #searchInput
      />
      @if (value()) {
        <button
          matIconButton
          [attr.aria-label]="'common.clearSearch' | transloco"
          (click)="value.set('')"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBar {
  // Required rather than defaulted: a default would be a hardcoded French
  // string, and a caller that forgot to pass one would render it inside the
  // German app without anything failing.
  readonly placeholder = input.required<string>();
  readonly value = model('');
}
