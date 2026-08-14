import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import type {
  SupportedCurrency,
  TransactionKind,
  TransactionRecurrence,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialKindIndicator } from '@ui/financial-kind-indicator';
import { RecurrenceLabelPipe } from '@ui/transaction-display';

@Component({
  selector: 'pulpe-financial-line-card',
  imports: [
    MatCardModule,
    MatChipsModule,
    AppCurrencyPipe,
    FinancialKindDirective,
    FinancialKindIndicator,
    RecurrenceLabelPipe,
  ],
  template: `
    <mat-card
      appearance="outlined"
      class="!rounded-corner-large"
      [attr.data-testid]="dataTestId()"
    >
      <mat-card-content class="p-4">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <pulpe-financial-kind-indicator [kind]="kind()" />
            <ng-content select="[name]">
              <span
                class="text-title-medium font-medium truncate ph-no-capture"
                [class.line-through]="isStriked()"
                [class.text-on-surface-variant]="isStriked()"
              >
                {{ name() }}
              </span>
            </ng-content>
            <ng-content select="[indicators]" />
          </div>
          <ng-content select="[menu]" />
        </div>

        <div class="flex items-end justify-between mb-3">
          <div>
            <ng-content select="[amount]">
              <div
                class="ph-no-capture text-headline-medium font-bold"
                [pulpeFinancialKind]="kind()"
              >
                {{ amount() | appCurrency: currency() : '1.2-2' }}
              </div>
            </ng-content>
          </div>
          <ng-content select="[meta]" />
        </div>

        <ng-content select="[footer]" />

        @if (recurrence(); as rec) {
          <div
            class="financial-card-footer pt-2.5 border-t border-outline-variant/30"
          >
            <div class="flex items-center gap-1.5 min-w-0">
              <mat-chip
                class="!h-6 !text-label-small bg-surface-container shrink-0"
              >
                {{ rec | recurrenceLabel }}
              </mat-chip>
              <ng-content select="[recurrenceMeta]" />
            </div>
            <div class="financial-card-actions flex items-center gap-2">
              <ng-content select="[actions]" />
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

    .financial-card-footer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
    }

    @media (max-width: 420px) {
      .financial-card-footer {
        grid-template-columns: minmax(0, 1fr);
      }

      .financial-card-actions {
        justify-self: end;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancialLineCard {
  readonly kind = input.required<TransactionKind>();
  readonly name = input.required<string>();
  readonly amount = input.required<number>();
  readonly currency = input<SupportedCurrency>('CHF');
  readonly recurrence = input<TransactionRecurrence | undefined>(undefined);
  readonly isStriked = input<boolean>(false);
  readonly dataTestId = input<string | undefined>(undefined);
}
