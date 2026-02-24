import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-dashboard-savings-summary',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col w-full h-full">
      <div class="mb-4 px-1 flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-[var(--pulpe-financial-savings)]/10 text-financial-savings flex items-center justify-center flex-shrink-0"
        >
          <mat-icon>savings</mat-icon>
        </div>
        <div>
          <h2 class="text-title-medium font-bold text-on-surface leading-tight">
            Épargne du mois
          </h2>
          <p class="text-body-small text-on-surface-variant font-medium mt-0.5">
            @if (hasSavings()) {
              {{ progressPercentage() }}% réalisé
            } @else {
              Aucune prévision
            }
          </p>
        </div>
      </div>

      <div
        class="bg-surface-container-low rounded-3xl p-5 flex-1 flex flex-col justify-center"
      >
        @if (hasSavings()) {
          <div
            class="w-full h-2.5 bg-[var(--pulpe-financial-savings)]/10 rounded-full overflow-hidden mb-4"
          >
            <div
              class="h-full bg-[var(--pulpe-financial-savings)] rounded-full transition-all duration-700"
              [style.width.%]="progressPercentage()"
            ></div>
          </div>
          <div class="flex justify-between items-baseline">
            <p class="text-body-medium text-on-surface">
              Tu as mis de côté
              <span class="font-bold text-financial-savings">
                {{ totalRealized() | number: '1.2-2' : 'de-CH' }} CHF
              </span>
              sur {{ totalPlanned() | number: '1.2-2' : 'de-CH' }} prévus
            </p>
          </div>
        } @else {
          <div class="flex flex-col items-center justify-center py-6 gap-2">
            <mat-icon
              class="text-on-surface-variant opacity-40 !text-4xl !w-9 !h-9"
            >
              savings
            </mat-icon>
            <p class="text-body-medium text-on-surface-variant text-center">
              Pas d'épargne prévue ce mois
            </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class DashboardSavingsSummary {
  readonly totalPlanned = input.required<number>();
  readonly totalRealized = input.required<number>();

  protected readonly progressPercentage = computed(() => {
    const planned = this.totalPlanned();
    if (planned === 0) return 0;
    return Math.min(Math.round((this.totalRealized() / planned) * 100), 100);
  });

  protected readonly hasSavings = computed(
    () => this.totalPlanned() > 0 || this.totalRealized() > 0,
  );
}
