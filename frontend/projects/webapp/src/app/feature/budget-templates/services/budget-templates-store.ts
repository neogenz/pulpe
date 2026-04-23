import { Injectable, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
  type TemplateUsageResponse,
} from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { cachedResource, cachedMutation } from 'ngx-ziflux';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import { Logger } from '@core/logging/logger';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { type TemplateSummary } from '../components/template-card';
import { TemplateUsageDialogComponent } from '../components/dialogs/template-usage-dialog';

export type DeleteTemplateOutcome =
  | 'deleted'
  | 'cancelled'
  | 'cancelled-due-to-usage'
  | 'error';

@Injectable()
export class BudgetTemplatesStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #logger = inject(Logger);

  readonly MAX_TEMPLATES = 5;

  readonly budgetTemplates = cachedResource({
    cache: this.#budgetTemplatesApi.cache,
    cacheKey: ['templates', 'list'],
    loader: () =>
      this.#budgetTemplatesApi
        .getAll$()
        .pipe(
          map((response) =>
            Array.isArray(response.data) ? response.data : [],
          ),
        ),
  });
  readonly #selectedTemplateId = signal<string | null>(null);
  readonly selectedTemplate = computed(() => {
    const id = this.#selectedTemplateId();
    if (!id) return null;
    return this.budgetTemplates.value()?.find((t) => t.id === id) ?? null;
  });

  readonly #templates = computed(() => this.budgetTemplates.value() ?? []);

  readonly templateCount = computed(() => this.#templates().length);

  readonly isTemplateLimitReached = computed(
    () => this.templateCount() >= this.MAX_TEMPLATES,
  );
  readonly remainingTemplates = computed(
    () => this.MAX_TEMPLATES - this.templateCount(),
  );
  readonly defaultBudgetTemplate = computed(
    () => this.#templates().find((t) => t.isDefault) ?? null,
  );

  readonly templateSummaries = computed<Record<string, TemplateSummary>>(
    () => ({}),
  );

  readonly #deleteTemplateMutation = cachedMutation<
    string,
    void,
    BudgetTemplate[]
  >({
    cache: this.#budgetTemplatesApi.cache,
    invalidateKeys: (id) => [
      ['templates', 'list'],
      ['templates', 'details', id],
    ],
    mutationFn: (id) =>
      this.#budgetTemplatesApi.delete$(id).pipe(map(() => void 0 as void)),
    onMutate: (id) => {
      const previous = this.budgetTemplates.value() ?? [];
      this.budgetTemplates.update((data) =>
        (data ?? []).filter((t) => t.id !== id),
      );
      return previous;
    },
    onError: (_err, _id, previous) => {
      if (previous) this.budgetTemplates.set(previous);
    },
  });

  readonly deleteTemplateError = computed(() =>
    this.#deleteTemplateMutation.error(),
  );

  readonly #createTemplateMutation = cachedMutation<
    BudgetTemplateCreate,
    BudgetTemplateCreateResponse,
    void
  >({
    cache: this.#budgetTemplatesApi.cache,
    mutationFn: (template) => this.#budgetTemplatesApi.create$(template),
    invalidateKeys: () => [['templates']],
    onSuccess: (response) => {
      if (response.data.template) {
        this.budgetTemplates.update((data) => [
          ...(data ?? []),
          response.data.template!,
        ]);
        this.#budgetTemplatesApi.cache.set(
          ['templates', 'details', response.data.template.id],
          {
            template: response.data.template,
            transactions: response.data.lines ?? [],
          },
        );
      }
    },
  });

  refreshData(): void {
    this.budgetTemplates.reload();
  }

  selectTemplate(id: string): void {
    this.#selectedTemplateId.set(id);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.#deleteTemplateMutation.mutate(id);
  }

  async checkUsage(templateId: string): Promise<TemplateUsageResponse['data']> {
    const response = await firstValueFrom(
      this.#budgetTemplatesApi.checkUsage$(templateId),
    );
    return response.data;
  }

  async confirmAndDeleteTemplate(
    templateId: string,
    templateName: string,
  ): Promise<DeleteTemplateOutcome> {
    try {
      const usageData = await this.checkUsage(templateId);

      if (usageData.isUsed) {
        const dialogRef = this.#dialog.open(TemplateUsageDialogComponent, {
          data: { templateId, templateName },
          width: '90vw',
          maxWidth: '600px',
          disableClose: false,
        });
        dialogRef.componentInstance.setUsageData(usageData.budgets);
        await firstValueFrom(dialogRef.afterClosed());
        return 'cancelled-due-to-usage';
      }

      const confirmRef = this.#dialog.open(ConfirmationDialog, {
        data: {
          title: this.#transloco.translate('template.deleteTitle'),
          message: this.#transloco.translate('template.deleteConfirm', {
            name: templateName,
          }),
          confirmText: this.#transloco.translate('common.delete'),
          cancelText: this.#transloco.translate('common.cancel'),
          confirmColor: 'warn' as const,
        },
        width: '400px',
      });

      const confirmed = await firstValueFrom(confirmRef.afterClosed());
      if (!confirmed) {
        return 'cancelled';
      }

      await this.deleteTemplate(templateId);

      if (this.deleteTemplateError()) {
        this.#logger.error(
          'Error deleting template:',
          this.deleteTemplateError(),
        );
        this.#snackBar.open(
          this.#transloco.translate('template.deleteCheckError'),
          this.#transloco.translate('common.close'),
          { duration: 5000 },
        );
        return 'error';
      }

      this.#snackBar.open(
        this.#transloco.translate('template.deleted'),
        undefined,
        { duration: 3000 },
      );
      return 'deleted';
    } catch (error) {
      this.#logger.error('Error checking template usage:', error);
      this.#snackBar.open(
        this.#transloco.translate('template.verificationCheckError'),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
      return 'error';
    }
  }

  async addTemplate(
    template: BudgetTemplateCreate,
  ): Promise<BudgetTemplateCreateResponse['data'] | undefined> {
    if (this.isTemplateLimitReached()) {
      throw new Error('Template limit reached');
    }

    const result = await this.#createTemplateMutation.mutate(template);
    if (!result) {
      throw (
        this.#createTemplateMutation.error() ??
        new Error('Failed to create template')
      );
    }
    return result.data;
  }
}
