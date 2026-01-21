import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import { FinancialKindDirective } from '@ui/financial-kind';
import { TransactionLabelPipe } from '@ui/transaction-display';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../data-core';

@Component({
  selector: 'pulpe-name-cell',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterLink,
    DatePipe,
    FinancialKindDirective,
    TransactionLabelPipe,
    RolloverFormatPipe,
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
      <span
        class="inline-flex items-center gap-2"
        [class.rollover-text]="line().metadata.isRollover"
      >
        @if (
          line().metadata.isRollover && line().metadata.rolloverSourceBudgetId
        ) {
          <a
            [routerLink]="[
              '/app/budget',
              line().metadata.rolloverSourceBudgetId,
            ]"
            matButton
            class="ph-no-capture text-body-medium font-semibold"
          >
            <mat-icon class="text-base!">open_in_new</mat-icon>
            {{ line().data.name | rolloverFormat }}
          </a>
        } @else {
          <div class="flex flex-col">
            <span
              class="ph-no-capture text-body-medium font-semibold flex items-center gap-1"
              [pulpeFinancialKind]="line().data.kind"
            >
              {{ line().data.name | rolloverFormat }}
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
                class="flex items-center gap-1 text-label-small text-on-surface-variant"
              >
                <mat-icon class="text-sm!">folder</mat-icon>
                {{ line().metadata.envelopeName }}
              </span>
            }
          </div>
        }
        @if (line().data.checkedAt) {
          <span class="text-body-small text-on-surface-variant ml-2">
            {{ line().data.checkedAt | date: 'dd.MM' : '' : 'fr-CH' }}
          </span>
        }
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameCell {
  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();
}
