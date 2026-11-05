import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { isApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { NetWorthStore } from '../services/net-worth-store';

const MAX_CATEGORY_NAME_LENGTH = 30;

/** « Mes catégories »: rename, delete (refused while a category still holds items) and add. */
@Component({
  selector: 'pulpe-asset-categories-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  host: { 'data-testid': 'asset-categories-dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'netWorth.categoriesDialog.title' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="mb-4 text-body-medium text-on-surface-variant">
        {{ 'netWorth.categoriesDialog.description' | transloco }}
      </p>

      @if (rows().length === 0) {
        <p class="py-2 text-body-medium text-on-surface-variant">
          {{ 'netWorth.categoriesDialog.empty' | transloco }}
        </p>
      } @else {
        <ul class="m-0 list-none p-0" data-testid="asset-categories-list">
          @for (row of rows(); track row.id) {
            <li
              class="flex flex-wrap items-center gap-x-1 border-b border-outline-variant py-2 last:border-b-0"
            >
              @if (renamingId() === row.id) {
                <mat-form-field
                  appearance="outline"
                  subscriptSizing="dynamic"
                  class="min-w-0 flex-1"
                >
                  <mat-label>{{
                    'netWorth.categoriesDialog.nameLabel' | transloco
                  }}</mat-label>
                  <input
                    matInput
                    class="ph-no-capture"
                    [maxlength]="maxNameLength"
                    [ngModel]="draftName()"
                    (ngModelChange)="draftName.set($event)"
                    (keydown.enter)="saveName(row.id)"
                    data-testid="asset-category-rename-input"
                  />
                </mat-form-field>
                <button
                  matIconButton
                  [disabled]="draftName().trim() === '' || isSaving()"
                  [attr.aria-label]="
                    'netWorth.categoriesDialog.saveName' | transloco
                  "
                  (click)="saveName(row.id)"
                  data-testid="asset-category-rename-save-button"
                >
                  <mat-icon>check</mat-icon>
                </button>
                <button
                  matIconButton
                  [attr.aria-label]="
                    'netWorth.categoriesDialog.cancelRename' | transloco
                  "
                  (click)="renamingId.set(null)"
                >
                  <mat-icon>close</mat-icon>
                </button>
              } @else {
                <span class="ph-no-capture min-w-0 flex-1">
                  <span class="block truncate text-body-large">{{
                    row.name
                  }}</span>
                  <span
                    class="block truncate text-body-small text-on-surface-variant"
                    >{{ row.assetNames.join(', ') }}</span
                  >
                </span>
                <button
                  matIconButton
                  [attr.aria-label]="
                    'netWorth.categoriesDialog.rename'
                      | transloco: { name: row.name }
                  "
                  (click)="startRename(row.id, row.name)"
                  data-testid="asset-category-rename-button"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  matIconButton
                  [class.text-error]="blockedId() === row.id"
                  [attr.aria-label]="
                    'netWorth.categoriesDialog.delete'
                      | transloco: { name: row.name }
                  "
                  [attr.aria-describedby]="
                    blockedId() === row.id ? 'asset-category-blocked' : null
                  "
                  (click)="remove(row)"
                  data-testid="asset-category-delete-button"
                >
                  <mat-icon>delete</mat-icon>
                </button>
                @if (blockedId() === row.id) {
                  <p
                    id="asset-category-blocked"
                    role="alert"
                    class="ph-no-capture m-0 flex basis-full items-center gap-1.5 text-body-small text-error"
                    data-testid="asset-category-blocked"
                  >
                    <mat-icon class="mat-icon-sm" aria-hidden="true"
                      >error</mat-icon
                    >
                    {{
                      'netWorth.categoriesDialog.notEmpty'
                        | transloco: { names: namesList(row.assetNames) }
                    }}
                  </p>
                }
              }
            </li>
          }
        </ul>
      }

      <div
        class="mt-4 flex items-start gap-3 border-t border-outline-variant pt-5"
      >
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="min-w-0 flex-1"
        >
          <mat-label>{{
            'netWorth.categoriesDialog.newLabel' | transloco
          }}</mat-label>
          <input
            matInput
            class="ph-no-capture"
            [maxlength]="maxNameLength"
            [placeholder]="
              'netWorth.categoriesDialog.newPlaceholder' | transloco
            "
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            (keydown.enter)="add()"
            data-testid="asset-category-new-input"
          />
        </mat-form-field>
        <button
          matButton="outlined"
          class="mt-1"
          [disabled]="newName().trim() === '' || isSaving()"
          (click)="add()"
          data-testid="asset-category-add-button"
        >
          <mat-icon>add</mat-icon>
          {{ 'netWorth.categoriesDialog.add' | transloco }}
        </button>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        matButton
        mat-dialog-close
        data-testid="asset-categories-close-button"
      >
        {{ 'common.close' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class AssetCategoriesDialog {
  readonly #store = inject(NetWorthStore);
  protected readonly isSaving = this.#store.isSaving;
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #errorLocalizer = inject(ApiErrorLocalizer);
  readonly #listFormat = new Intl.ListFormat(inject(LOCALE_ID), {
    style: 'long',
    type: 'conjunction',
  });

  protected readonly maxNameLength = MAX_CATEGORY_NAME_LENGTH;
  protected readonly renamingId = signal<string | null>(null);
  protected readonly draftName = signal('');
  protected readonly newName = signal('');
  protected readonly blockedId = signal<string | null>(null);

  // Every asset counts, archived ones included: the server refuses to delete a
  // category any asset still points to.
  protected readonly rows = computed(() => {
    const assets = this.#store.assets();
    return this.#store.categories().map((category) => ({
      id: category.id,
      name: category.name,
      assetNames: assets
        .filter((asset) => asset.categoryId === category.id)
        .map((asset) => asset.name),
    }));
  });

  protected namesList(names: string[]): string {
    return this.#listFormat.format(names);
  }

  protected startRename(id: string, name: string): void {
    this.blockedId.set(null);
    this.draftName.set(name);
    this.renamingId.set(id);
  }

  protected async saveName(id: string): Promise<void> {
    const name = this.draftName().trim();
    if (name === '') return;
    if (await this.#attempt(() => this.#store.renameCategory(id, name))) {
      this.renamingId.set(null);
    }
  }

  protected async remove(row: {
    id: string;
    assetNames: string[];
  }): Promise<void> {
    if (row.assetNames.length > 0) {
      this.blockedId.set(row.id);
      return;
    }
    this.blockedId.set(null);
    await this.#attempt(() => this.#store.deleteCategory(row.id));
  }

  protected async add(): Promise<void> {
    const name = this.newName().trim();
    if (name === '') return;
    if (await this.#attempt(() => this.#store.addCategory(name))) {
      this.newName.set('');
    }
  }

  async #attempt(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      return true;
    } catch (error) {
      const message = isApiError(error)
        ? this.#errorLocalizer.localizeApiError(error)
        : this.#transloco.translate('common.error');
      this.#snackBar.open(message, this.#transloco.translate('common.close'), {
        duration: 5000,
        panelClass: ['bg-error-container', 'text-on-error-container'],
      });
      return false;
    }
  }
}
