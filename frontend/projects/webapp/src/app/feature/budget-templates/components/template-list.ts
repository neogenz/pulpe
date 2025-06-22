import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplateCard } from './template-card';

@Component({
  selector: 'pulpe-template-list',
  imports: [TemplateCard, MatIconModule],
  template: `
    @if (templates().length === 0) {
      <div class="text-center py-8 text-gray-500">
        <mat-icon class="text-6xl mb-4">description</mat-icon>
        <p>Aucun modèle de budget trouvé</p>
        <p class="text-sm">Créez votre premier template de budget</p>
      </div>
    } @else {
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (template of templates(); track template.id) {
          <pulpe-template-card
            [template]="template"
            (deleteTemplate)="deleteTemplate.emit($event)"
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TemplateList {
  templates = input.required<BudgetTemplate[]>();
  deleteTemplate = output<string>();
}
