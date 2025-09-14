import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { isBefore } from 'date-fns';
import { type CalendarMonth } from './calendar-types';

@Component({
  selector: 'pulpe-month-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, MatRippleModule, DecimalPipe],
  template: `
    <mat-card
      [class.opacity-50!]="isPastMonth()"
      class="month-tile-card group cursor-pointer h-full min-h-[140px] md:min-h-[140px] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
      [class.current-month]="isCurrentMonth()"
      [class.empty-month]="!month().hasContent"
      [appearance]="month().hasContent ? 'filled' : 'outlined'"
      [attr.data-testid]="'month-tile-' + month().month"
      (click)="tileClick.emit(month())"
      tabindex="0"
      role="button"
      matRipple
    >
      <mat-card-header
        class="flex-shrink-0 flex flex-row items-center justify-center"
      >
        <mat-card-title class="capitalize">
          {{ monthName() }}
        </mat-card-title>
      </mat-card-header>

      <mat-card-content
        class="flex-1 !flex flex-col items-center justify-center pt-0 min-h-[80px] md:min-h-[80px]"
      >
        @if (month().hasContent) {
          <div class="text-center space-y-1">
            <p class="text-label-small uppercase text-on-surface">
              Disponible CHF
            </p>
            <p
              class="text-headline-small md:text-headline-large"
              [class.text-[var(--pulpe-financial-savings)]]="
                valueType() === 'positive'
              "
              [class.text-financial-negative]="valueType() === 'negative'"
            >
              {{ month().value | number: '1.2-2' : 'de-CH' }}
            </p>
          </div>
        } @else {
          <div
            class="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-dashed border-outline-variant bg-transparent transition-all duration-200 group-hover:bg-surface-container-highest! group-hover:border-primary!"
          >
            <mat-icon
              class="text-lg w-[18px] h-[18px] text-on-surface-variant opacity-50 transition-all duration-200 group-hover:opacity-80 group-hover:text-primary!"
              >add</mat-icon
            >
            <span
              class="text-label-large text-on-surface-variant opacity-70 transition-opacity duration-200 group-hover:opacity-100 group-hover:text-primary"
              >Créer</span
            >
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;
      height: 100%;
    }

    .month-tile-card {
      display: flex;
      flex-direction: column;
      height: 100%;

      /*&.current-month {
        @include mat.card-overrides(
          (
            filled-container-color: var(--mat-sys-secondary-container),
          )
        );
      }*/

      &.empty-month {
        opacity: 0.9;

        &:hover {
          opacity: 1;
        }
      }
    }
  `,
})
export class MonthTile {
  month = input.required<CalendarMonth>();
  isCurrentMonth = input<boolean>(false);

  tileClick = output<CalendarMonth>();

  // Computed properties
  monthName = computed(() => {
    const monthData = this.month();
    // Extract just the month name from displayName (e.g., "janvier" from "janvier 2025")
    return monthData.displayName.split(' ')[0];
  });

  valueType = computed(() => {
    const value = this.month().value;
    if (value === undefined) return 'neutral';
    return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
  });

  isPastMonth = computed(() => {
    const currentDate = new Date();
    const month = this.month().month;
    const year = this.month().year;
    // date-fns isAfter
    return isBefore(new Date(year, month, 1), currentDate);
  });
}
