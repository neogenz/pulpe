import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  type MatChipListboxChange,
  MatChipsModule,
} from '@angular/material/chips';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatListModule,
  type MatSelectionListChange,
} from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';

const MAX_INLINE_TAGS = 5;

export interface TagFilterOption {
  readonly id: string;
  readonly name: string;
}

interface TagFilterDialogData {
  readonly tags: readonly TagFilterOption[];
  readonly selectedTagIds: readonly string[];
}

@Component({
  selector: 'pulpe-budget-tag-filter-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'budget.tagFilterDialogTitle' | transloco }}</h2>

    <mat-dialog-content>
      <mat-form-field appearance="outline" class="w-full pt-1">
        <mat-label>{{ 'budget.tagFilterSearchLabel' | transloco }}</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input
          matInput
          type="search"
          autocomplete="off"
          [value]="search()"
          (input)="onSearch($event)"
          data-testid="tag-filter-search"
        />
      </mat-form-field>

      <mat-selection-list
        [attr.aria-label]="'budget.tagFilterAriaLabel' | transloco"
        (selectionChange)="onSelectionChange($event)"
      >
        @for (tag of filteredTags(); track tag.id) {
          <mat-list-option
            [value]="tag.id"
            [selected]="selectedTagIds().has(tag.id)"
          >
            <span class="ph-no-capture">{{ tag.name }}</span>
          </mat-list-option>
        }
      </mat-selection-list>

      @if (filteredTags().length === 0) {
        <p class="py-8 text-center text-body-medium text-on-surface-variant">
          {{ 'budget.tagFilterNoResult' | transloco }}
        </p>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button matButton (click)="clear()">
        {{ 'common.clear' | transloco }}
      </button>
      <span class="flex-1"></span>
      <button matButton mat-dialog-close>
        {{ 'common.cancel' | transloco }}
      </button>
      <button matButton="filled" (click)="apply()">
        {{ 'budget.tagFilterApply' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BudgetTagFilterDialog {
  protected readonly data = inject<TagFilterDialogData>(MAT_DIALOG_DATA);
  protected readonly search = signal('');
  protected readonly selectedTagIds = signal(new Set(this.data.selectedTagIds));
  protected readonly filteredTags = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('fr');
    return query
      ? this.data.tags.filter((tag) =>
          tag.name.toLocaleLowerCase('fr').includes(query),
        )
      : this.data.tags;
  });
  readonly #dialogRef =
    inject<MatDialogRef<BudgetTagFilterDialog, string[]>>(MatDialogRef);

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onSelectionChange(event: MatSelectionListChange): void {
    this.selectedTagIds.update((selectedTagIds) => {
      const next = new Set(selectedTagIds);
      for (const option of event.options) {
        const tagId = String(option.value);
        if (option.selected) {
          next.add(tagId);
        } else {
          next.delete(tagId);
        }
      }
      return next;
    });
  }

  protected clear(): void {
    this.selectedTagIds.set(new Set());
  }

  protected apply(): void {
    this.#dialogRef.close([...this.selectedTagIds()]);
  }
}

/**
 * Multi-select tag filter for the budget-details table/grid (PUL-18 PR4).
 * Mirrors `pulpe-budget-table-checked-filter` but allows selecting several tags;
 * the host filters rows to those carrying at least one selected tag.
 */
@Component({
  selector: 'pulpe-budget-tag-filter',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, TranslocoPipe],
  template: `
    @if (usesDialog()) {
      <button
        matButton="outlined"
        class="h-11!"
        type="button"
        aria-haspopup="dialog"
        [attr.aria-label]="'budget.tagFilterAriaLabel' | transloco"
        (click)="openDialog()"
        data-testid="tag-filter-dialog-trigger"
      >
        <mat-icon>sell</mat-icon>
        @if (selectedTagIds().length === 0) {
          {{ 'budget.tagFilterLabel' | transloco }}
        } @else if (selectedTagIds().length === 1) {
          {{ 'budget.tagFilterSelectedOne' | transloco }}
        } @else {
          {{
            'budget.tagFilterSelectedMany'
              | transloco: { count: selectedTagIds().length }
          }}
        }
      </button>
    } @else {
      <div class="flex items-center gap-2 flex-wrap">
        <span
          class="text-label-large text-on-surface-variant inline-flex items-center gap-1"
        >
          <mat-icon class="mat-icon-sm shrink-0">sell</mat-icon>
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
              <span class="ph-no-capture">{{ tag.name }}</span>
            </mat-chip-option>
          }
        </mat-chip-listbox>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTagFilter {
  readonly #dialog = inject(MatDialog);
  readonly tags = input.required<TagFilterOption[]>();
  readonly isMobile = input(false);
  readonly selectedTagIds = model<string[]>([]);
  protected readonly usesDialog = computed(
    () => this.isMobile() || this.tags().length > MAX_INLINE_TAGS,
  );

  onChange(event: MatChipListboxChange): void {
    this.selectedTagIds.set((event.value as string[] | null) ?? []);
  }

  protected openDialog(): void {
    this.#dialog
      .open<BudgetTagFilterDialog, TagFilterDialogData, string[]>(
        BudgetTagFilterDialog,
        {
          data: {
            tags: this.tags(),
            selectedTagIds: this.selectedTagIds(),
          },
          width: 'calc(100vw - 2rem)',
          maxWidth: '30rem',
          maxHeight: '80dvh',
        },
      )
      .afterClosed()
      .subscribe((selectedTagIds) => {
        if (selectedTagIds) this.selectedTagIds.set(selectedTagIds);
      });
  }
}
