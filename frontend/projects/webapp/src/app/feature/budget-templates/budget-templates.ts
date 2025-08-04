import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BudgetTemplatesState } from './services/budget-templates-state';
import { TemplateList } from './components/template-list';
import { BaseLoadingComponent } from '../../ui/loading';
import { TemplatesError } from './components/templates-error';
import { TitleDisplay } from '@core/routing';

@Component({
  selector: 'pulpe-budget-templates',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
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
        <h1 class="text-display-small" data-testid="page-title">
          {{ titleDisplay.currentTitle() }}
        </h1>
        <div class="flex gap-2">
          <button
            matButton="filled"
            color="primary"
            routerLink="add"
            [disabled]="state.isLoading()"
            data-testid="create-template-button"
          >
            <mat-icon>add</mat-icon>
            Nouveau modèle
          </button>
          <button
            matButton
            (click)="state.refreshData()"
            [disabled]="state.isLoading()"
            data-testid="refresh-button"
          >
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
        </div>
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
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BudgetTemplates implements OnInit {
  protected readonly state = inject(BudgetTemplatesState);
  protected readonly titleDisplay = inject(TitleDisplay);

  ngOnInit() {
    this.state.refreshData();
  }
}
