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
import { Title } from '@core/routing';

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
        <button
          matIconButton
          (click)="state.refreshData()"
          [disabled]="state.isLoading()"
          aria-label="Actualiser"
          data-testid="refresh-button"
        >
          <mat-icon>refresh</mat-icon>
        </button>
      </header>

      @switch (true) {
        @case (state.isLoading()) {
          <pulpe-base-loading
            message="Chargement des modèles de budget..."
            size="large"
            testId="templates-loading"
          />
        }
        @case (state.templatesData.status() === 'error') {
          <pulpe-templates-error
            (reload)="state.refreshData()"
            data-testid="templates-error"
          />
        }
        @case (
          state.templatesData.status() === 'resolved' ||
          state.templatesData.status() === 'local'
        ) {
          <pulpe-template-list
            [templates]="state.templatesData.value() ?? []"
            data-testid="templates-list"
          />
        }
      }
    </div>

    <!-- FAB Create Button -->
    @if (!state.isLoading()) {
      <button
        matFab
        color="primary"
        routerLink="create"
        [disabled]="!state.canCreateMore()"
        [matTooltip]="
          !state.canCreateMore()
            ? 'Limite de ' + state.MAX_TEMPLATES + ' modèles atteinte'
            : 'Créer un nouveau modèle'
        "
        class="fixed bottom-6 right-6 z-10"
        data-testid="create-template-fab"
      >
        <mat-icon>add</mat-icon>
      </button>
    }
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
  protected readonly title = inject(Title);

  ngOnInit() {
    this.state.refreshData();
  }
}
