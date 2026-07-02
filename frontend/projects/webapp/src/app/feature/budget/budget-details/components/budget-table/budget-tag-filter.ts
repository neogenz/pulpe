import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  type MatChipListboxChange,
  MatChipsModule,
} from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export interface TagFilterOption {
  readonly id: string;
  readonly name: string;
}

/**
 * Multi-select tag filter for the budget-details table/grid (PUL-18 PR4).
 * Mirrors `pulpe-budget-table-checked-filter` but allows selecting several tags;
 * the host filters rows to those carrying at least one selected tag. Dumb by
 * design — the container owns the selection and the available options.
 */
@Component({
  selector: 'pulpe-budget-tag-filter',
  imports: [MatChipsModule, MatIconModule, TranslocoPipe],
  template: `
    <div class="flex items-center gap-2 flex-wrap">
      <span
        class="text-label-large text-on-surface-variant inline-flex items-center gap-1"
      >
        <mat-icon class="text-base!">sell</mat-icon>
        {{ 'budget.tagFilterLabel' | transloco }}
      </span>
      <mat-chip-listbox
        multiple
        [attr.aria-label]="'budget.tagFilterAriaLabel' | transloco"
        (change)="onChange($event)"
      >
        @for (tag of tags(); track tag.id) {
          <mat-chip-option
            [value]="tag.id"
            [selected]="selectedTagIds().includes(tag.id)"
            [attr.data-testid]="'tag-filter-' + tag.id"
          >
            {{ tag.name }}
          </mat-chip-option>
        }
      </mat-chip-listbox>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTagFilter {
  readonly tags = input.required<TagFilterOption[]>();
  readonly selectedTagIds = input<string[]>([]);
  readonly selectedTagIdsChange = output<string[]>();

  onChange(event: MatChipListboxChange): void {
    this.selectedTagIdsChange.emit((event.value as string[] | null) ?? []);
  }
}
