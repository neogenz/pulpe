import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Asset } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { CurrencyInput } from '@ui/currency-input';

export interface AssetValueDialogData {
  asset: Asset;
}

/** Closes with the new signed value; a debt's value is never negative. */
@Component({
  selector: 'pulpe-asset-value-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    TranslocoPipe,
    AppCurrencyPipe,
    DatePipe,
    CurrencyInput,
  ],
  host: { 'data-testid': 'asset-value-dialog' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'netWorth.value.title' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="ph-no-capture mb-4 text-body-medium text-on-surface-variant">
        {{
          (asset.direction === 'own'
            ? 'netWorth.value.subtitleOwn'
            : 'netWorth.value.subtitleOwe'
          ) | transloco: { name: asset.name }
        }}
      </p>

      <pulpe-currency-input
        [label]="'netWorth.value.label' | transloco"
        [(value)]="magnitude"
        [currency]="asset.currency"
        testId="asset-new-value-input"
      />
      <p
        class="ph-no-capture -mt-2 mb-2 px-4 text-body-small text-on-surface-variant"
      >
        {{
          'netWorth.value.lastValue'
            | transloco
              : {
                  amount:
                    asset.latestValue | appCurrency: asset.currency : '1.2-2',
                  date: asset.latestRecordedAt | date: 'longDate',
                }
        }}
      </p>

      @if (asset.direction === 'own') {
        <mat-checkbox
          [checked]="isOverdraft()"
          (change)="isOverdraft.set($event.checked)"
          data-testid="asset-overdraft-checkbox"
        >
          {{ 'netWorth.value.overdraft' | transloco }}
        </mat-checkbox>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton
        (click)="cancel()"
        data-testid="asset-value-cancel-button"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        [disabled]="!canSubmit()"
        (click)="submit()"
        data-testid="asset-value-submit-button"
      >
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class AssetValueDialog {
  readonly #dialogRef = inject(MatDialogRef<AssetValueDialog>);
  protected readonly asset =
    inject<AssetValueDialogData>(MAT_DIALOG_DATA).asset;

  protected readonly magnitude = signal<number | null>(null);
  protected readonly isOverdraft = signal(this.asset.latestValue < 0);

  protected readonly canSubmit = computed(() => {
    const magnitude = this.magnitude();
    return magnitude !== null && magnitude >= 0;
  });

  protected readonly signedValue = computed(() => {
    const magnitude = this.magnitude() ?? 0;
    return this.isOverdraft() && magnitude !== 0 ? -magnitude : magnitude;
  });

  protected submit(): void {
    this.#dialogRef.close(this.signedValue());
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }
}
