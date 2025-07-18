import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'pulpe-month-card-item',
  imports: [MatCardModule, MatIconModule, MatButtonModule, CurrencyPipe],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <div mat-card-avatar>
          <div
            class="flex justify-center items-center size-11 bg-secondary-container rounded-full"
          >
            <mat-icon>calendar_month</mat-icon>
          </div>
        </div>
        <mat-card-title class="capitalize">{{ displayName() }}</mat-card-title>
        @if (parentTemplate()) {
          <mat-card-subtitle
            >Créer depuis le template
            {{ parentTemplate()?.name }}</mat-card-subtitle
          >
        }
      </mat-card-header>
      <mat-card-content>
        <div class="flex justify-center gap-2 items-center">
          <p
            class="text-headline-small financial-amount overflow-hidden text-ellipsis"
            [attr.data-type]="totalAmount() >= 0 ? 'positive' : 'negative'"
          >
            {{ totalAmount() | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH' }}
          </p>
        </div>
      </mat-card-content>
      <mat-card-actions align="end">
        <button matButton>
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
}
