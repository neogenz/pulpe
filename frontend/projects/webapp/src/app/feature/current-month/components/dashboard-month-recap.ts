import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import type { MonthRecap } from '../services/dashboard-state';

/**
 * Names the closed month and its result, and offers the detail. Above the
 * hero, but it blocks nothing: reading the recap is the user's call.
 */
@Component({
  selector: 'pulpe-dashboard-month-recap',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="flex items-start gap-3 rounded-3xl bg-surface-container-low p-4"
      [attr.aria-labelledby]="titleId"
    >
      <div
        class="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0!"
      >
        <mat-icon aria-hidden="true">event_available</mat-icon>
      </div>
      <div class="flex flex-col gap-1 min-w-0 flex-1">
        <h2
          [id]="titleId"
          class="text-title-medium font-bold text-on-surface leading-tight"
        >
          {{
            'currentMonth.monthRecap.title' | transloco: { month: monthName() }
          }}
        </h2>
        <p class="text-body-medium text-on-surface-variant">
          @switch (recap().outcome) {
            @case ('saved') {
              {{ 'currentMonth.monthRecap.saved' | transloco }}
              <span
                class="font-bold tabular-nums whitespace-nowrap ph-no-capture"
                >{{
                  recap().endingBalance | appCurrency: currency() : '1.0-0'
                }}</span
              >
              {{ 'currentMonth.monthRecap.savedSuffix' | transloco }}
            }
            @case ('overspent') {
              {{ 'currentMonth.monthRecap.overspent' | transloco }}
              <span
                class="font-bold tabular-nums whitespace-nowrap ph-no-capture"
                >{{
                  -recap().endingBalance | appCurrency: currency() : '1.0-0'
                }}</span
              >
              {{ 'currentMonth.monthRecap.overspentSuffix' | transloco }}
            }
            @default {
              {{ 'currentMonth.monthRecap.balanced' | transloco }}
            }
          }
        </p>
        <div>
          <button
            matButton
            class="-ml-3"
            (click)="openDetails.emit()"
            data-testid="month-recap-open-button"
          >
            {{ 'currentMonth.monthRecap.open' | transloco }}
          </button>
        </div>
      </div>
      <button
        matIconButton
        class="shrink-0 -mt-2 -mr-2"
        [attr.aria-label]="'currentMonth.monthRecap.dismiss' | transloco"
        (click)="dismiss.emit()"
        data-testid="month-recap-dismiss-button"
      >
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardMonthRecap {
  readonly #locale = inject(LOCALE_ID);
  readonly #monthFormatter = new Intl.DateTimeFormat(this.#locale, {
    month: 'long',
  });

  readonly recap = input.required<MonthRecap>();
  readonly currency = input<SupportedCurrency>('CHF');

  readonly openDetails = output<void>();
  readonly dismiss = output<void>();

  protected readonly titleId = 'month-recap-title';

  // The month leads the sentence rather than following a preposition: French
  // elides "de" before avril and octobre, and a template cannot know that.
  protected readonly monthName = computed(() => {
    const { month, year } = this.recap();
    const name = this.#monthFormatter.format(new Date(year, month - 1, 1));
    return name.charAt(0).toLocaleUpperCase(this.#locale) + name.slice(1);
  });
}
