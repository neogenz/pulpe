import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  SUPPORTED_CURRENCIES,
  type Asset,
  type AssetCategory,
  type AssetDirection,
  type SupportedCurrency,
} from 'pulpe-shared';
import { touchedFieldErrors } from '@core/validators';
import { UserSettingsStore } from '@core/user-settings';
import { CurrencyInput } from '@ui/currency-input';
import {
  buildAssetCreate,
  buildAssetEdit,
  NEW_CATEGORY_PREFIX,
  type AssetFormValue,
} from './asset-form-dialog.schema';

export interface AssetFormDialogData {
  categories: AssetCategory[];
  /** Present when editing: direction and currency then stay read-only. */
  asset?: Asset;
}

const STARTER_CATEGORY_KEYS = [
  'accounts',
  'savings',
  'investments',
  'cash',
  'valuables',
  'property',
] as const;

@Component({
  selector: 'pulpe-asset-form-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    TranslocoPipe,
    FormField,
    CurrencyInput,
  ],
  host: { 'data-testid': 'asset-form-dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      @if (asset(); as editing) {
        <span class="ph-no-capture">{{
          'netWorth.form.editTitle' | transloco: { name: editing.name }
        }}</span>
      } @else {
        {{ 'netWorth.form.createTitle' | transloco }}
      }
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-5 pt-4">
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>{{ 'netWorth.form.name' | transloco }}</mat-label>
          <input
            matInput
            class="ph-no-capture"
            [formField]="assetForm.name"
            data-testid="asset-name-input"
          />
          @if (nameErrors().required) {
            <mat-error>{{
              'netWorth.form.nameRequired' | transloco
            }}</mat-error>
          }
        </mat-form-field>

        <mat-button-toggle-group
          class="w-full"
          [value]="model().direction"
          [disabled]="isEdit()"
          [attr.aria-label]="'netWorth.form.direction' | transloco"
          (change)="setDirection($event.value)"
          data-testid="asset-direction-toggle"
        >
          <mat-button-toggle value="own" class="flex-1">{{
            'netWorth.form.own' | transloco
          }}</mat-button-toggle>
          <mat-button-toggle value="owe" class="flex-1">{{
            'netWorth.form.owe' | transloco
          }}</mat-button-toggle>
        </mat-button-toggle-group>

        <div>
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'netWorth.form.category' | transloco }}</mat-label>
            <mat-select
              [value]="model().categoryKey"
              (selectionChange)="setCategory($event.value)"
              data-testid="asset-category-select"
            >
              @if (categories().length > 0) {
                <mat-optgroup
                  [label]="'netWorth.form.myCategories' | transloco"
                >
                  @for (category of categories(); track category.id) {
                    <mat-option [value]="category.id">
                      <span class="ph-no-capture">{{ category.name }}</span>
                    </mat-option>
                  }
                </mat-optgroup>
              }
              @if (suggestions().length > 0) {
                <mat-optgroup [label]="'netWorth.form.suggestions' | transloco">
                  @for (name of suggestions(); track name) {
                    <mat-option [value]="newCategoryPrefix + name">
                      {{ name }}
                      <span
                        class="ml-2 text-label-small text-on-surface-variant"
                        >{{ 'netWorth.form.newTag' | transloco }}</span
                      >
                    </mat-option>
                  }
                </mat-optgroup>
              }
            </mat-select>
            @if (isNewCategory()) {
              <mat-hint>{{
                'netWorth.form.newCategoryHint' | transloco
              }}</mat-hint>
            }
          </mat-form-field>
        </div>

        <div class="flex gap-4">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-36 shrink-0"
          >
            <mat-label>{{ 'netWorth.form.currency' | transloco }}</mat-label>
            <mat-select
              [value]="model().currency"
              [disabled]="isEdit()"
              (selectionChange)="setCurrency($event.value)"
              data-testid="asset-currency-select"
            >
              @for (code of currencies; track code) {
                <mat-option [value]="code">{{ code }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (!isEdit()) {
            <pulpe-currency-input
              class="min-w-0 flex-1"
              [label]="'netWorth.form.value' | transloco"
              [value]="model().value"
              (valueChange)="setValue($event)"
              [currency]="model().currency"
              [autoFocus]="false"
              testId="asset-value-input"
            />
          }
        </div>

        @if (isEdit()) {
          <p class="text-body-small text-on-surface-variant">
            {{ 'netWorth.form.readOnlyHint' | transloco }}
            {{ 'netWorth.form.editNote' | transloco }}
          </p>
        }

        <mat-slide-toggle
          [checked]="model().inPulpe"
          (change)="setInPulpe($event.checked)"
          data-testid="asset-in-pulpe-toggle"
        >
          <span class="block text-body-large">{{
            'netWorth.form.inPulpe' | transloco
          }}</span>
          <span class="block text-body-medium text-on-surface-variant">{{
            'netWorth.form.inPulpeHint' | transloco
          }}</span>
        </mat-slide-toggle>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button matButton (click)="cancel()" data-testid="asset-cancel-button">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        [disabled]="!canSubmit()"
        (click)="submit()"
        data-testid="asset-submit-button"
      >
        {{ (isEdit() ? 'common.save' : 'netWorth.form.add') | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class AssetFormDialog {
  readonly #dialogRef = inject(MatDialogRef<AssetFormDialog>);
  readonly #data = inject<AssetFormDialogData>(MAT_DIALOG_DATA);
  readonly #transloco = inject(TranslocoService);
  readonly #settings = inject(UserSettingsStore);

  protected readonly currencies = SUPPORTED_CURRENCIES;
  protected readonly newCategoryPrefix = NEW_CATEGORY_PREFIX;
  protected readonly categories = computed(() => this.#data.categories);
  protected readonly asset = computed(() => this.#data.asset ?? null);
  protected readonly isEdit = computed(() => this.asset() !== null);

  // Starter names not yet taken: a category is only created when one is picked.
  protected readonly suggestions = computed(() => {
    const taken = new Set(
      this.#data.categories.map((category) => category.name.toLowerCase()),
    );
    return STARTER_CATEGORY_KEYS.map((key) =>
      this.#transloco.translate(`netWorth.starter.${key}`),
    ).filter((name) => !taken.has(name.toLowerCase()));
  });

  protected readonly model = signal<AssetFormValue>({
    name: this.#data.asset?.name ?? '',
    direction: this.#data.asset?.direction ?? 'own',
    categoryKey: this.#data.asset?.categoryId ?? '',
    currency: this.#data.asset?.currency ?? this.#settings.currency(),
    value: null,
    inPulpe: this.#data.asset?.inPulpe ?? false,
  });

  protected readonly assetForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 100);
  });
  protected readonly nameErrors = touchedFieldErrors(
    () => this.assetForm.name,
    'required',
  );

  protected readonly isNewCategory = computed(() =>
    this.model().categoryKey.startsWith(NEW_CATEGORY_PREFIX),
  );
  protected readonly canSubmit = computed(() => {
    const { name, categoryKey, value } = this.model();
    return (
      name.trim() !== '' &&
      categoryKey !== '' &&
      (this.isEdit() || (value !== null && value >= 0))
    );
  });

  protected setDirection(direction: AssetDirection): void {
    this.model.update((m) => ({ ...m, direction }));
  }

  protected setCategory(categoryKey: string): void {
    this.model.update((m) => ({ ...m, categoryKey }));
  }

  protected setCurrency(currency: SupportedCurrency): void {
    this.model.update((m) => ({ ...m, currency }));
  }

  protected setValue(value: number | null): void {
    this.model.update((m) => ({ ...m, value }));
  }

  protected setInPulpe(inPulpe: boolean): void {
    this.model.update((m) => ({ ...m, inPulpe }));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.#dialogRef.close(
      this.isEdit()
        ? buildAssetEdit(this.model())
        : buildAssetCreate(this.model()),
    );
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }
}
