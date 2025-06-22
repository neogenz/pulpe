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
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ template().name }}</mat-card-title>
        @if (template().isDefault) {
          <mat-chip-set>
            <mat-chip>Par défaut</mat-chip>
          </mat-chip-set>
        }
      </mat-card-header>
      <mat-card-content>
        @if (template().description) {
          <p class="text-body-medium mb-3">{{ template().description }}</p>
        }
        @if (template().category) {
          <p class="text-body-small text-on-surface-variant">
            Catégorie: {{ template().category }}
          </p>
        }
      </mat-card-content>
      <mat-card-actions align="end">
        <button
          mat-button
          color="primary"
        >
          <mat-icon>visibility</mat-icon>
          Utiliser
        </button>
        <button
          mat-icon-button
          color="warn"
          (click)="deleteTemplate.emit(template().id)"
          [disabled]="template().isDefault"
        >
          <mat-icon>delete</mat-icon>
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateCard {
  template = input.required<BudgetTemplate>();
  deleteTemplate = output<string>();
}
