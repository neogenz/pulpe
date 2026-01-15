import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'pulpe-month-card-item',
  imports: [MatCardModule, MatIconModule, MatButtonModule, CurrencyPipe],
  template: `
    <mat-card appearance="outlined" [attr.data-testid]="'month-card-' + id()">
      <mat-card-header>
        <div mat-card-avatar>
          <div
            class="flex justify-center items-center size-11 bg-secondary-container rounded-full"
          >
            <mat-icon>calendar_month</mat-icon>
          </div>
        </div>
        <mat-card-title class="capitalize" data-testid="month-card-title">{{
          displayName()
        }}</mat-card-title>
        @if (parentTemplate()) {
          <mat-card-subtitle
            >Créer depuis le template
            <span class="ph-no-capture">{{
              parentTemplate()?.name
            }}</span></mat-card-subtitle
          >
        }
      </mat-card-header>
      <mat-card-content>
        <div class="flex justify-center gap-2 items-center">
          <p
            class="ph-no-capture text-headline-small financial-amount overflow-hidden text-ellipsis font-mono"
            [attr.data-type]="totalAmount() >= 0 ? 'positive' : 'negative'"
            data-testid="month-card-amount"
          >
            {{ totalAmount() | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH' }}
          </p>
        </div>
      </mat-card-content>
      <mat-card-actions align="end">
        <button
          matButton
          (click)="detailsClick.emit(id())"
          data-testid="month-card-details-button"
        >
          <mat-icon>visibility</mat-icon>
          Détails
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    @use '@angular/material' as mat;

    :host {
      display: block;

      @include mat.card-overrides(
        (
          title-text-size: var(--mat-sys-title-medium-size),
        )
      );
    }

    .financial-amount[data-type='positive'] {
      color: var(--pulpe-financial-savings);
    }

    .financial-amount[data-type='negative'] {
      color: var(--pulpe-financial-negative);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthCardItem {
  displayName = input.required<string>();
  parentTemplate = input<{
    id: string;
    name: string;
  }>();
  totalAmount = input.required<number>();
  id = input.required<string>();
  detailsClick = output<string>();
}
