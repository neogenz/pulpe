import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import { TransactionIconPipe } from '@ui/transaction-display';

export interface TransactionItemData {
  id: string;
  name: string;
  amount: number;
  kind: 'income' | 'expense' | 'saving';
  category?: string | null;
  isSelected: boolean;
  isRollover?: boolean;
}

@Component({
  selector: 'pulpe-transaction-item',
  standalone: true,
  imports: [
    CurrencyPipe,
    MatIconModule,
    MatListModule,
    MatCheckboxModule,
    MatRippleModule,
    MatButtonModule,
    TransactionIconPipe,
    MatTooltipModule,
    RouterLink,
    RolloverFormatPipe,
  ],
  template: `
    <mat-list-item
      matRipple
      [matRippleDisabled]="!selectable()"
      [class.odd-item]="isOdd()"
      [class.income-item]="data().kind === 'income'"
      [class.saving-item]="data().kind === 'saving'"
      [class.expense-item]="data().kind === 'expense'"
      [class.!cursor-pointer]="selectable()"
      (click)="handleClick()"
    >
      <div matListItemAvatar class="flex justify-center items-center gap-4">
        @if (selectable()) {
          <mat-checkbox
            [checked]="data().isSelected"
            (change)="selectionChange.emit($event.checked)"
            (click)="$event.stopPropagation()"
          />
        }
        <div
          class="flex justify-center items-center size-11 bg-surface rounded-full"
        >
          <mat-icon
            [class]="
              '!text-(--pulpe-financial-' +
              (data().kind === 'income'
                ? 'income'
                : data().kind === 'saving'
                  ? 'savings'
                  : 'expense') +
              ')'
            "
          >
            {{ data().kind | transactionIcon }}
          </mat-icon>
        </div>
      </div>
      <div matListItemTitle [class.rollover-text]="isRollover()">
        @if (isRollover() && rolloverSourceBudgetId()) {
          <a
            [routerLink]="['/app/budget', rolloverSourceBudgetId()]"
            matButton
            class="inline-flex items-center font-semibold"
            matTooltip="Voir le mois d'origine"
          >
            <mat-icon class="!text-base">open_in_new</mat-icon>
            {{ data().name | rolloverFormat }}
          </a>
        } @else {
          {{ isRollover() ? (data().name | rolloverFormat) : data().name }}
        }
      </div>
      @if (data().category) {
        <div matListItemLine class="text-body-small italic">
          {{ data().category }}
        </div>
      }
      <div matListItemMeta class="!flex !h-full !items-center !gap-3">
        <span [class.italic]="isRollover()">
          {{ data().kind === 'income' ? '+' : '-'
          }}{{ data().amount | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
        </span>
        @if (editable()) {
          <button
            matIconButton
            (click)="onEditClick($event)"
            [attr.aria-label]="'Modifier ' + data().name"
            [attr.data-testid]="'edit-transaction-' + data().id"
            class="!w-10 !h-10 text-primary"
          >
            <mat-icon>edit</mat-icon>
          </button>
        }
        @if (deletable()) {
          <button
            matIconButton
            (click)="onDeleteClick($event)"
            [attr.aria-label]="'Supprimer ' + data().name"
            [attr.data-testid]="'delete-transaction-' + data().id"
            class="!w-10 !h-10 text-error"
          >
            <mat-icon>delete</mat-icon>
          </button>
        }
      </div>
    </mat-list-item>
  `,
  styles: `
    @use '@angular/material' as mat;
    :host {
      @include mat.list-overrides(
        (
          list-item-leading-avatar-color: none,
          list-item-leading-avatar-size: fit-content,
          list-item-two-line-container-height: 71px,
          list-item-one-line-container-height: 71px,
          list-item-trailing-supporting-text-size: var(
              --mat-sys-title-medium-size
            ),
          list-item-trailing-supporting-text-color: var(
              --pulpe-financial-expense
            ),
        )
      );

      .odd-item {
        @include mat.list-overrides(
          (
            list-item-container-color: var(--mat-sys-surface-container),
          )
        );
      }

      .income-item {
        @include mat.list-overrides(
          (
            list-item-trailing-supporting-text-color: var(
                --pulpe-financial-income
              ),
          )
        );
      }

      .saving-item {
        @include mat.list-overrides(
          (
            list-item-trailing-supporting-text-color: var(
                --pulpe-financial-savings
              ),
          )
        );
      }

      .mat-mdc-list-item:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }
    }

    .expense-item {
      @include mat.list-overrides(
        (
          list-item-trailing-supporting-text-color: var(
              --pulpe-financial-expense
            ),
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionItem {
  readonly data = input.required<TransactionItemData>();
  readonly selectable = input<boolean>(false);
  readonly deletable = input<boolean>(false);
  readonly editable = input<boolean>(false);
  readonly isOdd = input<boolean>(false);

  readonly selectionChange = output<boolean>();
  readonly deleteClick = output<void>();
  readonly editClick = output<void>();

  readonly isRollover = computed<boolean>(() => {
    const d = this.data();
    if (typeof d.isRollover === 'boolean') return d.isRollover;
    return d.name?.startsWith('rollover_');
  });

  readonly rolloverSourceBudgetId = computed<string | null>(() => {
    return (
      (this.data() as unknown as { rolloverSourceBudgetId?: string | null })
        .rolloverSourceBudgetId ?? null
    );
  });

  protected handleClick(): void {
    if (this.selectable()) {
      this.selectionChange.emit(!this.data().isSelected);
    }
  }

  protected onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit();
  }

  protected onEditClick(event: Event): void {
    event.stopPropagation();
    this.editClick.emit();
  }
}
