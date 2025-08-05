import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesState } from '../services/budget-templates-state';
import { CreateTemplateForm } from './components/create-template-form';

@Component({
  selector: 'pulpe-create-template-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    CreateTemplateForm,
  ],
  template: `
    <div class="flex flex-col gap-4 h-full" data-testid="create-template-page">
      <header class="flex items-center gap-4" data-testid="page-header">
        <button
          matIconButton
          (click)="navigateBack()"
          aria-label="Retour"
          data-testid="back-button"
        >
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1 class="text-display-small" data-testid="page-title">
          Nouveau modèle de budget
        </h1>
      </header>

      <div class="flex-1 overflow-auto">
        <pulpe-create-template-form
          (addTemplate)="onAddTemplate($event)"
          (cancelForm)="navigateBack()"
          [isCreating]="isCreatingTemplate()"
          data-testid="add-template-form"
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
export default class CreateTemplatePage {
  #router = inject(Router);
  #state = inject(BudgetTemplatesState);
  #snackBar = inject(MatSnackBar);

  isCreatingTemplate = signal(false);

  async onAddTemplate(template: BudgetTemplateCreate) {
    try {
      this.isCreatingTemplate.set(true);
      const createdTemplate = await this.#state.addTemplate(template);

      // Show success message
      this.#snackBar.open('Modèle créé avec succès', 'Fermer', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });

      // Navigate to the details page of the newly created template
      if (createdTemplate && createdTemplate.id) {
        this.#router.navigate([
          '/app/budget-templates/details',
          createdTemplate.id,
        ]);
      } else {
        this.navigateBack();
      }
    } catch (error) {
      console.error('Erreur lors de la création du template:', error);

      // Show error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Erreur lors de la création du modèle';
      this.#snackBar.open(errorMessage, 'Fermer', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.isCreatingTemplate.set(false);
    }
  }

  navigateBack() {
    this.#router.navigate(['/app/budget-templates']);
  }
}
