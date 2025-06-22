import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { type BudgetTemplate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-template-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule],
  template: `
    <mat-card appearance="outlined">
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
        } @else if (template().category) {
          <mat-card-subtitle>{{ template().category }}</mat-card-subtitle>
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
        <button mat-button>
          <mat-icon>visibility</mat-icon>
          Utiliser
        </button>
        @if (!template().isDefault) {
          <button
            mat-icon-button
            color="warn"
            (click)="deleteTemplate.emit(template().id)"
          >
            <mat-icon>delete</mat-icon>
          </button>
        }
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateCard {
  template = input.required<BudgetTemplate>();
  deleteTemplate = output<string>();
}
