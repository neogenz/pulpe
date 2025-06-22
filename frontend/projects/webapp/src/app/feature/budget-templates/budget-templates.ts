import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesState } from './services/budget-templates-state';
import { TemplateList } from './components/template-list';
import { AddTemplateForm } from './components/add-template-form';
import { TemplatesLoading } from './components/templates-loading';
import { TemplatesError } from './components/templates-error';

@Component({
  selector: 'pulpe-budget-templates',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    TemplateList,
    AddTemplateForm,
    TemplatesLoading,
    TemplatesError,
  ],
  template: `
    <div class="flex flex-col gap-4 h-full">
      <header class="flex justify-between items-center">
        <h1 class="text-display-small">Modèles de budget</h1>
        <div class="flex gap-2">
          <button
            mat-button
            (click)="showAddForm.set(!showAddForm())"
            [disabled]="state.templatesData.isLoading()"
          >
            <mat-icon>{{ showAddForm() ? 'close' : 'add' }}</mat-icon>
            {{ showAddForm() ? 'Annuler' : 'Nouveau modèle' }}
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

      @if (showAddForm()) {
        <pulpe-add-template-form
          (addTemplate)="onAddTemplate($event)"
          (cancelForm)="showAddForm.set(false)"
          [isCreating]="isCreatingTemplate()"
        />
      }

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
  showAddForm = signal(false);
  isCreatingTemplate = signal(false);

  ngOnInit() {
    this.state.refreshData();
  }

  async onAddTemplate(template: BudgetTemplateCreate) {
    try {
      this.isCreatingTemplate.set(true);
      await this.state.addTemplate(template);
      this.showAddForm.set(false);
    } catch (error) {
      console.error('Erreur lors de la création du template:', error);
    } finally {
      this.isCreatingTemplate.set(false);
    }
  }

  async onDeleteTemplate(id: string) {
    try {
      await this.state.deleteTemplate(id);
    } catch (error) {
      console.error('Erreur lors de la suppression du template:', error);
    }
  }
}
