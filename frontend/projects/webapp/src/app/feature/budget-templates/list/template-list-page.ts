import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { type BudgetTemplate } from '@pulpe/shared';
import { BudgetTemplatesState } from '../services/budget-templates-state';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { TemplateList } from '../components/template-list';
import { BaseLoading } from '@ui/loading';
import { TemplatesError } from '../components/templates-error';
import { TitleDisplay } from '@core/routing';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';
import { getDeleteConfirmationConfig } from '../delete/template-delete-dialog';

@Component({
  selector: 'pulpe-template-list-page',
  standalone: true,
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TemplateList,
    BaseLoading,
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
            [error]="state.budgetTemplates.error()"
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
            (deleteTemplate)="onDeleteTemplate($event)"
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
export default class TemplateListPage {
  protected readonly state = inject(BudgetTemplatesState);
  protected readonly title = inject(TitleDisplay);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  async onDeleteTemplate(template: BudgetTemplate) {
    try {
      // First check if template is being used
      const usageResponse = await firstValueFrom(
        this.#budgetTemplatesApi.checkUsage$(template.id),
      );

      if (usageResponse.data.isUsed) {
        // Show dialog with list of budgets using this template
        const dialogRef = this.#dialog.open(TemplateUsageDialogComponent, {
          data: {
            templateId: template.id,
            templateName: template.name,
          },
          width: '90vw',
          maxWidth: '600px',
          disableClose: false,
        });

        // Set the usage data after opening the dialog
        const dialogInstance = dialogRef.componentInstance;
        dialogInstance.setUsageData(usageResponse.data.budgets);
      } else {
        // Template is not used, show confirmation dialog
        const dialogRef = this.#dialog.open(ConfirmationDialog, {
          data: getDeleteConfirmationConfig(template.name),
          width: '400px',
        });

        const confirmed = await firstValueFrom(dialogRef.afterClosed());
        if (confirmed) {
          await this.#performDeletion(template);
        }
      }
    } catch (error) {
      console.error('Error checking template usage:', error);
      this.#snackBar.open(
        'Une erreur est survenue lors de la vérification',
        'Fermer',
        {
          duration: 5000,
        },
      );
    }
  }

  async #performDeletion(template: BudgetTemplate) {
    try {
      await this.state.deleteTemplate(template.id);

      this.#snackBar.open('Modèle supprimé avec succès', undefined, {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      this.#snackBar.open(
        'Une erreur est survenue lors de la suppression',
        'Fermer',
        {
          duration: 5000,
        },
      );
    }
  }
}
