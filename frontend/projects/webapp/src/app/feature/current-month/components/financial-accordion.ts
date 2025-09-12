import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import {
  FinancialEntry,
  type FinancialEntryViewModel,
} from './financial-entry';
import { type FinancialEntryModel } from '../models/financial-entry.model';

export interface FinancialAccordionConfig {
  readonly title: string;
  readonly totalAmount?: number;
  readonly emptyStateIcon?: string;
  readonly emptyStateTitle?: string;
  readonly emptyStateSubtitle?: string;
  readonly selectable?: boolean;
  readonly defaultExpanded?: boolean;
  readonly deletable?: boolean;
  readonly editable?: boolean;
}

@Component({
  selector: 'pulpe-financial-accordion',
  imports: [
    CurrencyPipe,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatButtonModule,
    MatChipsModule,
    FinancialEntry,
  ],
  template: `
    <div
      class="flex flex-col rounded-corner-large overflow-hidden bg-surface-container-low"
    >
      <div
        class="p-4 cursor-pointer flex justify-between items-center"
        role="button"
        tabindex="0"
        (click)="toggleExpanded()"
        (keyup.enter)="toggleExpanded()"
        (keyup.space)="toggleExpanded()"
      >
        <div data-testid="left-side" class="flex items-center gap-3">
          <h2 class="text-title-small md:text-title-medium">
            {{ config().title }}
          </h2>
          @if (!isHandset()) {
            <mat-chip-set>
              <mat-chip>
                {{ financialEntries().length }}
                {{
                  financialEntries().length === 1
                    ? 'transaction'
                    : 'transactions'
                }}
              </mat-chip>
            </mat-chip-set>
          }
        </div>
        <div data-testid="right-side" class="flex items-center gap-3">
          @if (config().totalAmount !== undefined) {
            <span
              class="text-title-medium font-medium"
              [class.text-pulpe-financial-income]="config().totalAmount! > 0"
              [class.text-pulpe-financial-expense]="config().totalAmount! < 0"
              [class.text-on-surface]="config().totalAmount! === 0"
            >
              {{ config().totalAmount! > 0 ? '+' : ''
              }}{{
                config().totalAmount!
                  | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
              }}
            </span>
          }
          <mat-icon
            class="transition-transform duration-200"
            [class.rotate-180]="!isExpanded()"
            >expand_less
          </mat-icon>
        </div>
      </div>

      @if (isExpanded()) {
        <div>
          @if (financialEntries().length === 0) {
            <div
              class="flex flex-col items-center justify-center py-8 text-center"
            >
              <mat-icon
                class="text-(--color-outline) mb-3"
                style="font-size: 48px; width: 48px; height: 48px;"
              >
                {{ config().emptyStateIcon || 'inbox' }}
              </mat-icon>
              <p class="text-body-large text-(--color-on-surface-variant) mb-1">
                {{ config().emptyStateTitle || 'Aucune transaction' }}
              </p>
              <p class="text-body-small text-(--color-outline)">
                {{
                  config().emptyStateSubtitle ||
                    'Les transactions apparaîtront ici'
                }}
              </p>
            </div>
          } @else {
            <mat-list class="!pb-0">
              @for (
                vm of displayedFinancialEntries().items;
                track vm.id;
                let isLast = $last;
                let isOdd = $odd
              ) {
                <pulpe-financial-entry
                  [data]="vm"
                  [selectable]="config().selectable ?? false"
                  [deletable]="config().deletable ?? false"
                  [editable]="config().editable ?? false"
                  [isOdd]="isOdd"
                  (selectionChange)="toggleSelection(vm.id, $event)"
                  (deleteClick)="deleteFinancialEntry.emit(vm.id)"
                  (editClick)="editFinancialEntry.emit(vm.id)"
                />
                @if (!isLast) {
                  <mat-divider></mat-divider>
                }
              }
            </mat-list>

            @if (displayedFinancialEntries().hasMore) {
              <div class="flex justify-center p-4">
                <button
                  matButton
                  (click)="showAllFinancialEntries()"
                  class="text-primary"
                >
                  Voir plus ({{ displayedFinancialEntries().remaining }})
                </button>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: `
    @use '@angular/material' as mat;
    :host {
      color: var(--mat-sys-on-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialAccordion {
  readonly financialEntries = input.required<FinancialEntryModel[]>();
  readonly config = input.required<FinancialAccordionConfig>();
  readonly selectedFinancialEntries = model<string[]>([]);
  readonly deleteFinancialEntry = output<string>();
  readonly editFinancialEntry = output<string>();
  readonly isHandset = input<boolean>(false);

  private readonly expandedState = signal<boolean | null>(null);
  protected readonly showAllItems = signal(false);
  private readonly INITIAL_DISPLAY_COUNT = 5;

  protected readonly isExpanded = computed(() => {
    const explicitState = this.expandedState();
    if (explicitState !== null) {
      return explicitState;
    }
    return this.config().defaultExpanded ?? true;
  });

  readonly #financialEntriesViewModel = computed(() => {
    const financialEntries = this.financialEntries();
    const selectedIds = new Set(this.selectedFinancialEntries());

    return financialEntries.map(
      (financialEntry) =>
        ({
          ...financialEntry,
          isSelected: selectedIds.has(financialEntry.id),
          isRollover: financialEntry.rollover.sourceBudgetId ?? false,
        }) as FinancialEntryViewModel,
    );
  });

  protected readonly displayedFinancialEntries = computed(() => {
    const all = this.#financialEntriesViewModel();
    const expanded = this.isExpanded();
    const showAll = this.showAllItems();

    if (!expanded) {
      return { items: [], hasMore: false, remaining: 0 };
    }

    const total = all.length;
    const shouldShowAll = showAll || total <= this.INITIAL_DISPLAY_COUNT;

    return {
      items: shouldShowAll ? all : all.slice(0, this.INITIAL_DISPLAY_COUNT),
      hasMore: !shouldShowAll && total > this.INITIAL_DISPLAY_COUNT,
      remaining: Math.max(0, total - this.INITIAL_DISPLAY_COUNT),
    };
  });

  protected toggleExpanded(): void {
    const currentExpanded = this.isExpanded();
    this.expandedState.set(!currentExpanded);
    if (!this.isExpanded()) {
      this.showAllItems.set(false);
    }
  }

  protected showAllFinancialEntries(): void {
    this.showAllItems.set(true);
  }

  toggleSelection(financialEntryId: string, selected: boolean): void {
    const currentSelection = this.selectedFinancialEntries();
    if (selected) {
      this.selectedFinancialEntries.set([
        ...currentSelection,
        financialEntryId,
      ]);
    } else {
      this.selectedFinancialEntries.set(
        currentSelection.filter((id) => id !== financialEntryId),
      );
    }
  }
}
