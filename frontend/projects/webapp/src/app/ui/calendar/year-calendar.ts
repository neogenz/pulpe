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
      class="w-full bg-surface rounded-corner-extra-large p-4 md:p-6"
      [attr.data-year]="calendarYear().year"
      [attr.data-testid]="'year-calendar-' + calendarYear().year"
    >
      <div
        class="calendar-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4 md:gap-6"
        data-tour="calendar-grid"
      >
        @for (month of displayMonths(); track month.id; let i = $index) {
          <div
            class="h-full min-h-[120px] md:min-h-[160px] max-h-[240px] md:max-h-[280px] lg:max-h-[320px]"
          >
            <pulpe-month-tile
              [month]="month"
              [isCurrentMonth]="isCurrentMonth(month)"
              (tileClick)="handleMonthClick($event)"
            />
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    /* Custom grid configurations for dynamic column counts */
    .custom-grid {
      &.cols-mobile-1 .calendar-grid {
        @media (max-width: 767px) {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }
      }

      &.cols-tablet-2 .calendar-grid {
        @media (min-width: 768px) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      &.cols-tablet-4 .calendar-grid {
        @media (min-width: 768px) {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      &.cols-desktop-3 .calendar-grid {
        @media (min-width: 1024px) {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      &.cols-desktop-6 .calendar-grid {
        @media (min-width: 1024px) {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
      }
    }
  `,
})
export class YearCalendar {
  calendarYear = input.required<CalendarYear>();

  // Optional inputs
  currentDate = input<{ month: number; year: number }>();

  // Outputs
  monthClick = output<CalendarMonth>();
  createMonth = output<{ month: number; year: number }>();

  // Computed properties
  displayMonths = computed(() => this.calendarYear().months);

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
