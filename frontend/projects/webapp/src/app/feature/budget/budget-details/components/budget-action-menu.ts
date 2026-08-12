import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';
import { CURRENCY_CONFIG } from '@core/currency';
import type { BudgetLineTableItem } from '../view-models/table-items.view-model';
import { BudgetLineActionList } from './budget-line-action-list';

const BALANCE_FORMATTERS = new Map<string, Intl.NumberFormat>();

function getBalanceFormatter(
  locale: string,
  currency: string,
): Intl.NumberFormat {
  const key = `${locale}-${currency}`;
  let formatter = BALANCE_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    BALANCE_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

/**
 * Contextual action menu for budget line cards.
 * Provides edit, add transaction, reset, and delete actions.
 */
@Component({
  selector: 'pulpe-budget-action-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    TranslocoPipe,
    BudgetLineActionList,
  ],
  template: `
    <button
      matIconButton
      [matMenuTriggerFor]="actionMenu"
      (click)="$event.stopPropagation()"
      [attr.data-testid]="'card-menu-' + item().data.id"
      class="shrink-0"
      [class]="buttonClass()"
    >
      <mat-icon>{{ menuIcon() }}</mat-icon>
    </button>

    <mat-menu #actionMenu="matMenu" xPosition="before">
      <div
        class="ph-no-capture px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
        [matTooltip]="item().data.name"
        matTooltipClass="ph-no-capture"
        matTooltipShowDelay="500"
      >
        {{ item().data.name }}
      </div>
      @if (showBalance()) {
        <div class="ph-no-capture px-4 pb-2 text-label-medium">
          {{ 'budget.balance' | transloco }}:
          {{ formattedBalance() }}
        </div>
      }
      <mat-divider />
      <pulpe-budget-line-action-list
        [item]="item()"
        (edit)="edit.emit($event)"
        (delete)="delete.emit($event)"
        (addTransaction)="addTransaction.emit($event)"
        (spread)="spread.emit($event)"
        (resetFromTemplate)="resetFromTemplate.emit($event)"
        (postpone)="postpone.emit($event)"
      />
    </mat-menu>
  `,
  styles: `
    :host {
      display: inline-block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetActionMenu {
  readonly item = input.required<BudgetLineTableItem>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly menuIcon = input<string>('more_vert');
  readonly buttonClass = input<string>('');
  readonly showBalance = input<boolean>(false);

  readonly edit = output<BudgetLineTableItem>();
  readonly delete = output<string>();
  readonly addTransaction = output<BudgetLineTableItem['data']>();
  readonly spread = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<BudgetLineTableItem>();
  readonly postpone = output<string>();

  protected readonly formattedBalance = computed(() => {
    const balance = this.item().metadata.cumulativeBalance;
    const currency = this.currency();
    const config = CURRENCY_CONFIG[currency];
    return getBalanceFormatter(config.locale, currency).format(balance);
  });
}
