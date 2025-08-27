import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { MonthTile } from './month-tile';
import { type CalendarMonth, type CalendarConfig } from './calendar-types';

@Component({
  selector: 'pulpe-year-calendar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MonthTile],
  template: `
    <div
      class="year-calendar-container"
      [class]="containerClass()"
      [attr.data-year]="year()"
      [attr.data-testid]="'year-calendar-' + year()"
    >
      <div class="calendar-grid">
        @for (month of displayMonths(); track month.id) {
          <div class="calendar-cell">
            <pulpe-month-tile
              [month]="month"
              [isCurrentMonth]="isCurrentMonth(month)"
              [disabled]="!isMonthClickable(month)"
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

    .year-calendar-container {
      width: 100%;
    }

    .calendar-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));

      /* Tablet */
      @media (min-width: 768px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.25rem;
      }

      /* Desktop */
      @media (min-width: 1024px) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 1.5rem;
      }

      /* Large Desktop - Optional 6 columns */
      @media (min-width: 1440px) {
        &.grid-cols-xl-6 {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
      }
    }

    .calendar-cell {
      aspect-ratio: 4/3;
      min-height: 120px;

      @media (max-width: 768px) {
        aspect-ratio: auto;
        min-height: 100px;
      }
    }

    /* Custom grid configurations */
    .custom-grid {
      &.cols-mobile-1 {
        @media (max-width: 767px) {
          .calendar-grid {
            grid-template-columns: repeat(1, minmax(0, 1fr));
          }
        }
      }

      &.cols-tablet-2 {
        @media (min-width: 768px) and (max-width: 1023px) {
          .calendar-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      }

      &.cols-tablet-4 {
        @media (min-width: 768px) and (max-width: 1023px) {
          .calendar-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
      }

      &.cols-desktop-3 {
        @media (min-width: 1024px) {
          .calendar-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      }

      &.cols-desktop-6 {
        @media (min-width: 1024px) {
          .calendar-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }
      }
    }

    /* Animations */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .calendar-cell {
      animation: fadeIn 0.3s ease-out backwards;

      @for $i from 1 through 12 {
        &:nth-child(#{$i}) {
          animation-delay: #{$i * 0.03}s;
        }
      }
    }
  `,
})
export class YearCalendar {
  // Required inputs
  year = input.required<number>();
  months = input.required<CalendarMonth[]>();

  // Optional inputs
  currentDate = input<{ month: number; year: number }>();
  config = input<CalendarConfig>({});

  // Outputs
  monthClick = output<CalendarMonth>();
  createMonth = output<{ month: number; year: number }>();

  // Computed properties
  displayMonths = computed(() => {
    const monthsData = this.months();
    const cfg = this.config();

    // If showEmptyMonths is false, filter out empty months
    if (cfg.showEmptyMonths === false) {
      return monthsData.filter((m) => m.hasContent);
    }

    // Ensure we have all 12 months if not all are provided
    if (monthsData.length < 12) {
      return this.#fillMissingMonths(monthsData);
    }

    return monthsData;
  });

  containerClass = computed(() => {
    const cfg = this.config();
    const classes: string[] = [];

    if (cfg.containerClass) {
      classes.push(cfg.containerClass);
    }

    if (cfg.columns) {
      classes.push('custom-grid');
      if (cfg.columns.mobile) {
        classes.push(`cols-mobile-${cfg.columns.mobile}`);
      }
      if (cfg.columns.tablet) {
        classes.push(`cols-tablet-${cfg.columns.tablet}`);
      }
      if (cfg.columns.desktop) {
        classes.push(`cols-desktop-${cfg.columns.desktop}`);
      }
    }

    return classes.join(' ');
  });

  isCurrentMonth(month: CalendarMonth): boolean {
    const current = this.currentDate();
    if (!current) return false;

    return month.month === current.month && month.year === current.year;
  }

  isMonthClickable(month: CalendarMonth): boolean {
    const cfg = this.config();

    // If month has content, it's always clickable
    if (month.hasContent) return true;

    // Check config for empty month click behavior
    return cfg.allowEmptyMonthClick !== false;
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

  #fillMissingMonths(months: CalendarMonth[]): CalendarMonth[] {
    const allMonths: CalendarMonth[] = [];
    const monthNames = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];

    for (let i = 1; i <= 12; i++) {
      const existing = months.find((m) => m.month === i);

      if (existing) {
        allMonths.push(existing);
      } else {
        // Create empty month placeholder
        allMonths.push({
          id: `empty-${this.year()}-${i}`,
          month: i,
          year: this.year(),
          displayName: `${monthNames[i - 1]} ${this.year()}`,
          hasContent: false,
          status: 'neutral',
        });
      }
    }

    return allMonths;
  }
}
