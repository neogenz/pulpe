import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type BudgetTemplate } from 'pulpe-shared';
import { StateCard } from '@ui/state-card/state-card';
import { TemplateCard } from './template-card';

@Component({
  selector: 'pulpe-template-list',
  imports: [TemplateCard, StateCard],
  template: `
    @if (templates().length === 0) {
      <pulpe-state-card
        testId="empty-state"
        variant="empty"
        title="Tu n'as pas encore de modèle"
        message="Crée ton premier modèle pour réutiliser ta structure chaque mois."
      />
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
  readonly templates = input.required<BudgetTemplate[]>();
}
