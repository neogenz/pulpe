import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { Logger } from '@core/logging/logger';

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
          [isCreating]="isCreatingTemplate()"
          [templateCount]="templateCount()"
          [existingTemplateNames]="existingTemplateNames()"
          [defaultTemplateName]="defaultTemplateName()"
          (addTemplate)="onAddTemplate($event)"
          (cancelForm)="navigateBack()"
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
  #logger = inject(Logger);

  // Local state
  isCreatingTemplate = signal(false);

  // Computed values to pass to child form (smart/dumb pattern)
  // These are computed ONCE from state and passed as stable inputs
  templateCount = computed(() => this.#state.templateCount());
  existingTemplateNames = computed(
    () =>
      this.#state.budgetTemplates
        .value()
        ?.filter((t) => !t.id.startsWith('temp-'))
        .map((t) => t.name.toLowerCase()) ?? [],
  );
  defaultTemplateName = computed(
    () => this.#state.defaultBudgetTemplate()?.name ?? null,
  );

  async onAddTemplate(template: BudgetTemplateCreate) {
    this.isCreatingTemplate.set(true);

    try {
      const response = await this.#state.addTemplate(template);

      // Show success message
      this.#snackBar.open(MESSAGES.SUCCESS, 'Fermer', SNACKBAR_CONFIG.SUCCESS);

      // Navigate to the details page of the newly created template
      // Note: We keep isCreating=true during navigation to prevent UI flicker.
      // The component will be destroyed when navigation completes.
      if (response?.template.id) {
        // Pass POST response as router state for SWR (instant display)
        await this.#router.navigate(
          [ROUTES.TEMPLATE_DETAILS(response.template.id)],
          {
            state: {
              initialData: {
                template: response.template,
                transactions: response.lines,
              },
            },
          },
        );
      } else {
        await this.#router.navigate([ROUTES.BUDGET_TEMPLATES]);
      }
    } catch (error) {
      // Only reset isCreating on error (user stays on page to retry)
      this.isCreatingTemplate.set(false);
      this.handleError(error);
    }
  }

  navigateBack() {
    this.#router.navigate([ROUTES.BUDGET_TEMPLATES]);
  }

  private handleError(error: unknown): void {
    // Simple logging - in a real app, this would use a proper logging service
    this.#logger.error('Erreur lors de la création du template:', error);

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
