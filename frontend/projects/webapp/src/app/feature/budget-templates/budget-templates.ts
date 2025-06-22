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
import { TemplatesLoading } from './components/templates-loading';
import { TemplatesError } from './components/templates-error';

@Component({
  selector: 'pulpe-budget-templates',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TemplateList,
    TemplatesLoading,
    TemplatesError,
  ],
  template: `
    <div class="flex flex-col gap-4 h-full">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Modèles de budget</h1>
        <div class="flex gap-2">
          <button
            mat-button="raised"
            color="primary"
            routerLink="add"
            [disabled]="state.templatesData.isLoading()"
          >
            <mat-icon>add</mat-icon>
            Nouveau modèle
          </button>
          <button
            mat-button
            (click)="state.refreshData()"
            [disabled]="state.templatesData.isLoading()"
          >
            <mat-icon>refresh</mat-icon>
            Actualiser
          </button>
        </div>
      </header>

      @switch (true) {
        @case (
          state.templatesData.status() === 'loading' ||
          state.templatesData.status() === 'reloading'
        ) {
          <pulpe-templates-loading />
        }
        @case (state.templatesData.status() === 'error') {
          <pulpe-templates-error (reload)="state.refreshData()" />
        }
        @case (
          state.templatesData.status() === 'resolved' ||
          state.templatesData.status() === 'local'
        ) {
          <pulpe-template-list
            [templates]="state.templatesData.value() ?? []"
            (deleteTemplate)="onDeleteTemplate($event)"
          />
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      padding: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class BudgetTemplates implements OnInit {
  state = inject(BudgetTemplatesState);

  ngOnInit() {
    this.state.refreshData();
  }

  async onDeleteTemplate(templateId: string) {
    try {
      await this.state.deleteTemplate(templateId);
    } catch (error) {
      console.error('Erreur lors de la suppression du template:', error);
    }
  }
}
