import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { UserSettingsStore } from '@core/user-settings';
import { FinancialKindDirective } from '@ui/financial-kind';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { formatMatchAnnotation } from '../../../view-models/budget-item-constants';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../../view-models/table-items.view-model';
import { SpreadPill } from '../../spread-pill';

@Component({
  selector: 'pulpe-name-cell',
  imports: [
    MatIconModule,
    MatTooltipModule,
    DatePipe,
    FinancialKindDirective,
    TransactionLabelPipe,
    SpreadPill,
  ],
  template: `
    <div class="flex items-center gap-2">
      @if (line().metadata.isNestedUnderEnvelope) {
        <mat-icon class="text-sm! text-outline shrink-0">
          subdirectory_arrow_right
        </mat-icon>
      } @else {
        <mat-icon
          class="text-base! shrink-0"
          [pulpeFinancialKind]="line().data.kind"
          [matTooltip]="line().data.kind | transactionLabel"
          matTooltipPosition="above"
        >
          {{ line().metadata.kindIcon }}
        </mat-icon>
      }
      <span class="inline-flex items-center gap-2">
        <div class="flex flex-col">
          <span
            class="ph-no-capture text-body-medium font-semibold flex items-center gap-1"
            [pulpeFinancialKind]="line().data.kind"
          >
            {{ line().metadata.displayName }}
            @if (line().metadata.isPropagationLocked) {
              <mat-icon
                class="text-base! text-outline"
                matTooltip="Montants verrouillés = non affectés par la propagation"
                matTooltipPosition="above"
              >
                lock
              </mat-icon>
            }
          </span>
          @if (line().metadata.envelopeName) {
            <span
              class="flex items-center gap-1 text-label-small text-on-surface-variant ph-no-capture"
            >
              <mat-icon class="text-sm!">folder</mat-icon>
              {{ line().metadata.envelopeName }}
            </span>
          }
          @if (matchAnnotation()) {
            <span
              class="inline-flex items-center gap-1 text-label-small
                     bg-tertiary-container/50 text-on-tertiary-container
                     rounded-full px-2 py-0.5 w-fit"
            >
              <mat-icon class="text-xs! shrink-0 h-auto! w-auto!">
                search
              </mat-icon>
              {{ matchAnnotation() }}
            </span>
          }
          @if (line().metadata.isSpread && line().metadata.spreadGroupId) {
            <pulpe-spread-pill
              class="mt-0.5"
              [spreadGroupId]="line().metadata.spreadGroupId!"
              (openOccurrences)="openSpreadOccurrences.emit($event)"
            />
          }
        </div>
        @if (line().data.checkedAt) {
          <span class="text-body-small text-on-surface-variant ml-2">
            {{ line().data.checkedAt | date: dayMonthFormat() }}
          </span>
        }
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameCell {
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly dayMonthFormat = computed(
    () => getDateDisplayFormats(this.#userSettings.currency()).dayMonth,
  );
  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();

  readonly openSpreadOccurrences = output<string>();

  readonly matchAnnotation = computed(() =>
    formatMatchAnnotation(this.line().metadata.matchingTransactionNames),
  );
}
