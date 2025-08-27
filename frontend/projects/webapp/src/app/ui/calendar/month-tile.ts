import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';
import { type CalendarMonth } from './calendar-types';

@Component({
  selector: 'pulpe-month-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, CurrencyPipe],
  template: `
    <button
      class="month-tile group"
      [attr.data-status]="month().status"
      [attr.data-current]="isCurrentMonth()"
      [attr.data-has-content]="month().hasContent"
      [attr.data-testid]="'month-tile-' + month().month"
      [disabled]="disabled()"
      (click)="handleClick()"
      type="button"
    >
      <!-- Material ripple effect overlay -->
      <div class="state-layer"></div>

      <!-- Content container -->
      <div class="month-tile-inner">
        <div class="month-tile-header">
          <span class="month-name">{{ monthName() }}</span>
          @if (isCurrentMonth()) {
            <span class="current-badge" aria-label="Mois actuel">
              <mat-icon class="icon-filled">event</mat-icon>
            </span>
          }
        </div>

        <div class="month-tile-content">
          @if (month().hasContent) {
            @if (month().value !== undefined) {
              <div class="month-value" [attr.data-type]="valueType()">
                <span class="value-label">Disponible</span>
                <span class="value-amount">
                  {{
                    month().value
                      | currency: 'CHF' : 'symbol' : '1.0-0' : 'fr-CH'
                  }}
                </span>
              </div>
            }
            @if (month().status) {
              <div class="status-indicator">
                @switch (month().status) {
                  @case ('positive') {
                    <mat-icon class="status-icon icon-filled">savings</mat-icon>
                  }
                  @case ('negative') {
                    <mat-icon class="status-icon icon-filled"
                      >trending_down</mat-icon
                    >
                  }
                  @case ('warning') {
                    <mat-icon class="status-icon icon-filled">warning</mat-icon>
                  }
                }
              </div>
            }
          } @else {
            <div class="empty-month">
              <div class="empty-icon-wrapper">
                <mat-icon class="empty-icon">add</mat-icon>
              </div>
              <span class="empty-text">Créer</span>
            </div>
          }
        </div>
      </div>
    </button>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .month-tile {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 140px;
      padding: 0;
      border: none;
      cursor: pointer;
      overflow: hidden;

      /* Material elevation system */
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container);
      transition: all 200ms cubic-bezier(0.2, 0, 0, 1);

      /* Elevation levels */
      box-shadow: var(--mat-sys-level1);

      &:hover:not(:disabled) {
        box-shadow: var(--mat-sys-level3);
        transform: translateY(-1px);

        .state-layer {
          opacity: 0.08;
        }
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;

        .state-layer {
          opacity: 0.12;
        }
      }

      &:active:not(:disabled) {
        box-shadow: var(--mat-sys-level0);
        transform: translateY(0);

        .state-layer {
          opacity: 0.12;
        }
      }

      /* Empty month state */
      &[data-has-content='false'] {
        background: var(--mat-sys-surface);
        box-shadow: none;
        border: 2px dashed var(--mat-sys-outline-variant);

        &:hover:not(:disabled) {
          background: var(--mat-sys-surface-container-lowest);
          border-color: var(--mat-sys-outline);
          box-shadow: var(--mat-sys-level1);
        }
      }

      /* Current month state */
      &[data-current='true'] {
        background: var(--mat-sys-primary-container);
        box-shadow: var(--mat-sys-level2);

        .month-name {
          color: var(--mat-sys-on-primary-container);
        }

        .value-label,
        .value-amount {
          color: var(--mat-sys-on-primary-container);
        }

        .current-badge {
          background: var(--mat-sys-primary);
          color: var(--mat-sys-on-primary);
        }
      }

      /* Status indicators as subtle accents */
      &[data-status='positive']::before,
      &[data-status='negative']::before,
      &[data-status='warning']::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: 4px;
      }

      &[data-status='positive']::before {
        background: var(--pulpe-financial-savings);
      }

      &[data-status='negative']::before {
        background: var(--mat-sys-error);
      }

      &[data-status='warning']::before {
        background: var(--mat-sys-tertiary);
      }

      &:disabled {
        opacity: 0.38;
        cursor: not-allowed;
        box-shadow: none;
      }
    }

    /* State layer for ripple effect */
    .state-layer {
      position: absolute;
      inset: 0;
      background: var(--mat-sys-on-surface);
      opacity: 0;
      transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
      pointer-events: none;
      border-radius: inherit;
    }

    /* Content container */
    .month-tile-inner {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 1rem;
      gap: 0.75rem;
    }

    .month-tile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 28px;
    }

    .month-name {
      font-size: var(--mat-sys-title-medium-size);
      line-height: var(--mat-sys-title-medium-line-height);
      font-weight: var(--mat-sys-title-medium-weight);
      letter-spacing: var(--mat-sys-title-medium-tracking);
      color: var(--mat-sys-on-surface);
      text-transform: capitalize;
    }

    .current-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-primary);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .month-tile-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .month-value {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: 100%;

      &[data-type='positive'] .value-amount {
        color: var(--pulpe-financial-savings);
      }

      &[data-type='negative'] .value-amount {
        color: var(--mat-sys-error);
      }

      &[data-type='neutral'] .value-amount {
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .value-label {
      font-size: var(--mat-sys-label-small-size);
      line-height: var(--mat-sys-label-small-line-height);
      font-weight: var(--mat-sys-label-small-weight);
      letter-spacing: var(--mat-sys-label-small-tracking);
      color: var(--mat-sys-on-surface-variant);
      text-transform: uppercase;
    }

    .value-amount {
      font-size: var(--mat-sys-headline-small-size);
      line-height: var(--mat-sys-headline-small-line-height);
      font-weight: var(--mat-sys-headline-small-weight);
      letter-spacing: var(--mat-sys-headline-small-tracking);
    }

    .status-indicator {
      position: absolute;
      bottom: 0.75rem;
      right: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-surface-container-highest);
    }

    .status-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;

      &[class*='positive'] {
        color: var(--pulpe-financial-savings);
      }

      &[class*='negative'] {
        color: var(--mat-sys-error);
      }

      &[class*='warning'] {
        color: var(--mat-sys-tertiary);
      }
    }

    .empty-month {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      height: 100%;
      min-height: 60px;
    }

    .empty-icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary-container);
      transition: all 200ms cubic-bezier(0.2, 0, 0, 1);

      .month-tile:hover & {
        transform: scale(1.1);
        background: var(--mat-sys-primary);

        .empty-icon {
          color: var(--mat-sys-on-primary);
        }
      }
    }

    .empty-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: var(--mat-sys-on-primary-container);
      transition: color 200ms cubic-bezier(0.2, 0, 0, 1);
    }

    .empty-text {
      font-size: var(--mat-sys-label-medium-size);
      line-height: var(--mat-sys-label-medium-line-height);
      font-weight: var(--mat-sys-label-medium-weight);
      letter-spacing: var(--mat-sys-label-medium-tracking);
      color: var(--mat-sys-on-surface-variant);
      text-transform: uppercase;
    }

    /* Mobile optimizations */
    @media (max-width: 768px) {
      .month-tile {
        min-height: 120px;
      }

      .month-tile-inner {
        padding: 0.75rem;
      }

      .month-name {
        font-size: var(--mat-sys-title-small-size);
        line-height: var(--mat-sys-title-small-line-height);
      }

      .value-amount {
        font-size: var(--mat-sys-title-large-size);
        line-height: var(--mat-sys-title-large-line-height);
      }

      .empty-icon-wrapper {
        width: 36px;
        height: 36px;
      }

      .empty-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .status-indicator {
        width: 28px;
        height: 28px;

        .status-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
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
