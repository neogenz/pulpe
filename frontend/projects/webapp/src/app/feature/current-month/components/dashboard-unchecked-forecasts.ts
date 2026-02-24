import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import type { BudgetLine } from 'pulpe-shared';

@Component({
  selector: 'pulpe-dashboard-unchecked-forecasts',
  standalone: true,
  imports: [CommonModule, MatCheckboxModule, MatIconModule, DecimalPipe],
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"
        >
          <mat-icon>checklist</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            Prévisions non cochées
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            Sur le mois courant ({{ forecasts().length }})
          </p>
        </div>
      </div>

      <div class="bg-surface-container-low rounded-3xl py-3 px-3 flex-1">
        @if (forecasts().length > 0) {
          <div class="relative">
            <div
              class="flex flex-col gap-1 scroll-list max-h-[280px] overflow-y-auto"
            >
              @for (forecast of forecasts(); track forecast.id) {
                <div
                  class="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-container-low transition-colors group cursor-pointer"
                  (click)="checkbox.toggle()"
                  (keydown.enter)="checkbox.toggle()"
                  tabindex="0"
                  role="button"
                >
                  <mat-checkbox
                    #checkbox
                    [checked]="false"
                    (change)="toggleCheck.emit(forecast.id)"
                    (click)="$event.stopPropagation()"
                    class="flex-1 min-w-0"
                    color="primary"
                  >
                    <span
                      class="text-body-medium font-bold text-on-surface truncate block ml-1 ph-no-capture"
                    >
                      {{ forecast.name }}
                    </span>
                  </mat-checkbox>
                  <span
                    class="text-label-large text-on-surface-variant whitespace-nowrap ml-4 font-semibold opacity-80 ph-no-capture"
                  >
                    {{ forecast.amount | number: '1.2-2' : 'de-CH' }} CHF
                  </span>
                </div>
              }
            </div>
            <div class="scroll-fade"></div>
            <div class="scroll-hint">
              <mat-icon class="text-[16px]">keyboard_arrow_down</mat-icon>
            </div>
          </div>
        } @else {
          <div
            class="p-8 flex flex-col items-center justify-center text-center h-full"
          >
            <div
              class="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mb-4"
            >
              <mat-icon class="scale-150">done_all</mat-icon>
            </div>
            <h3 class="text-title-medium font-bold text-on-surface mb-1">
              Tout est à jour !
            </h3>
            <p class="text-body-medium text-on-surface-variant">
              Tu as pointé toutes tes prévisions pour ce mois.
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .scroll-list {
        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
      }

      .scroll-list:hover,
      .scroll-list:active {
        scrollbar-color: var(--mat-sys-outline-variant) transparent;
      }

      .scroll-list::-webkit-scrollbar {
        width: 4px;
      }

      .scroll-list::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: 4px;
      }

      .scroll-list:hover::-webkit-scrollbar-thumb,
      .scroll-list:active::-webkit-scrollbar-thumb {
        background: var(--mat-sys-outline-variant);
      }

      .scroll-fade {
        position: absolute;
        bottom: 28px;
        left: 0;
        right: 0;
        height: 48px;
        background: linear-gradient(
          to bottom,
          transparent 0%,
          var(--mat-sys-surface-container-low) 100%
        );
        pointer-events: none;
        z-index: 1;
      }

      .scroll-hint {
        display: flex;
        justify-content: center;
        padding: 4px 0 2px;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.5;
        animation: bounce-down 1.5s ease-in-out infinite;
        pointer-events: none;
      }

      @keyframes bounce-down {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(4px);
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardUncheckedForecasts {
  readonly forecasts = input.required<BudgetLine[]>();
  readonly toggleCheck = output<string>();
}
