import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplate } from 'pulpe-shared';

@Component({
  selector: 'pulpe-template-card',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card
      appearance="outlined"
      [attr.data-testid]="'template-' + template().name"
    >
      <mat-card-header>
        <div mat-card-avatar>
          <div
            class="flex justify-center items-center size-11 bg-secondary-container rounded-full"
          >
            <mat-icon>description</mat-icon>
          </div>
        </div>
        <mat-card-title>{{ template().name }}</mat-card-title>
        @if (template().isDefault) {
          <mat-card-subtitle>Template par défaut</mat-card-subtitle>
        } @else {
          <mat-card-subtitle>Template</mat-card-subtitle>
        }
      </mat-card-header>
      <mat-card-content>
        @if (template().description) {
          <p class="text-body-medium text-on-surface-variant">
            {{ template().description }}
          </p>
        }
      </mat-card-content>
      <mat-card-actions align="end">
        <button
          matButton
          [routerLink]="['details', template().id]"
          data-testid="view-details-button"
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
          title-text-weight: var(--mat-sys-title-medium-weight, 500),
          subtitle-text-size: var(--mat-sys-body-small-size),
          subtitle-text-color: var(--mat-sys-on-surface-variant),
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateCard {
  readonly template = input.required<BudgetTemplate>();
}
