import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { type BudgetTemplate } from 'pulpe-shared';
import { TranslocoService } from '@jsverse/transloco';
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
        [title]="emptyTitle"
        [message]="emptyMessage"
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
  readonly #transloco = inject(TranslocoService);

  readonly templates = input.required<BudgetTemplate[]>();

  protected readonly emptyTitle = this.#transloco.translate(
    'template.emptyTitle',
  );
  protected readonly emptyMessage = this.#transloco.translate(
    'template.emptyMessage',
  );
}
