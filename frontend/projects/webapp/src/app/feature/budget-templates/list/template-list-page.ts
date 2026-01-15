import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { type BudgetTemplate } from 'pulpe-shared';
import { BudgetTemplatesState } from '../services/budget-templates-state';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { TemplateList } from '../components/template-list';
import { BaseLoading } from '@ui/loading';
import { TemplatesError } from '../components/templates-error';
import { TitleDisplay } from '@core/routing';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';
import { getDeleteConfirmationConfig } from '../delete/template-delete-dialog';
import { Logger } from '@core/logging/logger';
import {
  ProductTourService,
  TOUR_START_DELAY,
} from '@core/product-tour/product-tour.service';

@Component({
  selector: 'pulpe-template-list-page',

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
          <h1
            class="text-headline-medium md:text-display-small"
            data-testid="page-title"
          >
            {{ title.currentTitle() }}
          </h1>
          @if (state.templateCount() > 0) {
            <p
              class="text-body-medium text-on-surface-variant mt-1"
              data-testid="template-counter"
              data-tour="template-counter"
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
            matIconButton
            (click)="startPageTour()"
            matTooltip="Découvrir cette page"
            aria-label="Aide"
            data-testid="help-button"
          >
            <mat-icon>help_outline</mat-icon>
          </button>
          <button
            matButton="filled"
            class="shrink-0"
            routerLink="create"
            [disabled]="state.isTemplateLimitReached()"
            [matTooltip]="
              state.isTemplateLimitReached()
                ? 'Limite de ' + state.MAX_TEMPLATES + ' modèles atteinte'
                : 'Créer un nouveau modèle'
            "
            data-testid="create-template-button"
            data-tour="create-template"
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
            message="Récupération de tes modèles..."
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
            data-tour="templates-list"
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
  readonly #productTourService = inject(ProductTourService);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #logger = inject(Logger);

  constructor() {
    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('templates-list')) {
        setTimeout(
          () => this.#productTourService.startPageTour('templates-list'),
          TOUR_START_DELAY,
        );
      }
    });
  }

  startPageTour(): void {
    this.#productTourService.startPageTour('templates-list');
  }

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
      this.#logger.error('Error checking template usage:', error);
      this.#snackBar.open(
        'La vérification a échoué — réessaie',
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

      this.#snackBar.open('Modèle supprimé', undefined, {
        duration: 3000,
      });
    } catch (error) {
      this.#logger.error('Error deleting template:', error);
      this.#snackBar.open(
        'La suppression a échoué — réessaie',
        'Fermer',
        {
          duration: 5000,
        },
      );
    }
  }
}
