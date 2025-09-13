import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { CurrencyPipe } from '@angular/common';
import { type CalendarMonth } from './calendar-types';

@Component({
  selector: 'pulpe-month-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, MatRippleModule, CurrencyPipe],
  template: `
    <mat-card
      class="month-tile-card cursor-pointer h-full"
      [class.current-month]="isCurrentMonth()"
      [class.empty-month]="!month().hasContent"
      [appearance]="month().hasContent ? 'raised' : 'outlined'"
      [attr.data-testid]="'month-tile-' + month().month"
      (click)="handleClick()"
      tabindex="0"
      role="button"
      [attr.aria-label]="getAriaLabel()"
      matRipple
    >
      <mat-card-header>
        <mat-card-title class="text-title-medium capitalize">
          {{ monthName() }}
        </mat-card-title>
        @if (isCurrentMonth()) {
          <div mat-card-avatar>
            <div class="current-badge">
              <mat-icon class="icon-filled">event</mat-icon>
            </div>
          </div>
        }
      </mat-card-header>

      <mat-card-content>
        @if (month().hasContent) {
          <div class="month-value text-center">
            <p class="text-label-small uppercase text-on-surface-variant mb-1">
              Disponible
            </p>
            <p
              class="text-headline-small font-semibold"
              [class.text-financial-income]="valueType() === 'positive'"
              [class.text-financial-negative]="valueType() === 'negative'"
              [class.text-on-surface-variant]="valueType() === 'neutral'"
            >
              {{
                month().value | currency: 'CHF' : 'symbol' : '1.0-0' : 'fr-CH'
              }}
            </p>
          </div>
        } @else {
          <div class="empty-month-content">
            <mat-icon class="empty-icon">add</mat-icon>
            <span class="empty-text">Créer</span>
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
      min-height: 140px;
      transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);

      &:hover:not([disabled]) {
        transform: translateY(-2px);
      }

      &:active:not([disabled]) {
        transform: translateY(0);
      }

      &.current-month {
        border: 2px solid var(--mat-sys-primary);
        box-shadow: 0 0 0 1px var(--mat-sys-primary);
      }

      &.empty-month {
        opacity: 0.9;

        &:hover {
          opacity: 1;
        }
      }
    }

    mat-card-header {
      flex-shrink: 0;
      padding-bottom: 0.5rem;
    }

    mat-card-content {
      flex: 1;
      display: flex !important;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding-top: 0;
      min-height: 80px;
    }

    .current-badge {
      width: 32px;
      height: 32px;
      border-radius: var(--mat-sys-corner-full);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .empty-month-content {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 1rem;
      border-radius: var(--mat-sys-corner-full);
      border: 1px dashed var(--mat-sys-outline-variant);
      background: transparent;
      transition: all 200ms cubic-bezier(0.2, 0, 0, 1);

      .empty-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.5;
        transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
      }

      .empty-text {
        font-size: var(--mat-sys-label-large-size);
        line-height: var(--mat-sys-label-large-line-height);
        font-weight: var(--mat-sys-label-large-weight);
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.7;
        transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1);
      }

      .month-tile-card:hover & {
        background: var(--mat-sys-surface-container-highest);
        border-color: var(--mat-sys-primary);

        .empty-icon {
          opacity: 0.8;
          color: var(--mat-sys-primary);
        }

        .empty-text {
          opacity: 1;
          color: var(--mat-sys-primary);
        }
      }
    }

    /* Mobile optimizations */
    @media (max-width: 768px) {
      .month-tile-card {
        min-height: 120px;
      }

      mat-card-content {
        min-height: 60px;
      }

      .empty-month-content {
        padding: 0.375rem 0.75rem;

        .empty-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        .empty-text {
          font-size: var(--mat-sys-label-medium-size);
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

  getAriaLabel(): string {
    const month = this.month();
    if (month.hasContent) {
      return `Budget de ${month.displayName}, montant disponible: ${month.value} CHF`;
    }
    return `Créer un budget pour ${month.displayName}`;
  }

  handleClick(): void {
    if (!this.disabled()) {
      this.tileClick.emit(this.month());
    }
  }
}
