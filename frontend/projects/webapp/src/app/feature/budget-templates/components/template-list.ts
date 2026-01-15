import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplate } from 'pulpe-shared';
import { TemplateCard } from './template-card';

@Component({
  selector: 'pulpe-template-list',
  imports: [TemplateCard, MatIconModule],
  template: `
    @if (templates().length === 0) {
      <div
        class="flex flex-col items-center justify-center p-12 text-center bg-surface-container-highest rounded-xl"
        data-testid="empty-state"
      >
        <mat-icon class="text-6xl mb-4 text-primary">library_books</mat-icon>
        <h2 class="text-headline-medium mb-2" data-testid="empty-state-title">
          Tu n'as pas encore de modèle
        </h2>
        <p
          class="text-body-large text-on-surface-variant max-w-md"
          data-testid="empty-state-subtitle"
        >
          Crée ton premier modèle pour gagner du temps chaque mois. Un modèle te
          permet de réutiliser la même structure en un clic.
        </p>
      </div>
    } @else {
      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="templates-grid"
      >
        @for (template of templates(); track template.id) {
          <pulpe-template-card
            [template]="template"
            (delete)="deleteTemplate.emit($event)"
            data-testid="template-card"
          />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateList {
  templates = input.required<BudgetTemplate[]>();
  readonly deleteTemplate = output<BudgetTemplate>();
}
