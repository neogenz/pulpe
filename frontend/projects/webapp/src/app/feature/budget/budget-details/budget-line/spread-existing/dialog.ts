import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { splitTotalPreserving } from 'pulpe-shared';
import { formatDate } from 'date-fns';

import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';
import { dateFnsLocaleFor } from '@core/locale';
import {
  defaultSpreadEnd,
  enumerateMonths,
  MAX_SPREAD_MONTHS,
  monthKey,
  offsetMonth,
  type SpreadMonth,
} from '../create/spread.utils';
import type {
  SpreadExistingDialogData,
  SpreadExistingDialogResult,
} from './dialog-result';

const MIN_SPREAD_MONTHS = 2;

/**
 * SPREAD-EXISTING (PUL-17 v1.1) — total-preserving "lisser une dépense
 * existante". The source total `T` is LOCKED (read-only): the user only picks
 * the end month, and `T` is redistributed into `T/N` per month, M0 included
 * (its amount drops to T/N). The live per-month preview uses the SAME
 * `splitTotalPreserving` as the server, so the echo always equals what is
 * persisted. Distinct from the create-time toggle (additive). N ≥ 2 — spreading
 * over a single month is a no-op. Emits the chosen `periods` (sorted, incl M0).
 */
@Component({
  selector: 'pulpe-spread-existing-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  host: { 'data-testid': 'spread-existing-dialog' },
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'budgetLine.spread.dialogTitle' | transloco }}
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-4 pt-4">
        <!-- Locked total card -->
        <div
          class="flex items-center justify-between rounded-corner-medium bg-surface-container px-4 py-3"
          data-testid="spread-existing-total"
        >
          <span
            class="flex items-center gap-2 text-body-medium text-on-surface-variant"
          >
            <mat-icon
              class="text-on-surface-variant !text-lg !w-[18px] !h-[18px]"
              >lock</mat-icon
            >
            {{ 'budgetLine.spread.lockedTotalLabel' | transloco }}
          </span>
          <span class="text-title-medium font-medium ph-no-capture">
            {{ total() | appCurrency: currency() : '1.2-2' }}
          </span>
        </div>

        <p class="text-body-small text-on-surface-variant">
          {{ 'budgetLine.spread.help' | transloco }}
        </p>

        <div class="flex gap-3">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="flex-1"
          >
            <mat-label>{{
              'budgetLine.spread.fromLabel' | transloco
            }}</mat-label>
            <mat-select
              [value]="startKey()"
              disabled
              data-testid="spread-existing-from"
            >
              <mat-option [value]="startKey()">{{ startLabel() }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="flex-1"
          >
            <mat-label>{{ 'budgetLine.spread.toLabel' | transloco }}</mat-label>
            <mat-select
              [value]="endKey()"
              (selectionChange)="setEnd($event.value)"
              data-testid="spread-existing-to"
            >
              @for (m of monthOptions(); track m.key) {
                <mat-option [value]="m.key">{{ m.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (rangeMonths().length > 0) {
          <div
            role="group"
            [attr.aria-label]="'budget.spreadMonthsLabel' | transloco"
            class="flex flex-wrap gap-2"
            data-testid="spread-existing-months-grid"
          >
            @for (m of rangeMonths(); track m.key) {
              <button
                type="button"
                class="spread-month-chip"
                [class.is-selected]="isSelected(m.key)"
                [attr.aria-pressed]="isSelected(m.key)"
                (click)="toggleMonth(m.key)"
                [attr.data-testid]="'spread-existing-month-' + m.key"
              >
                {{ m.shortLabel }}
              </button>
            }
          </div>
        }

        @if (selectedCount() < MIN_SPREAD_MONTHS) {
          <p
            role="alert"
            class="text-error text-body-small"
            data-testid="spread-existing-error"
          >
            {{ 'budgetLine.spread.errorSingleMonth' | transloco }}
          </p>
        } @else {
          <div class="flex flex-col gap-2" data-testid="spread-existing-echo">
            <p
              class="rounded-corner-small bg-surface-container-low px-3 py-2 text-body-medium text-on-surface ph-no-capture"
              data-testid="spread-existing-disclosure"
            >
              {{
                confirmKey()
                  | transloco
                    : {
                        count: selectedCount(),
                        perMonth:
                          perMonth() | appCurrency: currency() : '1.2-2',
                        total: total() | appCurrency: currency() : '1.2-2',
                      }
              }}
            </p>
            <p class="text-body-small text-on-surface-variant">
              {{
                'budgetLine.spread.perMonthEcho'
                  | transloco
                    : {
                        perMonth:
                          perMonth() | appCurrency: currency() : '1.2-2',
                        count: selectedCount(),
                      }
              }}
            </p>
            @if (remainderMonthLabel(); as remainderLabel) {
              <p class="text-body-small text-on-surface-variant">
                {{
                  'budgetLine.spread.remainderHint'
                    | transloco: { month: remainderLabel }
                }}
              </p>
            }
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" data-testid="spread-existing-cancel">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="submit()"
        [disabled]="!canSubmit()"
        data-testid="spread-existing-submit"
      >
        <mat-icon>calendar_month</mat-icon>
        {{ 'budgetLine.spread.submit' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .spread-month-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 4.5rem;
      min-height: 2.75rem;
      padding: 0.375rem 0.75rem;
      border-radius: var(--mat-sys-corner-full);
      border: 1px solid var(--mat-sys-outline);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      cursor: pointer;
      transition:
        background-color 150ms var(--pulpe-ease-standard),
        color 150ms var(--pulpe-ease-standard),
        border-color 150ms var(--pulpe-ease-standard);

      &.is-selected {
        background-color: var(--mat-sys-primary);
        border-color: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        text-decoration: none;
      }

      &:not(.is-selected) {
        text-decoration: line-through;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpreadExistingDialog {
  readonly #dialogRef =
    inject<MatDialogRef<SpreadExistingDialog, SpreadExistingDialogResult>>(
      MatDialogRef,
    );
  readonly #data = inject<SpreadExistingDialogData>(MAT_DIALOG_DATA);
  readonly #settings = inject(UserSettingsStore);

  protected readonly MIN_SPREAD_MONTHS = MIN_SPREAD_MONTHS;
  protected readonly currency = this.#settings.currency;
  protected readonly total = computed(() => this.#data.total);

  // Source-aware honesty disclosure: a réel is REPLACED by the plan (M0 → T/N),
  // a prévision is replaced by N mensualités. Shown before the user confirms.
  protected readonly confirmKey = computed(() =>
    this.#data.source === 'transaction'
      ? 'budgetLine.spread.confirmTransaction'
      : 'budgetLine.spread.confirmForecast',
  );

  // M0 — the source's own month, the spread window start (forward-only).
  readonly #start: SpreadMonth = {
    year: this.#data.year,
    month: this.#data.month,
  };
  readonly #end = signal<SpreadMonth>(defaultSpreadEnd(this.#start));
  // Months explicitly deselected (a month not in this set is selected).
  readonly #deselected = signal<ReadonlySet<string>>(new Set());

  protected readonly startKey = computed(() => monthKey(this.#start));
  protected readonly endKey = computed(() => monthKey(this.#end()));

  readonly #dateFnsLocale = computed(() =>
    dateFnsLocaleFor(this.#settings.currency()),
  );

  protected readonly startLabel = computed(() =>
    this.#formatMonth(this.#start, 'MMMM yyyy'),
  );

  // 36-month forward horizon from M0 for the À picker (M0 itself excluded:
  // the end must be strictly after the start so N ≥ 2 is reachable).
  protected readonly monthOptions = computed(() => {
    const last = offsetMonth(this.#start, MAX_SPREAD_MONTHS - 1);
    return enumerateMonths(offsetMonth(this.#start, 1), last).map(
      (m) => ({
        key: monthKey(m),
        label: this.#formatMonth(m, 'MMMM yyyy'),
      }),
    );
  });

  protected readonly rangeMonths = computed(() =>
    enumerateMonths(this.#start, this.#end()).map((m) => ({
      key: monthKey(m),
      shortLabel: this.#formatMonth(m, 'MMM yy'),
    })),
  );

  protected readonly selectedMonths = computed<SpreadMonth[]>(() => {
    const deselected = this.#deselected();
    return enumerateMonths(this.#start, this.#end()).filter(
      (m) => !deselected.has(monthKey(m)),
    );
  });

  protected readonly selectedCount = computed(
    () => this.selectedMonths().length,
  );

  // The per-month tranche shown in the echo. splitTotalPreserving returns the
  // remainder-loaded first tranches; we surface the base (non-remainder) value
  // — the representative "X par mois" — and name the last remainder month.
  readonly #split = computed(() => {
    const count = this.selectedCount();
    if (count < MIN_SPREAD_MONTHS) return [];
    return splitTotalPreserving(this.total(), count);
  });

  protected readonly perMonth = computed(() => {
    const split = this.#split();
    return split.at(-1) ?? 0;
  });

  protected readonly remainderMonthLabel = computed<string | null>(() => {
    const split = this.#split();
    if (split.length === 0) return null;
    const base = split.at(-1);
    const remainderCount = split.filter((amount) => amount !== base).length;
    if (remainderCount === 0) return null;
    const remainderMonths = this.selectedMonths().slice(0, remainderCount);
    const lastRemainder = remainderMonths.at(-1);
    return lastRemainder ? this.#formatMonth(lastRemainder, 'MMMM') : null;
  });

  protected readonly canSubmit = computed(
    () => this.selectedCount() >= MIN_SPREAD_MONTHS,
  );

  protected isSelected(key: string): boolean {
    return !this.#deselected().has(key);
  }

  protected setEnd(key: string): void {
    const period = this.#parseKey(key);
    if (period) this.#end.set(period);
  }

  protected toggleMonth(key: string): void {
    // M0 is never deselectable — the source month always carries a tranche.
    if (key === this.startKey()) return;
    this.#deselected.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.#dialogRef.close({
      periods: this.selectedMonths().map((m) => ({
        year: m.year,
        month: m.month,
      })),
    });
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }

  #formatMonth(period: SpreadMonth, pattern: string): string {
    return formatDate(new Date(period.year, period.month - 1, 1), pattern, {
      locale: this.#dateFnsLocale(),
    });
  }

  #parseKey(key: string): SpreadMonth | null {
    const [year, month] = key.split('-').map(Number);
    if (Number.isNaN(year) || Number.isNaN(month)) return null;
    return { year, month };
  }
}
