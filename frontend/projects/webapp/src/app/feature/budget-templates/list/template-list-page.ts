import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
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
import { BudgetTemplatesStore } from '../services/budget-templates-store';
import { BudgetTemplatesApi } from '../services/budget-templates-api';
import { TemplateList } from '../components/template-list';
import { BaseLoading } from '@ui/loading';
import { TemplatesError } from '../components/templates-error';
import { TitleDisplay } from '@core/routing';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';
import { getDeleteConfirmationConfig } from '../delete/template-delete-dialog';
import { LoadingIndicator } from '@core/loading/loading-indicator';
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
    <div
      class="flex flex-col gap-4 h-full min-w-0"
      data-testid="budget-templates-page"
    >
      <header
        class="flex flex-wrap justify-between items-center gap-2"
        data-testid="page-header"
      >
        <div class="min-w-0">
          <h1
            class="text-headline-medium md:text-display-small truncate min-w-0 flex-shrink"
            data-testid="page-title"
          >
            {{ title.currentTitle() }}
          </h1>
          @if (store.templateCount() > 0) {
            <p
              class="text-body-medium text-on-surface-variant mt-1"
              data-testid="template-counter"
              data-tour="template-counter"
            >
              {{ store.templateCount() }} modèle{{
                store.templateCount() > 1 ? 's' : ''
              }}
              sur {{ store.MAX_TEMPLATES }} maximum
            </p>
          }
        </div>
        <div class="flex gap-2 items-center flex-shrink-0 ml-auto">
          <button
            matButton="filled"
            class="shrink-0"
            routerLink="create"
            [disabled]="store.isTemplateLimitReached()"
            [matTooltip]="
              store.isTemplateLimitReached()
                ? 'Limite de ' + store.MAX_TEMPLATES + ' modèles atteinte'
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
            (click)="store.refreshData()"
            [disabled]="store.budgetTemplates.isLoading()"
            aria-label="Actualiser"
            data-testid="refresh-button"
          >
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </header>

      @switch (true) {
        @case (store.budgetTemplates.status() === 'loading') {
          <pulpe-base-loading
            message="Récupération de tes modèles..."
            size="large"
            testId="templates-loading"
          />
        }
        @case (store.budgetTemplates.status() === 'error') {
          <pulpe-templates-error
            [error]="store.budgetTemplates.error()"
            (reload)="store.refreshData()"
            data-testid="templates-error"
          />
        }
        @case (
          store.budgetTemplates.status() === 'resolved' ||
          store.budgetTemplates.status() === 'local' ||
          store.budgetTemplates.status() === 'reloading'
        ) {
          <pulpe-template-list
            [templates]="store.budgetTemplates.value() ?? []"
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
  protected readonly store = inject(BudgetTemplatesStore);
  protected readonly title = inject(TitleDisplay);
  readonly #productTourService = inject(ProductTourService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #loadingIndicator = inject(LoadingIndicator);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #logger = inject(Logger);

  constructor() {
    this.store.refreshData();

    effect(() => {
      const status = this.store.budgetTemplates.status();
      this.#loadingIndicator.setLoading(status === 'reloading');
    });

    this.#destroyRef.onDestroy(() => {
      this.#loadingIndicator.setLoading(false);
    });

    afterNextRender(() => {
      if (!this.#productTourService.hasSeenPageTour('templates-list')) {
        setTimeout(
          () => this.#productTourService.startPageTour('templates-list'),
          TOUR_START_DELAY,
        );
      }
    });
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
      this.#snackBar.open('La vérification a échoué — réessaie', 'Fermer', {
        duration: 5000,
      });
    }
  }

  async #performDeletion(template: BudgetTemplate) {
    try {
      await this.store.deleteTemplate(template.id);

      this.#snackBar.open('Modèle supprimé', undefined, {
        duration: 3000,
      });
    } catch (error) {
      this.#logger.error('Error deleting template:', error);
      this.#snackBar.open('La suppression a échoué — réessaie', 'Fermer', {
        duration: 5000,
      });
    }
  }
}
