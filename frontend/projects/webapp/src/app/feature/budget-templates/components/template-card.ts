import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { type BudgetTemplate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-template-card',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
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
        <div class="flex-1"></div>
        <button
          matIconButton
          [matMenuTriggerFor]="menu"
          aria-label="Options du modèle"
          data-testid="template-menu-trigger"
          (click)="$event.stopPropagation()"
        >
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item [routerLink]="template().id">
            <mat-icon>visibility</mat-icon>
            <span>Voir les détails</span>
          </button>
          <button
            mat-menu-item
            (click)="delete.emit(template())"
            class="text-error"
            data-testid="delete-template-menu-item"
          >
            <mat-icon class="text-error">delete</mat-icon>
            <span>Supprimer</span>
          </button>
        </mat-menu>
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
        )
      );
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateCard {
  readonly template = input.required<BudgetTemplate>();
  readonly delete = output<BudgetTemplate>();
}
