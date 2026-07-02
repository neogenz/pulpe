import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { type FieldTree } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import {
  MatAutocompleteModule,
  type MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MAX_TAGS_PER_TRANSACTION } from 'pulpe-shared';
import { TagStore } from '@core/tag';

interface TagSuggestion {
  readonly type: 'existing' | 'create';
  readonly id?: string;
  readonly name: string;
}

/**
 * Reusable multi-select tag picker for transactions (PUL-18). Binds to a
 * signal-forms `FieldTree<string[]>` of tag ids — mirroring `pulpe-amount-input`
 * — so parent forms wire it with `[control]="form.tagIds"`. Selecting an
 * autocomplete option attaches an existing tag; the "create" option provisions
 * a new tag through `TagStore` and attaches it.
 */
@Component({
  selector: 'pulpe-tag-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <mat-form-field
      appearance="outline"
      subscriptSizing="dynamic"
      class="w-full"
    >
      <mat-label>{{ 'tagPicker.label' | transloco }}</mat-label>
      <mat-chip-grid
        #chipGrid
        [attr.aria-label]="'tagPicker.label' | transloco"
      >
        @for (id of selectedIds(); track id) {
          <mat-chip-row (removed)="removeTag(id)">
            {{ tagName(id) }}
            <button
              matChipRemove
              [attr.aria-label]="
                'tagPicker.removeAriaLabel' | transloco: { name: tagName(id) }
              "
            >
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip-row>
        }
        <input
          #tagInput
          [placeholder]="'tagPicker.placeholder' | transloco"
          [matChipInputFor]="chipGrid"
          [matAutocomplete]="auto"
          [disabled]="isAtMax()"
          (input)="onInput($event)"
        />
      </mat-chip-grid>
      <mat-autocomplete
        #auto
        autoActiveFirstOption
        (optionSelected)="onOptionSelected($event)"
      >
        @for (suggestion of suggestions(); track suggestion.name) {
          <mat-option [value]="suggestion">
            @if (suggestion.type === 'create') {
              <span class="flex items-center gap-2">
                <mat-icon class="mat-icon-sm">add</mat-icon>
                {{
                  'tagPicker.createOption'
                    | transloco: { name: suggestion.name }
                }}
              </span>
            } @else {
              {{ suggestion.name }}
            }
          </mat-option>
        }
      </mat-autocomplete>
      <mat-hint>{{
        isAtMax()
          ? ('tagPicker.maxReached' | transloco)
          : ('tagPicker.hint' | transloco)
      }}</mat-hint>
    </mat-form-field>
  `,
  host: { class: 'block' },
})
export class TagPicker {
  readonly control = input.required<FieldTree<string[]>>();

  readonly #tagStore = inject(TagStore);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

  private readonly tagInputRef =
    viewChild<ElementRef<HTMLInputElement>>('tagInput');

  protected readonly query = signal('');

  /**
   * Deferred required-input read. The `selectedIds` computed below is evaluated
   * during view init — before the `control` binding propagates — which throws
   * NG0950 on a direct `this.control()`. Wrapping the read defers it to the next
   * change-detection tick. Mirrors `pulpe-amount-input`.
   */
  readonly #safeControl = computed(() => {
    try {
      return this.control();
    } catch (error) {
      if (error instanceof Error && error.message.includes('NG0950')) {
        return null;
      }
      throw error;
    }
  });

  protected readonly selectedIds = computed(
    () => this.#safeControl()?.().value() ?? [],
  );

  protected readonly isAtMax = computed(
    () => this.selectedIds().length >= MAX_TAGS_PER_TRANSACTION,
  );

  protected readonly suggestions = computed<TagSuggestion[]>(() => {
    const query = this.query().trim();
    const lowerQuery = query.toLocaleLowerCase();
    const selected = new Set(this.selectedIds());
    const allTags = this.#tagStore.tags.value() ?? [];

    const existing: TagSuggestion[] = allTags
      .filter(
        (tag) =>
          !selected.has(tag.id) &&
          (query === '' || tag.name.toLocaleLowerCase().includes(lowerQuery)),
      )
      .map((tag) => ({ type: 'existing', id: tag.id, name: tag.name }));

    const exactMatchExists = allTags.some(
      (tag) => tag.name.toLocaleLowerCase() === lowerQuery,
    );
    if (query !== '' && !exactMatchExists) {
      return [...existing, { type: 'create', name: query }];
    }
    return existing;
  });

  protected tagName(id: string): string {
    return this.#tagStore.tagNameById().get(id) ?? id;
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async onOptionSelected(
    event: MatAutocompleteSelectedEvent,
  ): Promise<void> {
    const suggestion = event.option.value as TagSuggestion;
    this.#resetInput();
    if (this.isAtMax()) return;

    if (suggestion.type === 'existing' && suggestion.id) {
      this.#attach(suggestion.id);
      return;
    }

    const created = await this.#tagStore.addTag(suggestion.name);
    if (created) {
      this.#attach(created.id);
    } else {
      this.#snackBar.open(
        this.#transloco.translate('tagPicker.createError'),
        this.#transloco.translate('common.close'),
        { duration: 4000 },
      );
    }
  }

  protected removeTag(id: string): void {
    this.control()().value.set(
      this.selectedIds().filter((tagId) => tagId !== id),
    );
  }

  #attach(id: string): void {
    const current = this.selectedIds();
    if (current.includes(id)) return;
    this.control()().value.set([...current, id]);
  }

  #resetInput(): void {
    const input = this.tagInputRef()?.nativeElement;
    if (input) input.value = '';
    this.query.set('');
  }
}
