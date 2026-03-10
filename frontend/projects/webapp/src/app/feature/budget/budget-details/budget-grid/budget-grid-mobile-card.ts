import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { type BudgetLine } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { FinancialKindDirective } from '@ui/financial-kind';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import { formatMatchAnnotation, type BudgetLineTableItem } from '../data-core';
import { SegmentedBudgetProgress } from '../components/segmented-budget-progress';
import { BudgetKindIndicator } from '../components/budget-kind-indicator';
import { BudgetActionMenu } from '../components/budget-action-menu';

/**
 * Mobile card component for displaying a single budget line
 * "Breathing Cards" design with asymmetric layout and status strip
 */
@Component({
  selector: 'pulpe-budget-grid-mobile-card',
  imports: [
    MatCardModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatChipsModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
    FinancialKindDirective,
    RecurrenceLabelPipe,
    SegmentedBudgetProgress,
    BudgetKindIndicator,
    BudgetActionMenu,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="!rounded-corner-large min-h-[188px]"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
      [attr.data-testid]="'envelope-card-' + item().data.id"
    >
      <mat-card-content class="p-4">
        <!-- Row 1: Name and Menu -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <pulpe-budget-kind-indicator [kind]="item().data.kind" />
            <span
              class="text-title-medium font-medium truncate ph-no-capture"
              [class.line-through]="item().data.checkedAt"
              [class.text-on-surface-variant]="item().data.checkedAt"
            >
              @if (
                item().metadata.isRollover &&
                item().metadata.rolloverSourceBudgetId
              ) {
                <a
                  [routerLink]="[
                    '/budget',
                    item().metadata.rolloverSourceBudgetId,
                  ]"
                  class="text-primary underline-offset-2 hover:underline"
                >
                  {{ item().metadata.displayName }}
                </a>
              } @else {
                {{ item().metadata.displayName }}
              }
            </span>
            @if (item().metadata.isPropagationLocked) {
              <mat-icon
                class="text-sm! text-outline shrink-0"
                matTooltip="Montants verrouillés"
              >
                lock
              </mat-icon>
            }
          </div>
          @if (!item().metadata.isRollover) {
            <pulpe-budget-action-menu
              [item]="item()"
              [currency]="currency()"
              menuIcon="more_horiz"
              buttonClass="!-mr-2 !-mt-1"
              [showBalance]="true"
              (edit)="edit.emit($event)"
              (delete)="delete.emit($event)"
              (addTransaction)="addTransaction.emit($event)"
              (resetFromTemplate)="resetFromTemplate.emit($event)"
            />
          }
        </div>

        @if (matchAnnotation()) {
          <div
            class="-mt-2 mb-3 mx-auto flex items-center gap-1.5 text-body-small
                   bg-tertiary-container/50 text-on-tertiary-container
                   rounded-full px-2.5 py-1 w-fit max-w-full"
          >
            <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">
              search
            </mat-icon>
            <span class="truncate">{{ matchAnnotation() }}</span>
          </div>
        }

        <!-- Row 2: Amount prominently left-aligned with consumption on right -->
        <div class="flex items-end justify-between mb-4">
          <div>
            @if (item().consumption?.hasTransactions) {
              @let remaining =
                item().data.amount - item().consumption!.consumed;
              <div
                class="ph-no-capture text-headline-medium font-bold"
                [class.text-on-surface-variant]="
                  item().consumption!.consumptionState === 'healthy'
                "
                [class.text-financial-warning]="
                  item().consumption!.consumptionState === 'near-limit'
                "
                [class.text-financial-over-budget]="
                  item().consumption!.consumptionState === 'over-budget'
                "
              >
                {{ remaining | appCurrency: '1.0-0' }}
              </div>
              <span class="text-label-small text-on-surface-variant">{{
                'budgetLine.available' | transloco
              }}</span>
            } @else {
              <div
                class="ph-no-capture text-headline-medium font-bold"
                [pulpeFinancialKind]="item().data.kind"
              >
                {{ item().data.amount | appCurrency: '1.0-0' }}
              </div>
              <span class="text-label-small text-on-surface-variant">{{
                'budgetLine.planned' | transloco
              }}</span>
            }
          </div>

          <!-- Consumption mini-stat if applicable -->
          @if (item().consumption?.hasTransactions) {
            <div class="text-right">
              <div
                class="ph-no-capture text-title-medium font-semibold text-on-surface"
              >
                {{ item().consumption!.consumed | appCurrency: '1.0-0' }}
              </div>
              <span class="text-label-small text-on-surface-variant">{{
                'budgetLine.spent' | transloco
              }}</span>
            </div>
          }
        </div>

        <!-- Row 3: Segmented Progress (if applicable) -->
        @if (
          item().consumption?.hasTransactions && !item().metadata.isRollover
        ) {
          <div class="mb-4">
            <pulpe-segmented-budget-progress
              [percentage]="item().consumption!.percentage"
              [segmentCount]="10"
              [height]="6"
              [consumptionState]="item().consumption!.consumptionState"
            />
            <div class="text-label-small text-center mt-1.5">
              @if (item().consumption!.consumptionState === 'over-budget') {
                <span class="ph-no-capture text-financial-over-budget">
                  {{
                    'budgetLine.exceededBy'
                      | transloco
                        : {
                            amount:
                              (item().consumption!.consumed - item().data.amount
                              | appCurrency: '1.0-0'),
                          }
                  }}
                </span>
              } @else if (
                item().consumption!.consumptionState === 'near-limit'
              ) {
                <span class="text-financial-warning">{{
                  'budgetLine.usedPercent'
                    | transloco: { percent: item().consumption!.percentage }
                }}</span>
              } @else {
                <span class="text-on-surface-variant">{{
                  'budgetLine.usedPercent'
                    | transloco: { percent: item().consumption!.percentage }
                }}</span>
              }
            </div>
          </div>
        }

        <!-- Row 4: Actions footer -->
        @if (!item().metadata.isRollover) {
          <div
            class="flex items-center justify-between pt-3 border-t border-outline-variant/30"
          >
            <mat-chip class="!h-6 !text-label-small bg-surface-container">
              {{ item().data.recurrence | recurrenceLabel }}
            </mat-chip>

            <div class="flex items-center gap-2">
              @if (item().consumption?.hasTransactions) {
                <button
                  matButton
                  class="text-body-small h-8! px-3!"
                  [matBadge]="item().consumption!.transactionCount"
                  matBadgeColor="primary"
                  (click)="viewTransactions.emit(item())"
                  [matTooltip]="
                    'Voir les ' + item().consumption!.transactionCountLabel
                  "
                >
                  <mat-icon class="text-base! mr-1">receipt_long</mat-icon>
                  <span class="ph-no-capture">{{
                    item().consumption!.consumed | appCurrency: '1.0-0'
                  }}</span>
                </button>
              }
              <button
                matIconButton
                class="text-primary"
                (click)="addTransaction.emit(item().data)"
                [matTooltip]="'budgetLine.addTransaction' | transloco"
                [attr.aria-label]="'budgetLine.addTransaction' | transloco"
                [attr.data-testid]="'add-transaction-' + item().data.id"
              >
                <mat-icon>add</mat-icon>
              </button>

              <mat-slide-toggle
                [checked]="!!item().data.checkedAt"
                (change)="toggleCheck.emit(item().data.id)"
                (click)="$event.stopPropagation()"
                [attr.data-testid]="'toggle-check-' + item().data.id"
                [attr.aria-label]="
                  item().data.checkedAt
                    ? ('budgetLine.uncheckLabel'
                      | transloco: { name: item().data.name })
                    : ('budgetLine.checkLabel'
                      | transloco: { name: item().data.name })
                "
              />
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetGridMobileCard {
  readonly item = input.required<BudgetLineTableItem>();
  readonly currency = input<string>('CHF');
  readonly isSelected = input<boolean>(false);

  readonly matchAnnotation = computed(() =>
    formatMatchAnnotation(this.item().metadata.matchingTransactionNames),
  );

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly toggleCheck = output<string>();
}
