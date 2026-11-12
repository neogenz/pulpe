import { DatePipe } from '@angular/common';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type {
  Asset,
  AssetCategory,
  AssetDirection,
  SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { touchedFieldErrors } from '@core/validators';
import { UserSettingsStore } from '@core/user-settings';
import { CurrencyInput } from '@ui/currency-input';
import {
  buildAssetCreate,
  buildAssetEdit,
  defaultCategoryKey,
  MAX_TYPE_NAME_LENGTH,
  NEW_CATEGORY_PREFIX,
  OTHER_TYPE_KEY,
  STARTER_TYPE_KEYS,
  typeOptionsFor,
  type AssetFormValue,
} from './asset-form-dialog.schema';

export interface AssetFormDialogData {
  categories: AssetCategory[];
  /** Every element, archived ones included: they tell which Types a direction uses. */
  assets: Asset[];
  /** Present when editing: direction and currency then stay read-only. */
  asset?: Asset;
  isFullScreen?: boolean;
}

/** One sheet for an element: its name, its Type and its value of today. */
@Component({
  selector: 'pulpe-asset-form-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    TranslocoPipe,
    FormField,
    CurrencyInput,
  ],
  providers: [AppCurrencyPipe, DatePipe],
  host: { 'data-testid': 'asset-form-dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex items-start justify-between gap-2">
      <h2 mat-dialog-title class="text-headline-small">
        @if (asset(); as editing) {
          <span class="ph-no-capture">{{
            'netWorth.form.editTitle' | transloco: { name: editing.name }
          }}</span>
        } @else {
          {{ 'netWorth.form.createTitle' | transloco }}
        }
      </h2>
      @if (isFullScreen) {
        <button
          matIconButton
          class="mt-3 mr-3 shrink-0"
          (click)="cancel()"
          [attr.aria-label]="'common.close' | transloco"
          data-testid="asset-close-button"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      }
    </header>

    <mat-dialog-content>
      <!-- pb-2: the checkbox touch target is taller than its box and would
           otherwise make the content scroll by a few pixels. -->
      <div class="flex flex-col gap-5 pt-4 pb-2">
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

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="ph-no-capture w-full"
        >
          <mat-label>{{ 'netWorth.form.category' | transloco }}</mat-label>
          <mat-select
            [value]="model().categoryKey"
            (selectionChange)="setCategory($event.value)"
            data-testid="asset-category-select"
          >
            @for (category of typeOptions().used; track category.id) {
              <mat-option [value]="category.id">
                <span class="ph-no-capture">{{ category.name }}</span>
              </mat-option>
            }
            @for (name of typeOptions().suggestions; track name) {
              <mat-option [value]="newCategoryPrefix + name">{{
                name
              }}</mat-option>
            }
            <mat-option [value]="otherTypeKey">{{
              'netWorth.form.otherType' | transloco
            }}</mat-option>
          </mat-select>
        </mat-form-field>

        @if (isOtherType()) {
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{ 'netWorth.form.typeName' | transloco }}</mat-label>
            <input
              matInput
              class="ph-no-capture"
              [formField]="assetForm.typeName"
              data-testid="asset-type-name-input"
            />
            @if (typeNameErrors().required) {
              <mat-error>{{
                'netWorth.form.nameRequired' | transloco
              }}</mat-error>
            }
          </mat-form-field>
        }

        <pulpe-currency-input
          [label]="'netWorth.form.value' | transloco"
          [value]="model().value"
          (valueChange)="setValue($event)"
          [currency]="model().currency"
          [showCurrencySelector]="!isEdit()"
          (currencyChange)="setCurrency($event)"
          [hint]="lastValueHint()"
          [autoFocus]="false"
          testId="asset-value-input"
        />

        @if (model().direction === 'own') {
          <mat-checkbox
            class="-mt-3"
            [checked]="model().isOverdraft"
            (change)="setOverdraft($event.checked)"
            data-testid="asset-overdraft-checkbox"
          >
            {{ 'netWorth.value.overdraft' | transloco }}
          </mat-checkbox>
        }
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
  styles: `
    :host-context(.full-screen-dialog) {
      display: flex;
      flex-direction: column;
      height: 100%;
      mat-dialog-content {
        flex: 1;
        max-height: none;
      }
    }
  `,
})
export class AssetFormDialog {
  readonly #dialogRef = inject(MatDialogRef<AssetFormDialog>);
  readonly #data = inject<AssetFormDialogData>(MAT_DIALOG_DATA);
  readonly #transloco = inject(TranslocoService);
  readonly #settings = inject(UserSettingsStore);
  readonly #currencyPipe = inject(AppCurrencyPipe);
  readonly #datePipe = inject(DatePipe);

  protected readonly newCategoryPrefix = NEW_CATEGORY_PREFIX;
  protected readonly otherTypeKey = OTHER_TYPE_KEY;
  protected readonly isFullScreen = this.#data.isFullScreen === true;
  protected readonly asset = computed(() => this.#data.asset ?? null);
  protected readonly isEdit = computed(() => this.asset() !== null);

  protected readonly model = signal<AssetFormValue>(this.#initialValue());

  protected readonly typeOptions = computed(() =>
    this.#typeOptions(this.model().direction),
  );

  protected readonly assetForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 100);
    required(path.typeName, {
      when: ({ valueOf }) => valueOf(path.categoryKey) === OTHER_TYPE_KEY,
    });
    maxLength(path.typeName, MAX_TYPE_NAME_LENGTH);
  });
  protected readonly nameErrors = touchedFieldErrors(
    () => this.assetForm.name,
    'required',
  );

  protected readonly typeNameErrors = touchedFieldErrors(
    () => this.assetForm.typeName,
    'required',
  );

  protected readonly isOtherType = computed(
    () => this.model().categoryKey === OTHER_TYPE_KEY,
  );
  protected readonly lastValueHint = computed(() => {
    const asset = this.asset();
    if (!asset) return undefined;
    return this.#transloco.translate('netWorth.value.lastValue', {
      // The overdraft box carries the sign, as in the field above.
      amount: this.#currencyPipe.transform(
        Math.abs(asset.latestValue),
        asset.currency,
        '1.2-2',
      ),
      date: this.#datePipe.transform(asset.latestRecordedAt, 'longDate'),
    });
  });
  protected readonly canSubmit = computed(() => {
    const { name, typeName, value } = this.model();
    return (
      name.trim() !== '' &&
      (!this.isOtherType() || typeName.trim() !== '') &&
      value !== null &&
      value >= 0
    );
  });

  // A Type belongs to one side, so switching sides picks that side's default.
  protected setDirection(direction: AssetDirection): void {
    this.model.update((m) => ({
      ...m,
      direction,
      categoryKey: defaultCategoryKey(this.#typeOptions(direction)),
    }));
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

  protected setOverdraft(isOverdraft: boolean): void {
    this.model.update((m) => ({ ...m, isOverdraft }));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    const asset = this.asset();
    if (!asset) {
      this.#dialogRef.close(buildAssetCreate(this.model()));
      return;
    }
    const edit = buildAssetEdit(this.model(), asset);
    // An untouched sheet closes like a cancel: nothing to send.
    this.#dialogRef.close(Object.keys(edit).length > 0 ? edit : undefined);
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }

  #initialValue(): AssetFormValue {
    const asset = this.#data.asset;
    if (asset) {
      return {
        name: asset.name,
        direction: asset.direction,
        categoryKey: asset.categoryId,
        typeName: '',
        currency: asset.currency,
        value: Math.abs(asset.latestValue),
        isOverdraft: asset.latestValue < 0,
      };
    }
    return {
      name: '',
      direction: 'own',
      categoryKey: defaultCategoryKey(this.#typeOptions('own')),
      typeName: '',
      currency: this.#settings.currency(),
      value: null,
      isOverdraft: false,
    };
  }

  #typeOptions(direction: AssetDirection) {
    return typeOptionsFor(
      direction,
      this.#data.categories,
      this.#data.assets,
      STARTER_TYPE_KEYS[direction].map((key) => this.#transloco.translate(key)),
    );
  }
}
