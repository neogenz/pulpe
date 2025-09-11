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

// Constants
const ROUTES = {
  BUDGET_TEMPLATES: '/app/budget-templates',
  TEMPLATE_DETAILS: (id: string) => `/app/budget-templates/details/${id}`,
} as const;

const MESSAGES = {
  SUCCESS: 'Modèle créé avec succès',
  NETWORK_ERROR: 'Problème de connexion. Vérifiez votre connexion internet.',
  VALIDATION_ERROR: 'Données invalides. Vérifiez les informations saisies.',
  GENERIC_ERROR: 'Erreur lors de la création du modèle',
} as const;

const SNACKBAR_CONFIG = {
  SUCCESS: {
    duration: 3000,
    horizontalPosition: 'center' as const,
    verticalPosition: 'bottom' as const,
  },
  ERROR: {
    duration: 5000,
    horizontalPosition: 'center' as const,
    verticalPosition: 'bottom' as const,
    panelClass: ['error-snackbar'] as string[],
  },
};

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
        <h1
          class="text-headline-medium md:text-display-small"
          data-testid="page-title"
        >
          Nouveau modèle de budget
        </h1>
      </header>

      <div class="flex-1 overflow-auto">
        <pulpe-create-template-form
          (addTemplate)="onAddTemplate($event)"
          (cancelForm)="navigateBack()"
          (formReset)="onFormReset()"
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
  // Injected dependencies
  #router = inject(Router);
  #state = inject(BudgetTemplatesState);
  #snackBar = inject(MatSnackBar);

  // Properties
  isCreatingTemplate = signal(false);

  async onAddTemplate(template: BudgetTemplateCreate) {
    try {
      this.isCreatingTemplate.set(true);
      const createdTemplate = await this.#state.addTemplate(template);

      // Show success message
      this.#snackBar.open(MESSAGES.SUCCESS, 'Fermer', SNACKBAR_CONFIG.SUCCESS);

      // Form will reset itself and emit formReset event

      // Navigate to the details page of the newly created template
      if (createdTemplate && createdTemplate.id) {
        this.#router.navigate([ROUTES.TEMPLATE_DETAILS(createdTemplate.id)]);
      } else {
        this.navigateBack();
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isCreatingTemplate.set(false);
    }
  }

  onFormReset() {
    // Handle form reset completion if needed
    // Currently no additional action required
  }

  navigateBack() {
    this.#router.navigate([ROUTES.BUDGET_TEMPLATES]);
  }

  private handleError(error: unknown): void {
    // Simple logging - in a real app, this would use a proper logging service
    console.error('Erreur lors de la création du template:', error);

    const errorMessage = this.getErrorMessage(error);
    this.#snackBar.open(errorMessage, 'Fermer', SNACKBAR_CONFIG.ERROR);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for specific error types that we can handle better
      if (
        error.message.includes('network') ||
        error.message.includes('fetch')
      ) {
        return MESSAGES.NETWORK_ERROR;
      }
      if (error.message.includes('validation')) {
        return MESSAGES.VALIDATION_ERROR;
      }
      return error.message;
    }

    return MESSAGES.GENERIC_ERROR;
  }
}
