import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'pulpe-month-card-item',
  imports: [MatCardModule, MatIconModule],
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
        <mat-card-title>{{ month() }}</mat-card-title>
        @if (parentTemplate()) {
          <mat-card-subtitle
            >Créer depuis le template
            {{ parentTemplate()?.name }}</mat-card-subtitle
          >
        }
      </mat-card-header>
      <mat-card-content>
        <p>
          {{ totalAmount() }}
        </p>
      </mat-card-content>
      <mat-card-actions>
        <button matButton>Voir</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthCardItem {
  month = input.required<number>();
  parentTemplate = input<{
    id: string;
    name: string;
  }>();
  totalAmount = input.required<number>();
  id = input.required<string>();
}
