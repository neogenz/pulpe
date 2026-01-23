import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { isBefore } from 'date-fns';
import { type CalendarMonth } from './calendar-types';

type BackgroundStyle =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'warning'
  | 'empty';
type StatusColor = 'positive' | 'negative' | 'neutral' | 'warning';

interface MonthTileViewModel {
  isPast: boolean;
  isCurrent: boolean;
  hasContent: boolean;
  monthName: string;
  formattedAmount: string;
  period: string | undefined;
  ariaLabel: string;
  backgroundStyle: BackgroundStyle;
  statusColor: StatusColor;
}

@Component({
  selector: 'pulpe-month-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  hostDirectives: [MatRipple],
  host: {
    class: 'block h-full',
    '[class]': 'hostClasses()',
    '[attr.data-testid]': "'month-tile-' + month().month",
    '[attr.aria-label]': 'vm().ariaLabel',
    '(click)': 'tileClick.emit(month())',
    '(keydown.enter)': 'tileClick.emit(month())',
    '(keydown.space)': 'tileClick.emit(month())',
    tabindex: '0',
    role: 'button',
  },
  template: `
    <!-- Header -->
    <div class="flex flex-col gap-1 px-4 pt-4 pb-2">
      @if (vm().isCurrent) {
        <span
          class="self-start text-label-small px-2 py-0.5 rounded-full bg-primary text-on-primary"
        >
          Actuel
        </span>
      }
      <div class="flex items-center gap-2">
        @if (vm().hasContent) {
          <span
            class="w-2.5 h-2.5 rounded-full flex-shrink-0"
            [class.bg-financial-savings]="vm().statusColor === 'positive'"
            [class.bg-error]="vm().statusColor === 'negative'"
            [class.bg-outline-variant]="vm().statusColor === 'neutral'"
          ></span>
        }
        <span class="text-title-medium font-medium capitalize truncate">
          {{ vm().monthName }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 flex flex-col items-center justify-center px-4 pb-4">
      @if (vm().hasContent) {
        <div class="text-center space-y-1">
          <p class="text-label-small text-on-surface-variant uppercase">
            Disponible
          </p>
          <div class="flex items-baseline justify-center gap-1">
            <span
              class="text-headline-medium md:text-display-small font-bold tracking-tight ph-no-capture"
              [class.text-financial-savings]="vm().statusColor === 'positive'"
              [class.text-error]="vm().statusColor === 'negative'"
              [class.text-on-surface]="vm().statusColor === 'neutral'"
            >
              {{ vm().formattedAmount }}
            </span>
            <span
              class="text-body-medium md:text-body-large text-on-surface-variant"
            >
              CHF
            </span>
          </div>
          @if (vm().period) {
            <p class="text-label-small text-on-surface-variant mt-2">
              {{ vm().period }}
            </p>
          }
        </div>
      } @else {
        <div
          class="flex flex-col items-center gap-2 text-outline transition-colors group-hover:text-primary"
        >
          <mat-icon class="text-3xl">add_circle_outline</mat-icon>
          <span class="text-label-medium">Créer</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      cursor: pointer;
      min-height: 160px;
      border-radius: 1rem;
      border-width: 1px;
      transition: all 200ms;

      &:hover {
        box-shadow: var(--mat-sys-level2);
        transform: scale(1.02);
      }

      &:active {
        transform: scale(1);
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }

      @media (min-width: 768px) {
        min-height: 180px;
      }
    }
  `,
})
export class MonthTile {
  readonly month = input.required<CalendarMonth>();
  readonly isCurrentMonth = input<boolean>(false);
  readonly tileClick = output<CalendarMonth>();

  readonly vm = computed<MonthTileViewModel>(() => {
    const month = this.month();
    const isCurrent = this.isCurrentMonth();
    const status = month.status ?? 'neutral';
    const formattedAmount = this.#formatAmount(month.value);

    return {
      isPast: isBefore(new Date(month.year, month.month, 1), new Date()),
      isCurrent,
      hasContent: month.hasContent,
      monthName: month.displayName.split(' ')[0],
      formattedAmount,
      period: month.period,
      ariaLabel: month.hasContent
        ? `${month.displayName}, ${formattedAmount} CHF disponible`
        : `${month.displayName}, créer un budget`,
      backgroundStyle: month.hasContent ? status : 'empty',
      statusColor: status,
    };
  });

  readonly hostClasses = computed(() => {
    const vm = this.vm();
    const classes: Record<string, boolean> = {
      group: true,
      'opacity-60': vm.isPast,
      'ring-2': vm.isCurrent,
      'ring-primary': vm.isCurrent,
      // Positive
      'bg-primary-container/20': vm.backgroundStyle === 'positive',
      'border-primary/30': vm.backgroundStyle === 'positive',
      'hover:border-primary/50': vm.backgroundStyle === 'positive',
      // Negative
      'bg-error-container/20': vm.backgroundStyle === 'negative',
      'border-error/30': vm.backgroundStyle === 'negative',
      'hover:border-error/50': vm.backgroundStyle === 'negative',
      // Neutral
      'bg-surface-container': vm.backgroundStyle === 'neutral',
      'border-outline-variant/50': vm.backgroundStyle === 'neutral',
      'hover:border-outline-variant': vm.backgroundStyle === 'neutral',
      // Empty
      'bg-surface-container-low': vm.backgroundStyle === 'empty',
      'border-outline-variant/30': vm.backgroundStyle === 'empty',
      'hover:border-outline-variant/60': vm.backgroundStyle === 'empty',
    };
    return classes;
  });

  #formatAmount(value?: number): string {
    if (value === undefined) return '0';
    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  }
}
