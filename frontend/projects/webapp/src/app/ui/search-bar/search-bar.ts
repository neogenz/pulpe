import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-search-bar',
  imports: [MatButtonModule, MatIconModule],
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
          mat-icon-button
          aria-label="Effacer la recherche"
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
  readonly placeholder = input('Rechercher...');
  readonly value = model('');
}
