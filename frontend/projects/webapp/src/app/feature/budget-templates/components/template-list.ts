import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplateCard } from './template-card';

@Component({
  selector: 'pulpe-template-list',
  imports: [TemplateCard, MatIconModule],
  template: `
    @if (templates().length === 0) {
      <div class="text-center py-8 text-gray-500" data-testid="empty-state">
        <mat-icon class="text-6xl mb-4">description</mat-icon>
        <p data-testid="empty-state-title">Aucun modèle de budget trouvé</p>
        <p class="text-sm" data-testid="empty-state-subtitle">
          Créez votre premier template de budget
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
}
