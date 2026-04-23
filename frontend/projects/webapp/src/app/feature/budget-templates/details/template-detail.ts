import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  type OnInit,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { ROUTES } from '@core/routing';
import { PulpeTitleStrategy } from '@core/routing/title-strategy';
import { type TemplateLine } from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { CURRENCY_CONFIG } from '@core/currency';
import { ConfirmationDialog } from '@ui/dialogs/confirmation-dialog';
import { BaseLoading } from '@ui/loading';
import { firstValueFrom } from 'rxjs';
import { TemplateLinesGrid } from './components/template-lines-grid';
import {
  EditTemplateLineDialog,
  type EditTemplateLineDialogData,
  type EditTemplateLineDialogResult,
} from './components/edit-template-line-dialog';
import { BudgetTemplatesStore } from '../services/budget-templates-store';
import { TemplateDetailsStore } from './services/template-details-store';
import { TemplateLineStore } from './services/template-line-store';

@Component({
  selector: 'pulpe-template-detail',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    TemplateLinesGrid,
    BaseLoading,
  ],
  providers: [TemplateDetailsStore, TemplateLineStore],
  template: `
    <div class="flex flex-col gap-8 min-w-0" data-testid="template-detail-page">
      @if (templateDetailsStore.isLoading()) {
        <pulpe-base-loading
          [message]="loadingMessage"
          size="large"
          [fullHeight]="true"
          testId="template-details-loading"
        />
      } @else if (templateDetailsStore.error()) {
        <div
          class="flex justify-center items-center h-full bg-error rounded-xl p-6"
          role="alert"
          aria-live="assertive"
        >
          <div class="text-center">
            <mat-icon
              class="mb-4"
              style="font-size: 2.25rem; width: 2.25rem; height: 2.25rem;"
              aria-hidden="true"
            >
              error_outline
            </mat-icon>
            <p class="text-body-large">{{ loadingError }}</p>
            <button
              matButton="outlined"
              (click)="templateDetailsStore.reloadTemplateDetails()"
              class="mt-4"
              [attr.aria-label]="retryLoadingLabel"
            >
              {{ retryLabel }}
            </button>
          </div>
        </div>
      } @else {
        @let templateData = templateDetailsStore.templateDetails();
        @if (templateData) {
          <header class="flex flex-shrink-0 gap-4 items-center">
            <button
              matIconButton
              (click)="navigateBack()"
              [attr.aria-label]="backLabel"
              class="flex-shrink-0"
            >
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="flex-1 min-w-0">
              <h1
                class="text-headline-medium md:text-display-small truncate ph-no-capture"
                [title]="templateData.template.name"
                data-testid="page-title"
              >
                {{ templateData.template.name }}
              </h1>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0 md:hidden">
              <button
                matIconButton
                class="warn-theme"
                (click)="deleteTemplate()"
                [attr.aria-label]="deleteAriaLabel"
                data-testid="delete-template-detail-button-mobile"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </div>
            <div class="hidden md:flex items-center gap-2 flex-shrink-0">
              <button
                matButton="filled"
                class="warn-theme"
                (click)="deleteTemplate()"
                [attr.aria-label]="deleteAriaLabel"
                data-testid="delete-template-detail-button"
              >
                <mat-icon>delete</mat-icon>
                {{ deleteLabel }}
              </button>
            </div>
          </header>

          <section
            class="flex-shrink-0 space-y-6"
            aria-labelledby="financial-summary-heading"
          >
            <h2 id="financial-summary-heading" class="sr-only">
              {{ financialSummaryHeading }}
            </h2>

            <div
              class="text-center py-6 px-4 sm:py-8 sm:px-6 rounded-3xl"
              [class.bg-primary-container]="isPositiveBalance()"
              [class.bg-error-container]="!isPositiveBalance()"
            >
              <p
                class="text-body-large mb-3"
                [class.text-on-primary-container]="isPositiveBalance()"
                [class.text-on-error-container]="!isPositiveBalance()"
              >
                @if (isPositiveBalance()) {
                  {{ netBalanceLabel }}
                } @else {
                  {{ deficitLabel }}
                }
              </p>
              <div
                class="text-display-medium sm:text-display-large font-bold tracking-tight ph-no-capture"
                [class.text-on-primary-container]="isPositiveBalance()"
                [class.text-on-error-container]="!isPositiveBalance()"
              >
                {{ absNetBalance() | number: '1.0-0' : locale() }}
                <span class="text-headline-small font-normal">{{
                  currency()
                }}</span>
              </div>
              <p
                class="text-body-medium mt-3"
                [class.text-on-primary-container]="isPositiveBalance()"
                [class.text-on-error-container]="!isPositiveBalance()"
                data-testid="template-hero-subtitle"
              >
                @if (isPositiveBalance()) {
                  {{
                    'template.heroSubtitleComfortable'
                      | transloco: heroSubtitleParams()
                  }}
                } @else {
                  {{
                    'template.heroSubtitleDeficit'
                      | transloco: heroSubtitleParams()
                  }}
                }
              </p>
            </div>

            <div
              class="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:justify-center scrollbar-hide"
            >
              @for (pill of financialPills(); track pill.testId) {
                <div
                  [attr.data-testid]="pill.testId"
                  class="snap-start flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full"
                  [style.background-color]="pill.bgStyle"
                >
                  <mat-icon [class]="'mat-icon-sm ' + pill.colorClass">{{
                    pill.icon
                  }}</mat-icon>
                  <div class="flex flex-col">
                    <span
                      class="text-label-small leading-tight text-on-financial-light"
                      >{{ pill.label }}</span
                    >
                    <span
                      [class]="
                        'text-label-large font-semibold ph-no-capture ' +
                        pill.colorClass
                      "
                    >
                      {{ pill.amount | number: '1.0-0' : locale() }}
                      {{ currency() }}
                    </span>
                  </div>
                </div>
              }
            </div>
          </section>

          <section
            class="flex flex-col flex-1 gap-4 min-h-0"
            aria-labelledby="forecasts-heading"
          >
            <h2 id="forecasts-heading" class="shrink-0 text-headline-small">
              {{ forecastsHeading }}
            </h2>

            <pulpe-template-lines-grid
              [lines]="templateDetailsStore.templateLines()"
              [currency]="currency()"
              (edit)="handleEditLine($event)"
              (delete)="handleDeleteLine($event)"
              (add)="handleAddLine()"
            />
          </section>

          <button
            matFab
            (click)="handleAddLine()"
            class="fab-button"
            [attr.aria-label]="'template.addLine' | transloco"
            data-testid="add-template-line-fab"
          >
            <mat-icon aria-hidden="true" class="fab-icon">add</mat-icon>
          </button>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      padding-bottom: 100px;
    }

    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }

    .fab-button {
      position: fixed;
      bottom: calc(24px + env(safe-area-inset-bottom));
      right: 24px;
      z-index: 100;

      width: 56px;
      height: 56px;
      --mat-fab-container-shape: 50%;

      background: linear-gradient(
        145deg,
        var(--mat-sys-primary) 0%,
        color-mix(in srgb, var(--mat-sys-primary) 75%, black) 100%
      );
      color: var(--mat-sys-on-primary);

      box-shadow: var(--mat-sys-level3);

      transition:
        transform 200ms var(--pulpe-ease-emphasized),
        box-shadow 200ms var(--pulpe-ease-emphasized);

      animation: fab-scale-in var(--pulpe-motion-base)
        var(--pulpe-ease-emphasized) both;

      &:hover {
        transform: scale(1.05);
        box-shadow: var(--mat-sys-level4);
      }

      &:active {
        transform: scale(0.95);
        box-shadow: var(--mat-sys-level3);
        transition-duration: 100ms;
      }

      &:hover .fab-icon {
        transform: rotate(90deg);
      }
    }

    .fab-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      transition: transform 300ms var(--pulpe-ease-emphasized);
    }

    @keyframes fab-scale-in {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      70% {
        transform: scale(1.08);
        opacity: 1;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fab-button {
        animation: none;
        transition: none;
      }

      .fab-icon {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class TemplateDetail implements OnInit {
  protected readonly templateDetailsStore = inject(TemplateDetailsStore);
  readonly #templateLineStore = inject(TemplateLineStore);
  readonly #budgetTemplatesStore = inject(BudgetTemplatesStore);
  protected readonly currency = inject(UserSettingsStore).currency;
  protected readonly locale = computed(
    () => CURRENCY_CONFIG[this.currency()].locale,
  );
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #titleStrategy = inject(PulpeTitleStrategy);
  readonly #dialog = inject(MatDialog);
  readonly #injector = inject(Injector);
  readonly #transloco = inject(TranslocoService);

  protected readonly loadingMessage =
    this.#transloco.translate('template.loading');
  protected readonly loadingError = this.#transloco.translate(
    'template.loadingError',
  );
  protected readonly retryLoadingLabel = this.#transloco.translate(
    'template.retryLoading',
  );
  protected readonly retryLabel = this.#transloco.translate('common.retry');
  protected readonly backLabel =
    this.#transloco.translate('template.backLabel');
  protected readonly deleteLabel = this.#transloco.translate('common.delete');
  protected readonly deleteAriaLabel = this.#transloco.translate(
    'template.deleteTitle',
  );
  protected readonly financialSummaryHeading = this.#transloco.translate(
    'template.financialSummary',
  );
  protected readonly netBalanceLabel = this.#transloco.translate(
    'template.netBalance',
  );
  protected readonly deficitLabel =
    this.#transloco.translate('template.deficit');
  protected readonly forecastsHeading = this.#transloco.translate(
    'template.forecastsHeading',
  );

  ngOnInit(): void {
    const templateId = this.#route.snapshot.paramMap.get('templateId');
    if (!templateId) return;
    this.templateDetailsStore.initializeTemplateId(templateId);
  }

  get #templateId(): string | null {
    return this.#route.snapshot.paramMap.get('templateId');
  }

  readonly absNetBalance = computed(() =>
    Math.abs(this.templateDetailsStore.netBalance()),
  );

  protected readonly isPositiveBalance = computed(
    () => this.templateDetailsStore.netBalance() >= 0,
  );

  protected readonly heroSubtitleParams = computed(() => ({
    amount: this.absNetBalance().toLocaleString(this.locale(), {
      maximumFractionDigits: 0,
    }),
    currency: this.currency(),
  }));

  readonly #incomeLabel = this.#transloco.translate('template.incomeLabel');
  readonly #expensesLabel = this.#transloco.translate('template.expensesLabel');
  readonly #savingsLabel = this.#transloco.translate('template.savingsLabel');

  readonly financialPills = computed(() => {
    const t = this.templateDetailsStore.totals();
    return [
      {
        testId: 'income-pill',
        bgStyle: 'var(--pulpe-financial-income-light)',
        colorClass: 'text-financial-income',
        icon: 'trending_up',
        label: this.#incomeLabel,
        amount: t.income,
      },
      {
        testId: 'expense-pill',
        bgStyle: 'var(--pulpe-financial-expense-light)',
        colorClass: 'text-financial-expense',
        icon: 'trending_down',
        label: this.#expensesLabel,
        amount: t.expense,
      },
      {
        testId: 'savings-pill',
        bgStyle: 'var(--pulpe-financial-savings-light)',
        colorClass: 'text-financial-savings',
        icon: 'savings',
        label: this.#savingsLabel,
        amount: t.savings,
      },
    ];
  });

  constructor() {
    effect(() => {
      const template = this.templateDetailsStore.template();
      if (template && template.name) {
        this.#titleStrategy.setTitle(template.name);
      }
    });
  }

  navigateBack() {
    this.#router.navigate(['/', ROUTES.BUDGET_TEMPLATES]);
  }

  async handleAddLine(): Promise<void> {
    const templateId = this.#templateId;
    const template = this.templateDetailsStore.template();
    if (!templateId || !template) return;

    const result = await this.#openLineDialog({ templateName: template.name });
    if (!result) return;
    await this.#templateLineStore.createLine(templateId, result);
  }

  async handleEditLine(line: TemplateLine): Promise<void> {
    const templateId = this.#templateId;
    const template = this.templateDetailsStore.template();
    if (!templateId || !template) return;

    const result = await this.#openLineDialog({
      line,
      templateName: template.name,
    });
    if (!result) return;
    await this.#templateLineStore.updateLine(templateId, line.id, result);
  }

  async #openLineDialog(
    data: EditTemplateLineDialogData,
  ): Promise<EditTemplateLineDialogResult | undefined> {
    const dialogRef = this.#dialog.open<
      EditTemplateLineDialog,
      EditTemplateLineDialogData,
      EditTemplateLineDialogResult
    >(EditTemplateLineDialog, {
      data,
      width: '500px',
      maxWidth: '95vw',
      injector: this.#injector,
      autoFocus: true,
      restoreFocus: true,
    });
    return firstValueFrom(dialogRef.afterClosed());
  }

  async handleDeleteLine(lineId: string): Promise<void> {
    const templateId = this.#templateId;
    if (!templateId) return;

    const line = this.templateDetailsStore
      .templateLines()
      .find((l) => l.id === lineId);
    if (!line) return;

    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('template.deleteLineTitle'),
        message: this.#transloco.translate('template.deleteLineConfirm'),
        confirmText: this.#transloco.translate('common.delete'),
        cancelText: this.#transloco.translate('common.cancel'),
        confirmColor: 'warn' as const,
      },
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    await this.#templateLineStore.deleteLine(templateId, lineId);
  }

  async deleteTemplate(): Promise<void> {
    const template = this.templateDetailsStore.template();
    const templateId = this.#templateId;
    if (!template || !templateId) return;

    const outcome = await this.#budgetTemplatesStore.confirmAndDeleteTemplate(
      templateId,
      template.name,
    );
    if (outcome === 'deleted') {
      this.navigateBack();
    }
  }
}
