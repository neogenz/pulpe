import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type BudgetLine, type SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe, FormatConversionPipe } from '@core/currency';
import { FinancialKindDirective } from '@ui/financial-kind';
import { SpreadBadge } from '@ui/spread-badge';
import { SavingsWithdrawalBadge } from '@ui/savings-withdrawal-badge';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { TagIndicator } from '@ui/tag-indicator';
import { FinancialLineCard } from '@pattern/financial-line-card';
import { OriginalAmountLine } from '@ui/original-amount-line';
import { TagStore } from '@core/tag';
import { formatMatchAnnotation } from '../../view-models/budget-item-constants';
import type { BudgetLineTableItem } from '../../view-models/table-items.view-model';
import { SegmentedBudgetProgress } from '../segmented-budget-progress';
import { BudgetActionMenu } from '../budget-action-menu';

@Component({
  selector: 'pulpe-budget-grid-mobile-card',
  imports: [
    MatBadgeModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TranslocoPipe,
    AppCurrencyPipe,
    FinancialKindDirective,
    FinancialLineCard,
    OriginalAmountLine,
    FormatConversionPipe,
    SegmentedBudgetProgress,
    BudgetActionMenu,
    SpreadBadge,
    SavingsWithdrawalBadge,
    SavingsGoalSourceLine,
    TagIndicator,
  ],
  template: `
    <pulpe-financial-line-card
      [kind]="item().data.kind"
      [name]="item().metadata.displayName"
      [amount]="item().data.amount"
      [currency]="currency()"
      [recurrence]="item().data.recurrence"
      [isStriked]="!!item().data.checkedAt"
      [dataTestId]="'envelope-card-' + item().data.id"
      [class.ring-2]="isSelected()"
      [class.ring-primary]="isSelected()"
      [class.opacity-60]="item().metadata.isLoading"
      class="block cursor-pointer"
      role="button"
      tabindex="0"
      (click)="viewTransactions.emit(item())"
      (keydown.enter)="viewTransactions.emit(item())"
      (keydown.space)="viewTransactions.emit(item())"
    >
      <ng-container ngProjectAs="[name]">
        <span
          class="text-title-medium font-medium truncate ph-no-capture"
          [class.line-through]="item().data.checkedAt"
          [class.text-on-surface-variant]="item().data.checkedAt"
        >
          {{ item().metadata.displayName }}
        </span>
      </ng-container>

      @if (
        item().metadata.isPropagationLocked ||
        item().metadata.isSpread ||
        item().metadata.isSavingsWithdrawalIncome ||
        tagNames().length > 0
      ) {
        <ng-container ngProjectAs="[indicators]">
          @if (item().metadata.isPropagationLocked) {
            <mat-icon
              class="text-sm! text-outline shrink-0"
              [matTooltip]="'budget.lockedAmountsTooltip' | transloco"
            >
              lock
            </mat-icon>
          }
          @if (item().metadata.isSpread) {
            <pulpe-spread-badge />
          }
          @if (item().metadata.isSavingsWithdrawalIncome) {
            <pulpe-savings-withdrawal-badge />
          }
          <pulpe-tag-indicator [tagNames]="tagNames()" class="shrink-0" />
        </ng-container>
      }

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
          (spread)="spread.emit($event)"
          (resetFromTemplate)="resetFromTemplate.emit($event)"
          (postpone)="postpone.emit($event)"
        />
      </ng-container>

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
            {{ remaining | appCurrency: currency() : '1.0-0' }}
          </div>
          <span class="text-label-small text-on-surface-variant">{{
            'budgetLine.available' | transloco
          }}</span>
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
            [tooltipText]="item().data | formatConversion"
          />
        </ng-container>
      }

      <ng-container ngProjectAs="[footer]">
        @if (linkedGoalName()) {
          <div
            class="flex items-center gap-1 min-w-0 mb-3 text-on-surface-variant"
            [attr.data-testid]="'envelope-linked-goal-' + item().data.id"
          >
            <mat-icon
              class="text-sm! shrink-0 h-auto! w-auto!"
              aria-hidden="true"
              >savings</mat-icon
            >
            <span class="text-label-small truncate ph-no-capture">{{
              linkedGoalName()
            }}</span>
          </div>
        }

        @if (item().data.sourceSavingsGoalName; as sourceName) {
          <pulpe-savings-goal-source-line
            class="text-label-small mb-3 max-w-full"
            [goalId]="item().data.sourceSavingsGoalId"
            [goalName]="sourceName"
            [attr.data-testid]="'envelope-source-goal-' + item().data.id"
          />
        }

        @if (item().metadata.savingsWithdrawalOriginLabel; as originLabel) {
          <div
            class="flex items-center gap-1 min-w-0 mb-3 text-on-surface-variant"
          >
            <mat-icon
              class="text-sm! shrink-0 h-auto! w-auto!"
              aria-hidden="true"
              >savings</mat-icon
            >
            <span class="text-label-small truncate">{{
              'budget.savingsWithdrawal.originSubtitle'
                | transloco: { month: originLabel }
            }}</span>
          </div>
        }

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

        @if (item().consumption?.hasTransactions) {
          <div class="mb-4">
            <pulpe-segmented-budget-progress
              [percentage]="item().consumption!.percentage"
              [segmentCount]="10"
              [height]="6"
              [consumptionState]="item().consumption!.consumptionState"
            />
            <div class="flex justify-between items-center mt-2">
              <span
                class="ph-no-capture text-body-small text-on-surface-variant"
              >
                {{
                  item().consumption!.consumed
                    | appCurrency: currency() : '1.0-0'
                }}
                {{ 'budgetLine.spent' | transloco }}
              </span>
              <span class="text-body-small font-medium">
                @if (item().consumption!.consumptionState === 'over-budget') {
                  <span class="text-financial-over-budget">{{
                    'budgetLine.exceeded' | transloco
                  }}</span>
                } @else if (
                  item().consumption!.consumptionState === 'near-limit'
                ) {
                  <span class="text-financial-warning"
                    >{{ item().consumption!.percentage }}%</span
                  >
                } @else {
                  <span class="text-on-surface-variant"
                    >{{ item().consumption!.percentage }}%</span
                  >
                }
              </span>
            </div>
          </div>
        }
      </ng-container>

      <ng-container ngProjectAs="[actions]">
        @if (item().consumption?.hasTransactions) {
          <button
            matButton
            class="text-body-small h-8! px-3!"
            [matBadge]="item().consumption!.transactionCount"
            matBadgeColor="primary"
            (click)="viewTransactions.emit(item()); $event.stopPropagation()"
            [matTooltip]="
              'budget.viewTransactionsCount'
                | transloco
                  : { label: item().consumption!.transactionCountLabel }
            "
          >
            <mat-icon class="text-base! mr-1">receipt_long</mat-icon>
            <span class="ph-no-capture">{{
              item().consumption!.consumed | appCurrency: currency() : '1.0-0'
            }}</span>
          </button>
        }
        <button
          matIconButton
          class="text-primary"
          (click)="addTransaction.emit(item().data); $event.stopPropagation()"
          [matTooltip]="'budgetLine.addTransaction' | transloco"
          [attr.aria-label]="'budgetLine.addTransaction' | transloco"
          [attr.data-testid]="'add-transaction-' + item().data.id"
        >
          <mat-icon>add</mat-icon>
        </button>

        <!--
          Un retrait annoncé ne se pointe pas : il se réalise en saisissant le
          revenu réel. Même sortie que la bascule — le conteneur tranche.
        -->
        @if (item().metadata.sourceWithdrawalCtaKey; as ctaKey) {
          <button
            matIconButton
            class="text-primary"
            (click)="toggleCheck.emit(item().data.id); $event.stopPropagation()"
            [matTooltip]="ctaKey | transloco: { name: item().data.name }"
            [attr.aria-label]="ctaKey | transloco: { name: item().data.name }"
            [attr.data-testid]="'realize-withdrawal-' + item().data.id"
          >
            <mat-icon>price_check</mat-icon>
          </button>
        } @else {
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
        }
      </ng-container>
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
  readonly #tagStore = inject(TagStore);
  readonly item = input.required<BudgetLineTableItem>();

  readonly tagNames = computed(() =>
    this.#tagStore.resolveNames(this.item().data.tagIds),
  );
  readonly currency = input<SupportedCurrency>('CHF');
  readonly isSelected = input<boolean>(false);
  /** Name of the linked savings goal, when this saving envelope targets one (PUL-12) */
  readonly linkedGoalName = input<string | undefined>(undefined);

  readonly matchAnnotation = computed(() =>
    formatMatchAnnotation(this.item().metadata.matchingTransactionNames),
  );

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly spread = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly postpone = output<string>();
  readonly toggleCheck = output<string>();
}
