import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import type { MonthRecap } from '../services/dashboard-state';

export interface MonthRecapDialogData {
  recap: MonthRecap;
  currentMonth: number;
  currentYear: number;
  currency: SupportedCurrency;
}

/** `undefined` when closed by Escape or the backdrop: the card stays. */
export type MonthRecapDialogResult = 'details' | 'acknowledged';

@Component({
  selector: 'pulpe-month-recap-dialog',
  host: { 'data-testid': 'month-recap-dialog' },
  imports: [MatDialogModule, MatButtonModule, TranslocoPipe, AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ 'currentMonth.monthRecap.dialogTitle' | transloco }}
      <span class="block text-body-medium text-on-surface-variant capitalize">
        {{ closedMonthLabel }}
      </span>
    </h2>

    <mat-dialog-content>
      <dl class="flex flex-col gap-3">
        <div class="flex justify-between gap-4">
          <dt class="text-body-large text-on-surface-variant">
            {{ 'currentMonth.monthRecap.income' | transloco }}
          </dt>
          <dd
            class="text-body-large font-medium tabular-nums text-financial-income ph-no-capture"
          >
            {{ data.recap.income | appCurrency: data.currency : '1.0-0' }}
          </dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-body-large text-on-surface-variant">
            {{ 'currentMonth.monthRecap.expenses' | transloco }}
          </dt>
          <dd
            class="text-body-large font-medium tabular-nums text-financial-expense ph-no-capture"
          >
            {{ data.recap.expenses | appCurrency: data.currency : '1.0-0' }}
          </dd>
        </div>
        <div
          class="flex justify-between gap-4 border-t border-outline-variant pt-3"
        >
          <dt class="text-title-medium font-bold text-on-surface">
            {{ 'currentMonth.monthRecap.endingBalance' | transloco }}
          </dt>
          <dd
            class="text-title-medium font-bold tabular-nums ph-no-capture"
            [class]="
              data.recap.endingBalance >= 0
                ? 'text-financial-savings'
                : 'text-financial-negative'
            "
            data-testid="month-recap-ending-balance"
          >
            {{
              data.recap.endingBalance | appCurrency: data.currency : '1.0-0'
            }}
          </dd>
        </div>
      </dl>

      <p
        class="mt-6 rounded-2xl bg-surface-container-low p-4 text-body-medium text-on-surface"
        data-testid="month-recap-carry-over"
      >
        <span class="font-bold tabular-nums ph-no-capture">{{
          data.recap.carriedOver | appCurrency: data.currency : '1.0-0'
        }}</span>
        {{
          'currentMonth.monthRecap.carriedOver'
            | transloco: { month: currentMonthName }
        }}
        <span class="font-bold tabular-nums ph-no-capture">{{
          data.recap.startingAvailable | appCurrency: data.currency : '1.0-0'
        }}</span>
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton
        (click)="close('details')"
        data-testid="month-recap-details-button"
      >
        {{ 'currentMonth.monthRecap.viewDetails' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="close('acknowledged')"
        data-testid="month-recap-acknowledge-button"
      >
        {{ 'currentMonth.monthRecap.acknowledge' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class MonthRecapDialog {
  readonly #dialogRef = inject(
    MatDialogRef<MonthRecapDialog, MonthRecapDialogResult>,
  );
  readonly #locale = inject(LOCALE_ID);
  protected readonly data = inject<MonthRecapDialogData>(MAT_DIALOG_DATA);

  protected readonly closedMonthLabel = new Intl.DateTimeFormat(this.#locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(this.data.recap.year, this.data.recap.month - 1, 1));

  protected readonly currentMonthName = new Intl.DateTimeFormat(this.#locale, {
    month: 'long',
  }).format(new Date(this.data.currentYear, this.data.currentMonth - 1, 1));

  protected close(result: MonthRecapDialogResult): void {
    this.#dialogRef.close(result);
  }
}
