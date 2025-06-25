import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesState } from './services/budget-templates-state';
import { AddTemplateForm } from './components/add-template-form';

@Component({
  selector: 'pulpe-add-template',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, AddTemplateForm],
  template: `
    <div class="flex flex-col gap-4 h-full">
      <header class="flex items-center gap-4">
        <button mat-icon-button (click)="navigateBack()" aria-label="Retour">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="text-display-small">Nouveau modèle de budget</h1>
      </header>

      <div class="flex-1 overflow-auto">
        <pulpe-add-template-form
          (addTemplate)="onAddTemplate($event)"
          (cancelForm)="navigateBack()"
          [isCreating]="isCreatingTemplate()"
        />
      </div>
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
export default class AddTemplate {
  #router = inject(Router);
  #state = inject(BudgetTemplatesState);

  isCreatingTemplate = signal(false);

  async onAddTemplate(template: BudgetTemplateCreate) {
    try {
      this.isCreatingTemplate.set(true);
      await this.#state.addTemplate(template);
      this.navigateBack();
    } catch (error) {
      console.error('Erreur lors de la création du template:', error);
    } finally {
      this.isCreatingTemplate.set(false);
    }
  }

  navigateBack() {
    this.#router.navigate(['/budget-templates']);
  }
}
