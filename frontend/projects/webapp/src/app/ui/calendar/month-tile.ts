import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { type CalendarMonth } from './calendar-types';

@Component({
  selector: 'pulpe-month-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, CurrencyPipe, DecimalPipe],
  template: `
    <button
      class="month-tile"
      [attr.data-status]="month().status"
      [attr.data-current]="isCurrentMonth()"
      [attr.data-has-content]="month().hasContent"
      [attr.data-testid]="'month-tile-' + month().month"
      [disabled]="disabled()"
      (click)="handleClick()"
      type="button"
    >
      <div class="month-tile-header">
        <span class="month-name">{{ monthName() }}</span>
        @if (isCurrentMonth()) {
          <span class="current-indicator" aria-label="Mois actuel">
            <mat-icon class="text-base">today</mat-icon>
          </span>
        }
      </div>

      <div class="month-tile-content">
        @if (month().hasContent) {
          @if (month().value !== undefined) {
            <div class="month-value" [attr.data-type]="valueType()">
              <span class="value-amount">
                {{
                  month().value | currency: 'CHF' : 'symbol' : '1.0-0' : 'fr-CH'
                }}
              </span>
            </div>
          }
          <div class="month-status">
            @switch (month().status) {
              @case ('positive') {
                <mat-icon class="status-icon positive">trending_up</mat-icon>
              }
              @case ('negative') {
                <mat-icon class="status-icon negative">trending_down</mat-icon>
              }
              @case ('warning') {
                <mat-icon class="status-icon warning">warning</mat-icon>
              }
            }
          </div>
        } @else {
          <div class="empty-month">
            <mat-icon class="empty-icon">add_circle_outline</mat-icon>
            <span class="empty-text">Créer un budget</span>
          </div>
        }
      </div>
    </button>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .month-tile {
      width: 100%;
      height: 100%;
      min-height: 120px;
      padding: 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
      transition: all 0.2s ease;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      position: relative;
      overflow: hidden;

      &:hover:not(:disabled) {
        background: var(--mat-sys-surface-container);
        transform: translateY(-2px);
        box-shadow: var(--mat-sys-level2);
      }

      &:active:not(:disabled) {
        transform: translateY(0);
      }

      &[data-has-content='false'] {
        background: var(--mat-sys-surface-variant);
        opacity: 0.8;
        border-style: dashed;

        &:hover:not(:disabled) {
          opacity: 1;
          background: var(--mat-sys-surface-container-lowest);
        }
      }

      &[data-current='true'] {
        background: var(--mat-sys-primary-container);
        border-color: var(--mat-sys-primary);

        .month-name {
          color: var(--mat-sys-on-primary-container);
          font-weight: 600;
        }
      }

      &[data-status='negative'] {
        border-left: 3px solid var(--pulpe-financial-negative);
      }

      &[data-status='positive'] {
        border-left: 3px solid var(--pulpe-financial-savings);
      }

      &[data-status='warning'] {
        border-left: 3px solid var(--mat-sys-warning);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .month-tile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .month-name {
      font-size: var(--mat-sys-typescale-title-small-size);
      line-height: var(--mat-sys-typescale-title-small-line-height);
      font-weight: var(--mat-sys-typescale-title-small-weight);
      color: var(--mat-sys-on-surface);
      text-transform: capitalize;
    }

    .current-indicator {
      display: inline-flex;
      align-items: center;
      color: var(--mat-sys-primary);
    }

    .month-tile-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
    }

    .month-value {
      text-align: center;

      &[data-type='positive'] {
        color: var(--pulpe-financial-savings);
      }

      &[data-type='negative'] {
        color: var(--pulpe-financial-negative);
      }

      &[data-type='neutral'] {
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .value-amount {
      font-size: var(--mat-sys-typescale-body-large-size);
      font-weight: 600;
    }

    .month-status {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .status-icon {
      font-size: 1.25rem;
      width: 1.25rem;
      height: 1.25rem;

      &.positive {
        color: var(--pulpe-financial-savings);
      }

      &.negative {
        color: var(--pulpe-financial-negative);
      }

      &.warning {
        color: var(--mat-sys-warning);
      }
    }

    .empty-month {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.7;
      transition: opacity 0.2s;

      .month-tile:hover & {
        opacity: 1;
      }
    }

    .empty-icon {
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
      color: var(--mat-sys-primary);
    }

    .empty-text {
      font-size: var(--mat-sys-typescale-label-small-size);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .month-tile {
        min-height: 100px;
        padding: 0.75rem;
      }

      .value-amount {
        font-size: var(--mat-sys-typescale-body-medium-size);
      }

      .empty-text {
        font-size: 0.625rem;
      }
    }
  `,
})
export class MonthTile {
  // Inputs
  month = input.required<CalendarMonth>();
  isCurrentMonth = input<boolean>(false);
  disabled = input<boolean>(false);

  // Outputs
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

  handleClick(): void {
    if (!this.disabled()) {
      this.tileClick.emit(this.month());
    }
  }
}
