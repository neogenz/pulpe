import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { UserSettingsStore } from '@core/user-settings';
import { TagStore } from '@core/tag';
import { FinancialKindDirective } from '@ui/financial-kind';
import { SpreadBadge } from '@ui/spread-badge';
import { SavingsWithdrawalBadge } from '@ui/savings-withdrawal-badge';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
import { TagIndicator } from '@ui/tag-indicator';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { formatMatchAnnotation } from '../../../view-models/budget-item-constants';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../../view-models/table-items.view-model';

@Component({
  selector: 'pulpe-name-cell',
  imports: [
    MatIconModule,
    MatTooltipModule,
    DatePipe,
    TranslocoPipe,
    FinancialKindDirective,
    SpreadBadge,
    SavingsWithdrawalBadge,
    SavingsGoalSourceLine,
    TagIndicator,
    TransactionLabelPipe,
  ],
  template: `
    <div class="flex items-start gap-2">
      <span class="flex h-8 shrink-0 items-center">
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
      </span>
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <div class="flex min-w-0 flex-1 flex-col">
          <span
            class="ph-no-capture flex min-h-8 items-center gap-1 text-body-medium font-semibold"
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
            @if (line().metadata.isSpread) {
              <pulpe-spread-badge />
            }
            @if (line().metadata.isSavingsWithdrawalIncome) {
              <pulpe-savings-withdrawal-badge />
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
          @if (line().metadata.savingsWithdrawalOriginLabel; as originLabel) {
            <span
              class="flex items-center gap-1 text-label-small text-on-surface-variant"
            >
              <mat-icon class="text-sm!">savings</mat-icon>
              {{
                'budget.savingsWithdrawal.originSubtitle'
                  | transloco: { month: originLabel }
              }}
            </span>
          }
          @if (linkedGoalName(); as goalName) {
            <span
              class="flex items-center gap-1 text-label-small text-on-surface-variant"
              [attr.data-testid]="'budget-table-linked-goal-' + line().data.id"
            >
              <mat-icon class="text-sm! shrink-0 h-auto! w-auto!">
                savings
              </mat-icon>
              <span class="truncate ph-no-capture">{{ goalName }}</span>
            </span>
          }
          @if (source(); as goalSource) {
            <pulpe-savings-goal-source-line
              class="text-label-small"
              [goalId]="goalSource.id"
              [goalName]="goalSource.name"
              [attr.data-testid]="'budget-table-source-goal-' + line().data.id"
            />
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
          <span class="mt-0.5">
            <pulpe-tag-indicator [tagNames]="tagNames()" />
          </span>
        </div>
        @if (line().data.checkedAt) {
          <span
            class="flex h-8 w-14 shrink-0 items-center justify-end text-right text-body-small text-on-surface-variant tabular-nums"
          >
            {{ line().data.checkedAt | date: dayMonthFormat() }}
          </span>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameCell {
  readonly #userSettings = inject(UserSettingsStore);
  readonly #tagStore = inject(TagStore);
  protected readonly dayMonthFormat = computed(
    () => getDateDisplayFormats(this.#userSettings.currency()).dayMonth,
  );
  readonly line = input.required<BudgetLineTableItem | TransactionTableItem>();
  readonly savingsGoalNameById = input<ReadonlyMap<string, string>>(new Map());

  readonly linkedGoalName = computed(() => {
    const data = this.line().data;
    if (!('savingsGoalId' in data) || !data.savingsGoalId) return undefined;
    return this.savingsGoalNameById().get(data.savingsGoalId);
  });

  // Le lien actif porte les deux champs, le lien cassé garde le nom seul : le
  // nom suffit donc à décider si la ligne d'origine s'affiche (PUL-329).
  readonly source = computed(() => {
    const data = this.line().data;
    if (!('sourceSavingsGoalName' in data) || !data.sourceSavingsGoalName) {
      return null;
    }
    return {
      id: data.sourceSavingsGoalId ?? null,
      name: data.sourceSavingsGoalName,
    };
  });

  readonly matchAnnotation = computed(() =>
    formatMatchAnnotation(this.line().metadata.matchingTransactionNames),
  );

  readonly tagNames = computed(() =>
    this.#tagStore.resolveNames(this.line().data.tagIds),
  );
}
