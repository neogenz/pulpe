import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { MonthTile } from './month-tile';
import { type CalendarMonth, type CalendarYear } from './calendar-types';

@Component({
  selector: 'pulpe-year-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonthTile],
  template: `
    <div
      class="w-full p-2 md:p-4"
      [attr.data-year]="calendarYear().year"
      [attr.data-testid]="'year-calendar-' + calendarYear().year"
    >
      <!-- Year Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-headline-small font-semibold text-on-surface">
          {{ calendarYear().year }}
        </h2>
        <span
          class="text-label-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full"
        >
          {{ budgetCount() }} budget{{ budgetCount() > 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Calendar Grid -->
      <div
        class="calendar-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-5 md:gap-6"
        data-tour="calendar-grid"
      >
        @for (month of displayMonths(); track month.id) {
          <pulpe-month-tile
            [month]="month"
            [isCurrentMonth]="isCurrentMonth(month)"
            (tileClick)="handleMonthClick($event)"
          />
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
})
export class YearCalendar {
  readonly calendarYear = input.required<CalendarYear>();

  // Optional inputs
  readonly currentDate = input<{ month: number; year: number }>();

  // Outputs
  readonly monthClick = output<CalendarMonth>();
  readonly createMonth = output<{ month: number; year: number }>();

  readonly displayMonths = computed(() => this.calendarYear().months);

  readonly budgetCount = computed(
    () => this.calendarYear().months.filter((m) => m.hasContent).length,
  );

  isCurrentMonth(month: CalendarMonth): boolean {
    const current = this.currentDate();
    if (!current) return false;

    return month.month === current.month && month.year === current.year;
  }

  handleMonthClick(month: CalendarMonth): void {
    if (month.hasContent) {
      this.monthClick.emit(month);
    } else {
      // Emit create event for empty months
      this.createMonth.emit({
        month: month.month,
        year: month.year,
      });
    }
  }
}
