import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplate } from '@pulpe/shared';
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
          Aucun modèle de budget
        </h2>
        <p
          class="text-body-large text-on-surface-variant max-w-md"
          data-testid="empty-state-subtitle"
        >
          Créez votre premier modèle de budget pour planifier vos mois
          facilement. Un modèle vous permet de réutiliser la même structure
          chaque mois.
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
            (delete)="onDeleteTemplate($event)"
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
  readonly templates = input.required<BudgetTemplate[]>();
  readonly deleteTemplate = output<BudgetTemplate>();

  onDeleteTemplate(template: BudgetTemplate): void {
    this.deleteTemplate.emit(template);
  }
}
