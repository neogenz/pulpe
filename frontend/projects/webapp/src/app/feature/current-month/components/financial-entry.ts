import { DecimalPipe } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { map, shareReplay } from 'rxjs/operators';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import { type FinancialEntryModel } from '../models/financial-entry.model';

export type FinancialEntryViewModel = FinancialEntryModel & {
  isSelected: boolean;
  isRollover: boolean;
};

@Component({
  selector: 'pulpe-financial-entry',

  imports: [
    DecimalPipe,
    MatIconModule,
    MatListModule,
    MatCheckboxModule,
    MatRippleModule,
    MatButtonModule,
    MatMenuModule,
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
      <!--
      <div matListItemAvatar class="flex justify-center items-center gap-4">
        @if (selectable()) {
          <mat-checkbox
            [checked]="data().isSelected"
            (change)="selectionChange.emit($event.checked)"
            (click)="$event.stopPropagation()"
          />
        }
      </div>
      -->
      <div matListItemTitle [class.rollover-text]="isRollover()">
        @if (isRollover() && rolloverSourceBudgetId()) {
          <a
            [routerLink]="['/app/budget', rolloverSourceBudgetId()]"
            matButton
            class="ph-no-capture inline-flex items-center font-semibold"
            matTooltip="Voir le mois d'origine"
          >
            <mat-icon class="!text-base">open_in_new</mat-icon>
            {{ data().name | rolloverFormat }}
          </a>
        } @else {
          <span class="ph-no-capture">{{
            isRollover() ? (data().name | rolloverFormat) : data().name
          }}</span>
        }
      </div>
      <div matListItemMeta class="!flex !h-full !items-center">
        <span class="ph-no-capture" [class.italic]="isRollover()">
          {{ data().kind === 'income' ? '+' : '-'
          }}{{ data().amount | number: '1.2-2' : 'de-CH' }}
        </span>
        @if (isMobile() && (editable() || deletable())) {
          <!-- Mobile: Menu button for edit/delete actions -->
          <button
            matIconButton
            [matMenuTriggerFor]="actionMenu"
            [attr.aria-label]="'Actions pour ' + data().name"
            [attr.data-testid]="'actions-menu-' + data().id"
            class="!w-10 !h-10 text-on-surface-variant"
            (click)="$event.stopPropagation()"
          >
            <mat-icon>more_vert</mat-icon>
          </button>

          <mat-menu #actionMenu="matMenu" xPosition="before">
            @if (editable()) {
              <button
                mat-menu-item
                (click)="onEditClick($event)"
                [attr.data-testid]="'edit-transaction-' + data().id"
              >
                <mat-icon matMenuItemIcon>edit</mat-icon>
                <span>Éditer</span>
              </button>
            }
            @if (deletable()) {
              <button
                mat-menu-item
                (click)="onDeleteClick($event)"
                [attr.data-testid]="'delete-transaction-' + data().id"
              >
                <mat-icon matMenuItemIcon>delete</mat-icon>
                <span>Supprimer</span>
              </button>
            }
          </mat-menu>
        } @else {
          <!-- Desktop: Separate edit and delete buttons -->
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
export class FinancialEntry {
  readonly #breakpointObserver = inject(BreakpointObserver);

  readonly data = input.required<FinancialEntryViewModel>();
  readonly selectable = input<boolean>(false);
  readonly deletable = input<boolean>(false);
  readonly editable = input<boolean>(false);
  readonly isOdd = input<boolean>(false);

  readonly selectionChange = output<boolean>();
  readonly deleteClick = output<void>();
  readonly editClick = output<void>();

  // Responsive breakpoint detection for mobile view
  protected readonly isMobile = toSignal(
    this.#breakpointObserver.observe(Breakpoints.Handset).pipe(
      map((result) => result.matches),
      shareReplay(),
    ),
    { initialValue: false },
  );

  readonly isRollover = computed<boolean>(
    () => this.data().isRollover ?? false,
  );

  readonly rolloverSourceBudgetId = computed<string | null>(
    () => this.data().rollover.sourceBudgetId ?? null,
  );

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
