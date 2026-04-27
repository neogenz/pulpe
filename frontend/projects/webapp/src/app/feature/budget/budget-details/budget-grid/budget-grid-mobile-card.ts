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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { type BudgetLine, type SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe, ConversionTooltipPipe } from '@core/currency';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialLineCard } from '@pattern/financial-line-card';
import { OriginalAmountLine } from '@ui/original-amount-line';
import { formatMatchAnnotation } from '../view-models/budget-item-constants';
import type { BudgetLineTableItem } from '../view-models/table-items.view-model';
import { SegmentedBudgetProgress } from '../components/segmented-budget-progress';
import { BudgetActionMenu } from '../components/budget-action-menu';

@Component({
  selector: 'pulpe-budget-grid-mobile-card',
  imports: [
    MatBadgeModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
    FinancialKindDirective,
    FinancialLineCard,
    OriginalAmountLine,
    ConversionTooltipPipe,
    SegmentedBudgetProgress,
    BudgetActionMenu,
  ],
  template: `
    <pulpe-financial-line-card
      [kind]="item().data.kind"
      [name]="item().metadata.displayName"
      [amount]="item().data.amount"
      [currency]="currency()"
      [recurrence]="
        !item().metadata.isRollover ? item().data.recurrence : undefined
      "
      [isStriked]="!!item().data.checkedAt"
      [dataTestId]="'envelope-card-' + item().data.id"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
    >
      <ng-container ngProjectAs="[name]">
        <span
          class="text-title-medium font-medium truncate ph-no-capture"
          [class.line-through]="item().data.checkedAt"
          [class.text-on-surface-variant]="item().data.checkedAt"
        >
          @if (
            item().metadata.isRollover && item().metadata.rolloverSourceBudgetId
          ) {
            <a
              [routerLink]="['/budget', item().metadata.rolloverSourceBudgetId]"
              class="text-primary underline-offset-2 hover:underline"
            >
              {{ item().metadata.displayName }}
            </a>
          } @else {
            {{ item().metadata.displayName }}
          }
        </span>
      </ng-container>

      @if (item().metadata.isPropagationLocked) {
        <ng-container ngProjectAs="[indicators]">
          <mat-icon
            class="text-sm! text-outline shrink-0"
            [matTooltip]="'budget.lockedAmountsTooltip' | transloco"
          >
            lock
          </mat-icon>
        </ng-container>
      }

      @if (!item().metadata.isRollover) {
        <ng-container ngProjectAs="[menu]">
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
        </ng-container>
      }

      @if (item().consumption?.hasTransactions) {
        @let remaining = item().data.amount - item().consumption!.consumed;
        <ng-container ngProjectAs="[amount]">
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
            {{ remaining | appCurrency: currency() : '1.2-2' }}
          </div>
          <span class="text-label-small text-on-surface-variant">
            {{
              'budgetLine.availableOf'
                | transloco
                  : {
                      amount:
                        (item().data.amount
                        | appCurrency: currency() : '1.2-2'),
                    }
            }}
          </span>
        </ng-container>

        <ng-container ngProjectAs="[meta]">
          <div class="text-right">
            <div
              class="ph-no-capture text-title-medium font-semibold text-on-surface"
            >
              {{
                item().consumption!.consumed | appCurrency: currency() : '1.2-2'
              }}
            </div>
            <span class="text-label-small text-on-surface-variant">{{
              'budgetLine.spent' | transloco
            }}</span>
          </div>
        </ng-container>
      } @else {
        <ng-container ngProjectAs="[amount]">
          <div
            class="ph-no-capture text-headline-medium font-bold"
            [pulpeFinancialKind]="item().data.kind"
          >
            {{ item().data.amount | appCurrency: currency() : '1.2-2' }}
          </div>
          <span class="text-label-small text-on-surface-variant">{{
            'budgetLine.planned' | transloco
          }}</span>
          <pulpe-original-amount-line
            [originalAmount]="item().data.originalAmount"
            [originalCurrency]="item().data.originalCurrency"
            [displayCurrency]="currency()"
            [tooltipText]="
              isMultiCurrencyEnabled() ? (item().data | conversionTooltip) : ''
            "
          />
        </ng-container>
      }

      <ng-container ngProjectAs="[footer]">
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
                              | appCurrency: currency() : '1.2-2'),
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
      </ng-container>

      @if (!item().metadata.isRollover) {
        <ng-container ngProjectAs="[actions]">
          @if (item().consumption?.hasTransactions) {
            <button
              matButton
              class="text-body-small h-8! px-3!"
              [matBadge]="item().consumption!.transactionCount"
              matBadgeColor="primary"
              (click)="viewTransactions.emit(item())"
              [matTooltip]="
                'budget.viewTransactionsCount'
                  | transloco
                    : { label: item().consumption!.transactionCountLabel }
              "
            >
              <mat-icon class="text-base! mr-1">receipt_long</mat-icon>
              <span class="ph-no-capture">{{
                item().consumption!.consumed | appCurrency: currency() : '1.2-2'
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
        </ng-container>
      }
    </pulpe-financial-line-card>
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
  readonly currency = input<SupportedCurrency>('CHF');
  readonly isSelected = input<boolean>(false);
  readonly isMultiCurrencyEnabled = input<boolean>(false);

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
