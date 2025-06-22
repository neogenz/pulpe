import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { type BudgetTemplate } from '@pulpe/shared';
import { TemplateCard } from './template-card';

@Component({
  selector: 'pulpe-template-list',
  imports: [TemplateCard],
  template: `
    @if (templates().length === 0) {
      <div class="text-center py-8">
        <p class="text-body-large text-on-surface-variant">
          Aucun modèle de budget trouvé.
        </p>
      </div>
    } @else {
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
