import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BudgetTemplatesState } from '../services/budget-templates-state';
import { TemplateList } from '../components/template-list';
import { BaseLoadingComponent } from '../../../ui/loading';
import { TemplatesError } from '../components/templates-error';
import { TitleDisplay } from '@core/routing';

@Component({
  selector: 'pulpe-template-list-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TemplateList,
    BaseLoadingComponent,
    TemplatesError,
  ],
  template: `
    <div class="flex flex-col gap-4 h-full" data-testid="budget-templates-page">
      <header
        class="flex justify-between items-center"
        data-testid="page-header"
      >
        <div>
          <h1 class="text-display-small" data-testid="page-title">
            {{ title.currentTitle() }}
          </h1>
          @if (state.templateCount() > 0) {
            <p
              class="text-body-medium text-on-surface-variant mt-1"
              data-testid="template-counter"
            >
              {{ state.templateCount() }} modèle{{
                state.templateCount() > 1 ? 's' : ''
              }}
              sur {{ state.MAX_TEMPLATES }} maximum
            </p>
          }
        </div>
        <div class="flex gap-2 items-center">
          <button
            matButton="filled"
            routerLink="create"
            [disabled]="state.isTemplateLimitReached()"
            [matTooltip]="
              state.isTemplateLimitReached()
                ? 'Limite de ' + state.MAX_TEMPLATES + ' modèles atteinte'
                : 'Créer un nouveau modèle'
            "
            data-testid="create-template-button"
          >
            <mat-icon class="md:inline hidden">add_circle</mat-icon>
            <span class="md:hidden">Ajouter</span>
            <span class="hidden md:inline">Ajouter un modèle</span>
          </button>
          <button
            matIconButton
            (click)="state.refreshData()"
            [disabled]="state.budgetTemplates.isLoading()"
            aria-label="Actualiser"
            data-testid="refresh-button"
          >
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </header>

      @switch (true) {
        @case (state.budgetTemplates.isLoading()) {
          <pulpe-base-loading
            message="Chargement des modèles de budget..."
            size="large"
            testId="templates-loading"
          />
        }
        @case (state.budgetTemplates.status() === 'error') {
          <pulpe-templates-error
            (reload)="state.refreshData()"
            data-testid="templates-error"
          />
        }
        @case (
          state.budgetTemplates.status() === 'resolved' ||
          state.budgetTemplates.status() === 'local'
        ) {
          <pulpe-template-list
            [templates]="state.budgetTemplates.value() ?? []"
            data-testid="templates-list"
          />
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      position: relative;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TemplateListPage implements OnInit {
  protected readonly state = inject(BudgetTemplatesState);
  protected readonly title = inject(TitleDisplay);

  ngOnInit() {
    this.state.refreshData();
  }
}
