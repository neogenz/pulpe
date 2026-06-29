import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';
import type {
  SpreadOccurrenceViewModel,
  SpreadTracker,
} from './spread-occurrences-list.types';

/**
 * PUL-17 — pure presentational cross-month view of a spread group.
 *
 * Renders the progress tracker (ordinal position · cumulé · `bg-primary` bar ·
 * PUL-290 catch-up) followed by the month-by-month occurrence list (past dimmed,
 * viewed-month badged, future normal, checked struck-through).
 *
 * Pure `ui/`: inputs only, NO `@core/` import, NO store. Amounts use
 * `Intl.NumberFormat` with the currency's `numberLocale` + `CURRENCY_METADATA`
 * symbol suffix — same output as `getCurrencyFormatter`/`AppCurrencyPipe`, but
 * hand-rolled because this view needs three variants the fixed-2-decimal
 * `getCurrencyFormatter` can't produce: 0-dec aggregation, 2-dec ligne, and the
 * composite "consommé / prévu" sharing a single symbol (see
 * `webapp-currency-formatting.md`). Dual decimal policy: tracker cumulé/total +
 * the PUL-290 catch-up (reste à provisionner, à prévoir par mois) = aggregation
 * (0 decimals, per CA8); each occurrence amount = ligne (2 decimals).
 * `ph-no-capture` wraps every amount span, never the month name or the position
 * label.
 *
 * `isCurrentPeriod` distinguishes "this budget IS the live current month"
 * ("Ce mois") from "this is just the month you are looking at" ("Ici").
 */
@Component({
  selector: 'pulpe-spread-occurrences-list',
  imports: [MatIconModule, TranslocoPipe, DatePipe],
  template: `
    @if (tracker(); as t) {
      <div
        class="flex flex-col gap-2"
        [class.mb-6]="density() === 'comfortable'"
        [class.mb-4]="density() === 'compact'"
        data-testid="spread-tracker"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-title-medium font-semibold">
            @if (t.currentIndex === 0) {
              {{ 'budgetLine.spread.trackerNotStarted' | transloco }}
            } @else {
              {{
                'budgetLine.spread.trackerPosition'
                  | transloco: { ordinal: ordinal(), count: t.count }
              }}
            }
          </span>
          <span class="ph-no-capture text-body-medium text-on-surface-variant">
            {{
              'budgetLine.spread.trackerCumulated'
                | transloco
                  : {
                      cumulated: formatAggregation(t.cumulatedAmount),
                      total: formatAggregation(t.totalAmount),
                    }
            }}
          </span>
        </div>
        <div
          class="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          [attr.aria-valuenow]="t.progressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-300"
            [style.width.%]="t.progressPercent"
          ></div>
        </div>
        <!-- PUL-290 — explicit catch-up: replaces the static "T/N par mois"
             (which forced the user to do the math) with the forward-looking
             amount to provision to hit the objectif. Three serene states. -->
        @if (t.remainingToProvision === 0) {
          <span
            class="text-body-small font-medium text-primary"
            data-testid="spread-provision-reached"
          >
            {{ 'budgetLine.spread.trackerGoalReached' | transloco }}
          </span>
        } @else if (t.perRemainingMonth === null) {
          <span
            class="ph-no-capture text-body-small text-on-surface-variant"
            data-testid="spread-provision-final-gap"
          >
            {{
              'budgetLine.spread.trackerFinalGap'
                | transloco
                  : { remaining: formatAggregation(t.remainingToProvision) }
            }}
          </span>
        } @else {
          <span
            class="ph-no-capture text-body-small text-on-surface-variant"
            data-testid="spread-provision-remaining"
          >
            {{
              'budgetLine.spread.trackerRemaining'
                | transloco
                  : { remaining: formatAggregation(t.remainingToProvision) }
            }}
          </span>
          <span
            class="ph-no-capture text-body-small font-medium text-on-surface"
            data-testid="spread-provision-per-month"
          >
            {{
              'budgetLine.spread.trackerPerRemainingMonth'
                | transloco
                  : { perMonth: formatAggregation(t.perRemainingMonth) }
            }}
          </span>
        }
      </div>
    }

    <div class="flex flex-col gap-2">
      @for (vm of occurrences(); track vm.occurrence.budgetLineId) {
        <div
          class="flex items-center justify-between gap-3 rounded-xl
                 bg-surface-container-low"
          [class.p-4]="density() === 'comfortable'"
          [class.p-3]="density() === 'compact'"
          [class.opacity-60]="vm.isPast"
          [attr.data-testid]="'spread-occurrence-' + vm.occurrence.budgetLineId"
          [attr.data-current]="vm.isViewed"
          [attr.data-past]="vm.isPast"
        >
          <div class="min-w-0 flex items-center gap-2">
            <span
              class="text-body-medium font-medium capitalize"
              [class.line-through]="vm.isChecked"
              [class.text-on-surface-variant]="vm.isChecked"
            >
              {{
                monthDates().get(vm.occurrence.budgetLineId)
                  | date: 'MMMM yyyy' : undefined : locale()
              }}
            </span>
            @if (vm.isViewed) {
              <span
                class="text-label-small font-medium rounded-full px-2 py-0.5
                       bg-primary-container text-on-primary-container shrink-0"
                data-testid="spread-current-marker"
              >
                @if (isCurrentPeriod()) {
                  {{ 'budgetLine.spread.currentMonth' | transloco }}
                } @else {
                  {{ 'budgetLine.spread.viewedMonth' | transloco }}
                }
              </span>
            }
          </div>
          @if (vm.occurrence.transactionCount > 0) {
            <!-- Réalisé avec dépense réelle : consommé en avant, prévu barré
                 (le plan a été remplacé par le réel). Un seul symbole. -->
            <span
              class="ph-no-capture whitespace-nowrap inline-flex items-baseline gap-1.5"
            >
              <span class="text-body-medium font-semibold">
                {{ formatNumber(vm.occurrence.consumed) }}
              </span>
              <span class="text-label-small text-on-surface-variant">/</span>
              <span
                class="text-label-small text-on-surface-variant line-through"
              >
                {{ formatNumber(vm.occurrence.amount) }}
              </span>
              <span class="text-body-medium font-semibold">
                {{ currencySymbol() }}
              </span>
            </span>
          } @else {
            <span
              class="ph-no-capture text-body-medium font-semibold whitespace-nowrap"
              [class.line-through]="vm.isChecked"
              [class.text-on-surface-variant]="vm.isChecked"
            >
              {{ formatLine(vm.occurrence.amount) }}
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpreadOccurrencesList {
  readonly occurrences = input.required<readonly SpreadOccurrenceViewModel[]>();
  readonly tracker = input.required<SpreadTracker | null>();
  readonly currency = input.required<SupportedCurrency>();
  readonly locale = input.required<string>();
  readonly density = input<'comfortable' | 'compact'>('comfortable');
  /** True when the viewed budget IS the live current budget period. */
  readonly isCurrentPeriod = input<boolean>(false);

  readonly #meta = computed(() => CURRENCY_METADATA[this.currency()]);
  protected readonly currencySymbol = computed(() => this.#meta().symbol);

  // Constructing Intl.NumberFormat is the costly part, so build one per decimal
  // policy and rebuild only when the currency changes — not per amount per row.
  readonly #aggregationFormatter = computed(
    () =>
      new Intl.NumberFormat(this.#meta().numberLocale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
  );
  readonly #lineFormatter = computed(
    () =>
      new Intl.NumberFormat(this.#meta().numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );

  // One stable Date per occurrence, rebuilt only when the list changes — keeps
  // the `date` pipe from re-formatting a fresh ref on every change detection.
  protected readonly monthDates = computed(
    () =>
      new Map(
        this.occurrences().map((vm) => [
          vm.occurrence.budgetLineId,
          new Date(vm.occurrence.year, vm.occurrence.month - 1, 1),
        ]),
      ),
  );

  protected readonly ordinal = computed(() => {
    const index = this.tracker()?.currentIndex ?? 0;
    return index === 1 ? '1er' : `${index}e`;
  });

  /** Aggregation (0 decimals + symbol suffix): tracker cumulé/total. */
  protected formatAggregation(value: number): string {
    return `${this.#aggregationFormatter().format(value)} ${this.#meta().symbol}`;
  }

  /** Ligne (2 decimals + symbol suffix): per-month + each occurrence amount. */
  protected formatLine(value: number): string {
    return `${this.#lineFormatter().format(value)} ${this.#meta().symbol}`;
  }

  /**
   * Number only (no symbol), ligne policy (2 dec) — for the composite "réel /
   * prévu" row where the symbol is rendered once at the end. Both the consommé
   * and the struck prévu (`budget_line.amount`) follow the ligne policy so a
   * 24,99 € prévision never shows as a struck "25" next to a 24,99 € réalisé.
   */
  protected formatNumber(value: number): string {
    return this.#lineFormatter().format(value);
  }
}
