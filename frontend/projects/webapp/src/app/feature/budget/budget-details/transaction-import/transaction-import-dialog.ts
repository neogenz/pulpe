import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { isApiError } from '@core/api/api-error';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { LoadingButton } from '@ui/loading-button';
import {
  canConfirmTransactionImport,
  type TransactionImportBudgetLine,
  type TransactionImportOperation,
  type TransactionImportPreview,
} from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { BudgetDetailsStore } from '../store/budget-details-store';
import { TransactionImportApi } from './transaction-import-api';
import {
  acceptAllSuggestions,
  acceptSuggestion,
  type AttachmentDecisions,
  type AttachmentView,
  attachOperation,
  buildAttachmentPlan,
  buildAttachmentViews,
  buildPlanSummary,
  buildStatusSummary,
  confirmLabelKey,
  countPendingSuggestions,
  emptyAttachmentDecisions,
  leaveFree,
  toImportDecisions,
  countOperationsByStatus,
  isFileTooLarge,
  isPreviewStale,
  toErrorRows,
  toOperationRows,
  TRANSACTION_IMPORT_MAX_FILE_MEGABYTES,
  type TransactionImportDialogResult,
} from './transaction-import.view-model';

export interface TransactionImportDialogData {
  budgetId: string;
}

/**
 * `idle → previewing → preview → importing → done | failed`. The file is held
 * from the first preview on, so every recovery replays the SAME file.
 */
export type TransactionImportDialogState =
  | { readonly step: 'idle'; readonly isFileTooLarge: boolean }
  | { readonly step: 'previewing'; readonly file: File }
  | {
      readonly step: 'preview';
      readonly file: File;
      readonly preview: TransactionImportPreview;
    }
  | {
      readonly step: 'importing';
      readonly file: File;
      readonly preview: TransactionImportPreview;
    }
  | { readonly step: 'done'; readonly result: TransactionImportDialogResult }
  | {
      readonly step: 'failed';
      readonly file: File;
      readonly message: string;
      /** Kept when the confirmation failed in a way a plain retry can heal. */
      readonly preview: TransactionImportPreview | null;
      readonly stage: 'preview' | 'import';
    };

const ACCEPTED_FILE_TYPES = '.xml,application/xml,text/xml';

@Component({
  selector: 'pulpe-transaction-import-dialog',
  host: { 'data-testid': 'transaction-import-dialog' },
  imports: [
    AppCurrencyPipe,
    DatePipe,
    LoadingButton,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'transactionImport.title' | transloco }}</h2>

    <mat-dialog-content>
      <input
        #fileInput
        type="file"
        class="hidden"
        [accept]="acceptedFileTypes"
        (change)="onFileSelected($event)"
        data-testid="statement-file-input"
      />

      <div class="flex min-w-0 flex-col gap-4">
        @switch (state().step) {
          @case ('idle') {
            <p class="text-body-large text-on-surface">
              {{ 'transactionImport.intro' | transloco }}
            </p>
            <p
              class="flex items-start gap-2 text-body-medium text-on-surface-variant"
            >
              <mat-icon class="shrink-0" aria-hidden="true">lock</mat-icon>
              <span>{{ 'transactionImport.noBankAccess' | transloco }}</span>
            </p>
            @if (isFileTooLargeShown()) {
              <p
                class="flex items-start gap-2 rounded-2xl bg-error-container p-4 text-body-medium text-on-error-container"
                role="alert"
                data-testid="file-too-large-alert"
              >
                <mat-icon class="shrink-0" aria-hidden="true"
                  >error_outline</mat-icon
                >
                <span>
                  {{
                    'transactionImport.fileTooLarge'
                      | transloco: { max: maxFileMegabytes }
                  }}
                </span>
              </p>
            }
          }
          @case ('previewing') {
            <div
              class="flex items-center justify-center gap-3 py-8 text-body-large text-on-surface-variant"
              role="status"
              data-testid="statement-previewing"
            >
              <mat-progress-spinner mode="indeterminate" [diameter]="24" />
              <span>{{ 'transactionImport.previewing' | transloco }}</span>
            </div>
          }
          @case ('failed') {
            <div
              class="rounded-2xl bg-error-container p-4 text-on-error-container"
              role="alert"
              data-testid="import-failure-alert"
            >
              <div class="flex items-center gap-2">
                <mat-icon class="shrink-0" aria-hidden="true"
                  >error_outline</mat-icon
                >
                <h3 class="text-title-small">
                  {{
                    (failure()?.stage === 'preview'
                      ? 'transactionImport.previewFailedTitle'
                      : 'transactionImport.failedTitle'
                    ) | transloco
                  }}
                </h3>
              </div>
              <p class="mt-1 text-body-medium">{{ failure()?.message }}</p>
            </div>
          }
        }

        @if (file(); as file) {
          <p
            class="flex min-w-0 items-center gap-2 text-body-medium text-on-surface-variant"
          >
            <mat-icon class="shrink-0" aria-hidden="true">description</mat-icon>
            <span class="ph-no-capture min-w-0 truncate">{{ file.name }}</span>
          </p>
        }

        @if (preview(); as preview) {
          <p
            class="text-body-medium text-on-surface"
            role="status"
            data-testid="import-summary"
          >
            @for (item of summary(); track item.status; let last = $last) {
              <span [class.font-medium]="item.status === 'new'">{{
                item.key | transloco: { count: item.count }
              }}</span>
              @if (!last) {
                <span class="text-on-surface-variant" aria-hidden="true">
                  ·
                </span>
              }
            }
          </p>

          @if (isPlanShown()) {
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p
                class="min-w-0 flex-1 text-body-medium text-on-surface-variant"
                role="status"
                data-testid="import-plan"
              >
                @for (item of planSummary(); track item.key; let last = $last) {
                  <span>{{ item.key | transloco: { count: item.count } }}</span>
                  @if (!last) {
                    <span aria-hidden="true"> · </span>
                  }
                }
              </p>
              @if (pendingSuggestionCount() >= 2) {
                <button
                  matButton="tonal"
                  class="shrink-0"
                  [disabled]="isImporting()"
                  (click)="acceptAll()"
                  data-testid="accept-all-suggestions-button"
                >
                  <mat-icon>done_all</mat-icon>
                  {{
                    'transactionImport.attachment.acceptAll'
                      | transloco: { count: pendingSuggestionCount() }
                  }}
                </button>
              }
            </div>
          }

          @if (errorRows().length > 0) {
            <div
              class="rounded-2xl bg-error-container p-4 text-on-error-container"
              role="alert"
              data-testid="import-errors-panel"
            >
              <div class="flex items-center gap-2">
                <mat-icon class="shrink-0" aria-hidden="true"
                  >error_outline</mat-icon
                >
                <h3 class="text-title-small">
                  {{ 'transactionImport.errorsTitle' | transloco }}
                </h3>
              </div>
              <p class="mt-1 text-body-medium">
                {{ 'transactionImport.errorsHint' | transloco }}
              </p>
              <ul class="mt-2 list-disc pl-5 text-body-medium">
                @for (error of errorRows(); track $index) {
                  <li>
                    @if (error.position !== null) {
                      {{
                        'transactionImport.errorAtPosition'
                          | transloco
                            : {
                                position: error.position,
                                message: (error.key | transloco: error.params),
                              }
                      }}
                    } @else {
                      {{ error.key | transloco: error.params }}
                    }
                  </li>
                }
              </ul>
            </div>
          } @else if (newCount() === 0) {
            <p class="text-body-medium text-on-surface-variant">
              {{ 'transactionImport.nothingNew' | transloco }}
            </p>
          }

          @if (operationRows().length > 0) {
            <ul
              class="flex flex-col divide-y divide-outline-variant"
              [attr.aria-label]="
                'transactionImport.operationsLabel' | transloco
              "
            >
              @for (row of operationRows(); track row.position) {
                @let attachment = attachmentViews().get(row.position);
                <li
                  class="flex min-w-0 flex-col gap-2 py-3"
                  data-testid="import-operation-row"
                >
                  <div class="flex min-w-0 items-start gap-3">
                    <div class="min-w-0 flex-1">
                      <p
                        class="ph-no-capture truncate text-body-large"
                        [id]="'import-operation-name-' + row.position"
                        [class.text-on-surface]="row.isNew"
                        [class.text-on-surface-variant]="!row.isNew"
                      >
                        {{ row.name }}
                      </p>
                      <p
                        class="flex flex-wrap gap-x-2 text-body-small text-on-surface-variant"
                      >
                        <span>{{ row.date | date: dateFormat() }}</span>
                        <span aria-hidden="true">·</span>
                        <span>{{ row.kindKey | transloco }}</span>
                        @if (row.statusKey) {
                          <span aria-hidden="true">·</span>
                          <span
                            class="font-medium"
                            data-testid="import-operation-status"
                            >{{ row.statusKey | transloco }}</span
                          >
                        }
                      </p>
                    </div>
                    <span
                      class="ph-no-capture shrink-0 text-body-large tabular-nums"
                      [class.text-financial-income]="
                        row.isNew && row.kind === 'income'
                      "
                      [class.text-financial-expense]="
                        row.isNew && row.kind === 'expense'
                      "
                      [class.text-on-surface-variant]="!row.isNew"
                    >
                      {{ row.amount | appCurrency: preview.currency : '1.2-2' }}
                    </span>
                  </div>

                  @if (attachment) {
                    <!-- A pending or accepted attachment gets a panel; a free Réel stays a quiet line. -->
                    <div
                      class="flex min-w-0 flex-col gap-1"
                      [class]="
                        attachment.state === 'free'
                          ? ''
                          : 'rounded-2xl bg-surface-container px-3 py-2'
                      "
                      role="group"
                      [attr.aria-labelledby]="
                        'import-operation-name-' + row.position
                      "
                      [attr.data-state]="attachment.state"
                      data-testid="import-attachment-panel"
                    >
                      @switch (attachment.state) {
                        @case ('suggested') {
                          <p
                            class="flex min-w-0 items-start gap-2 text-body-medium text-on-surface"
                          >
                            <mat-icon
                              class="mat-icon-sm shrink-0 text-primary"
                              aria-hidden="true"
                              >lightbulb</mat-icon
                            >
                            <span class="min-w-0">
                              {{
                                'transactionImport.attachment.suggested'
                                  | transloco
                              }}
                              <span
                                class="ph-no-capture font-medium break-words"
                                >{{ attachment.line.name }}</span
                              >
                            </span>
                          </p>
                          <ul
                            class="flex flex-wrap gap-1"
                            [attr.aria-label]="
                              'transactionImport.attachment.reasonsLabel'
                                | transloco
                            "
                          >
                            @for (
                              reasonKey of attachment.reasonKeys;
                              track reasonKey
                            ) {
                              <li
                                class="inline-flex items-center rounded-full bg-secondary-container px-2 py-0.5 text-label-small text-on-secondary-container"
                                data-testid="suggestion-reason-chip"
                              >
                                {{ reasonKey | transloco }}
                              </li>
                            }
                          </ul>
                          <div class="flex flex-wrap items-center gap-x-1">
                            <button
                              matButton="tonal"
                              [disabled]="isImporting()"
                              (click)="accept(row.position)"
                              data-testid="accept-suggestion-button"
                            >
                              {{
                                'transactionImport.attachment.accept'
                                  | transloco
                              }}
                            </button>
                            <button
                              matButton
                              [disabled]="isImporting()"
                              [matMenuTriggerFor]="attachmentMenu"
                              [matMenuTriggerData]="{
                                position: row.position,
                                attachment,
                              }"
                              data-testid="change-attachment-button"
                            >
                              {{
                                'transactionImport.attachment.change'
                                  | transloco
                              }}
                            </button>
                            <button
                              matButton
                              [disabled]="isImporting()"
                              (click)="refuse(row.position)"
                              data-testid="refuse-suggestion-button"
                            >
                              {{
                                'transactionImport.attachment.refuse'
                                  | transloco
                              }}
                            </button>
                          </div>
                        }
                        @case ('attached') {
                          <p
                            class="flex min-w-0 items-start gap-2 text-body-medium text-on-surface"
                          >
                            <mat-icon
                              class="mat-icon-sm icon-filled shrink-0 text-primary"
                              aria-hidden="true"
                              >check_circle</mat-icon
                            >
                            <span class="min-w-0">
                              {{
                                'transactionImport.attachment.attachedTo'
                                  | transloco
                              }}
                              <span
                                class="ph-no-capture font-medium break-words"
                                >{{ attachment.line.name }}</span
                              >
                              <span class="text-on-surface-variant">
                                ·
                                {{
                                  'transactionImport.attachment.willBeChecked'
                                    | transloco
                                }}</span
                              >
                            </span>
                          </p>
                          <div class="flex flex-wrap items-center gap-x-1">
                            <button
                              matButton
                              [disabled]="isImporting()"
                              [matMenuTriggerFor]="attachmentMenu"
                              [matMenuTriggerData]="{
                                position: row.position,
                                attachment,
                              }"
                              data-testid="change-attachment-button"
                            >
                              {{
                                'transactionImport.attachment.change'
                                  | transloco
                              }}
                            </button>
                            <button
                              matButton
                              [disabled]="isImporting()"
                              (click)="detach(row.position)"
                              data-testid="remove-attachment-button"
                            >
                              {{
                                'transactionImport.attachment.remove'
                                  | transloco
                              }}
                            </button>
                          </div>
                        }
                        @case ('free') {
                          <div
                            class="flex min-w-0 flex-wrap items-center justify-between gap-x-2"
                          >
                            <p
                              class="text-body-medium text-on-surface-variant"
                              data-testid="free-attachment-label"
                            >
                              {{
                                'transactionImport.attachment.free' | transloco
                              }}
                            </p>
                            <button
                              matButton
                              [disabled]="isImporting()"
                              [matMenuTriggerFor]="attachmentMenu"
                              [matMenuTriggerData]="{
                                position: row.position,
                                attachment,
                              }"
                              data-testid="attach-button"
                            >
                              <mat-icon>add_link</mat-icon>
                              {{
                                'transactionImport.attachment.attach'
                                  | transloco
                              }}
                            </button>
                          </div>
                        }
                      }
                    </div>
                  }
                </li>
              }
            </ul>

            <mat-menu
              #attachmentMenu="matMenu"
              xPosition="before"
              [aria-label]="
                'transactionImport.attachment.menuLabel' | transloco
              "
            >
              <ng-template
                matMenuContent
                let-position="position"
                let-attachment="attachment"
              >
                @for (group of attachment.options; track group.kind) {
                  <p
                    class="px-4 pb-1 pt-2 text-label-medium text-on-surface-variant"
                    aria-hidden="true"
                  >
                    {{ group.kindKey | transloco }}
                  </p>
                  @for (line of group.lines; track line.id) {
                    <button
                      mat-menu-item
                      (click)="attach(position, line)"
                      data-testid="attachment-option-button"
                    >
                      @if (isCurrentLine(attachment, line)) {
                        <mat-icon matMenuItemIcon>check</mat-icon>
                      }
                      <span class="flex w-full min-w-0 items-baseline gap-4">
                        <span class="ph-no-capture min-w-0 flex-1 truncate">{{
                          line.name
                        }}</span>
                        <span class="sr-only">{{
                          group.kindKey | transloco
                        }}</span>
                        <span
                          class="ph-no-capture shrink-0 text-body-small tabular-nums text-on-surface-variant"
                          >{{
                            line.amount
                              | appCurrency: preview.currency : '1.2-2'
                          }}</span
                        >
                      </span>
                    </button>
                  }
                }
              </ng-template>
            </mat-menu>
          }
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="flex-wrap gap-2">
      @switch (state().step) {
        @case ('idle') {
          <button matButton mat-dialog-close data-testid="cancel-button">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            matButton="filled"
            (click)="chooseFile()"
            data-testid="choose-file-button"
          >
            <mat-icon>upload_file</mat-icon>
            {{ 'transactionImport.chooseFile' | transloco }}
          </button>
        }
        @case ('previewing') {
          <button matButton mat-dialog-close data-testid="cancel-button">
            {{ 'common.cancel' | transloco }}
          </button>
        }
        @case ('failed') {
          <button
            matButton
            (click)="chooseFile()"
            data-testid="choose-another-file-button"
          >
            {{ 'transactionImport.chooseAnotherFile' | transloco }}
          </button>
          <button
            matButton="filled"
            (click)="retry()"
            data-testid="retry-button"
          >
            {{ retryLabelKey() | transloco }}
          </button>
        }
        @default {
          <button
            matButton
            [disabled]="isImporting()"
            (click)="chooseFile()"
            data-testid="choose-another-file-button"
          >
            {{ 'transactionImport.chooseAnotherFile' | transloco }}
          </button>
          <pulpe-loading-button
            type="button"
            [fullWidth]="false"
            [loading]="isImporting()"
            [disabled]="!canConfirm()"
            [loadingText]="'transactionImport.importing' | transloco"
            testId="confirm-import-button"
            (click)="confirm()"
          >
            {{ confirmLabelKey() | transloco: { count: newCount() } }}
          </pulpe-loading-button>
        }
      }
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionImportDialog {
  readonly #dialogRef =
    inject<
      MatDialogRef<TransactionImportDialog, TransactionImportDialogResult>
    >(MatDialogRef);
  readonly #data = inject<TransactionImportDialogData>(MAT_DIALOG_DATA);
  readonly #api = inject(TransactionImportApi);
  readonly #store = inject(BudgetDetailsStore);
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #transloco = inject(TranslocoService);

  private readonly fileInput =
    viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly acceptedFileTypes = ACCEPTED_FILE_TYPES;
  protected readonly maxFileMegabytes = TRANSACTION_IMPORT_MAX_FILE_MEGABYTES;

  readonly #state = signal<TransactionImportDialogState>({
    step: 'idle',
    isFileTooLarge: false,
  });
  readonly state = this.#state.asReadonly();

  protected readonly isFileTooLargeShown = computed(() => {
    const state = this.#state();
    return state.step === 'idle' && state.isFileTooLarge;
  });

  protected readonly file = computed(() => {
    const state = this.#state();
    return 'file' in state ? state.file : null;
  });

  protected readonly preview = computed(() => {
    const state = this.#state();
    return state.step === 'preview' || state.step === 'importing'
      ? state.preview
      : null;
  });

  protected readonly failure = computed(() => {
    const state = this.#state();
    return state.step === 'failed' ? state : null;
  });

  protected readonly isImporting = computed(
    () => this.#state().step === 'importing',
  );

  readonly #counts = computed(() =>
    countOperationsByStatus(this.preview()?.operations ?? []),
  );
  protected readonly newCount = computed(() => this.#counts().new);
  protected readonly summary = computed(() =>
    buildStatusSummary(this.#counts()),
  );
  protected readonly operationRows = computed(() =>
    toOperationRows(this.preview()?.operations ?? []),
  );
  protected readonly errorRows = computed(() =>
    toErrorRows(this.preview()?.errors ?? []),
  );
  protected readonly dateFormat = computed(
    () => getDateDisplayFormats(this.preview()?.currency ?? 'CHF').shortDate,
  );
  protected readonly confirmLabelKey = computed(() =>
    confirmLabelKey(this.newCount()),
  );

  /** Reset by every preview: a decision only holds for the operations it was made on. */
  readonly #decisions = signal<AttachmentDecisions>(emptyAttachmentDecisions());
  readonly #operations = computed(() => this.preview()?.operations ?? []);
  readonly #budgetLines = computed(() => this.preview()?.budgetLines ?? []);

  protected readonly attachmentViews = computed(() =>
    buildAttachmentViews(
      this.#decisions(),
      this.#operations(),
      this.#budgetLines(),
    ),
  );
  protected readonly pendingSuggestionCount = computed(() =>
    countPendingSuggestions(
      this.#decisions(),
      this.#operations(),
      this.#budgetLines(),
    ),
  );
  protected readonly planSummary = computed(() =>
    buildPlanSummary(
      buildAttachmentPlan(
        this.#decisions(),
        this.#operations(),
        this.#budgetLines(),
      ),
    ),
  );
  /** Only when something can be attached and the file can be imported at all. */
  protected readonly isPlanShown = computed(
    () =>
      this.attachmentViews().size > 0 &&
      this.errorRows().length === 0 &&
      this.newCount() > 0,
  );

  readonly canConfirm = computed(() => {
    const state = this.#state();
    return (
      state.step === 'preview' && canConfirmTransactionImport(state.preview)
    );
  });

  /** A stale preview gets a fresh one; any other failure retries its own step. */
  protected readonly retryLabelKey = computed(() => {
    const failure = this.failure();
    return failure?.stage === 'import' && failure.preview === null
      ? 'transactionImport.rerunPreview'
      : 'common.retry';
  });

  protected chooseFile(): void {
    const input = this.fileInput().nativeElement;
    // Cleared so picking the same file again still fires `change`.
    input.value = '';
    input.click();
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void this.selectFile(file);
  }

  async selectFile(file: File): Promise<void> {
    if (isFileTooLarge(file)) {
      this.#state.set({ step: 'idle', isFileTooLarge: true });
      return;
    }
    await this.#runPreview(file);
  }

  async confirm(): Promise<void> {
    const state = this.#state();
    if (state.step !== 'preview' || !canConfirmTransactionImport(state.preview))
      return;
    await this.#runImport(state.file, state.preview);
  }

  async retry(): Promise<void> {
    const failure = this.failure();
    if (!failure) return;
    if (failure.preview) {
      await this.#runImport(failure.file, failure.preview);
    } else {
      await this.#runPreview(failure.file);
    }
  }

  protected accept(position: number): void {
    const operation = this.#operationAt(position);
    if (!operation) return;
    this.#decisions.update((decisions) =>
      acceptSuggestion(decisions, operation, this.#budgetLines()),
    );
  }

  protected refuse(position: number): void {
    this.#decisions.update((decisions) => leaveFree(decisions, position));
  }

  protected detach(position: number): void {
    this.#decisions.update((decisions) => leaveFree(decisions, position));
  }

  protected attach(position: number, line: TransactionImportBudgetLine): void {
    const operation = this.#operationAt(position);
    if (!operation) return;
    this.#decisions.update((decisions) =>
      attachOperation(decisions, operation, line),
    );
  }

  protected acceptAll(): void {
    this.#decisions.update((decisions) =>
      acceptAllSuggestions(decisions, this.#operations(), this.#budgetLines()),
    );
  }

  protected isCurrentLine(
    attachment: AttachmentView,
    line: TransactionImportBudgetLine,
  ): boolean {
    return attachment.state === 'attached' && attachment.line.id === line.id;
  }

  #operationAt(position: number): TransactionImportOperation | undefined {
    return this.#operations().find(
      (operation) => operation.position === position,
    );
  }

  async #runPreview(file: File): Promise<void> {
    this.#decisions.set(emptyAttachmentDecisions());
    this.#state.set({ step: 'previewing', file });
    try {
      const preview = await firstValueFrom(
        this.#api.preview$(this.#data.budgetId, file),
      );
      this.#state.set({ step: 'preview', file, preview });
    } catch (error) {
      this.#state.set({
        step: 'failed',
        file,
        preview: null,
        stage: 'preview',
        message: this.#localize(error),
      });
    }
  }

  async #runImport(
    file: File,
    preview: TransactionImportPreview,
  ): Promise<void> {
    this.#state.set({ step: 'importing', file, preview });
    // An import cannot be called back once sent: keep the dialog open on it.
    this.#dialogRef.disableClose = true;
    const outcome = await this.#store.importTransactions(
      this.#data.budgetId,
      file,
      toImportDecisions(
        this.#decisions(),
        preview.operations,
        preview.budgetLines,
      ),
    );
    this.#dialogRef.disableClose = false;

    if (outcome.status === 'failed') {
      this.#state.set({
        step: 'failed',
        file,
        // A stale preview must be redone; otherwise nothing was written and
        // the same confirmation can simply be sent again.
        preview: isPreviewStale(outcome.code) ? null : preview,
        stage: 'import',
        message: outcome.message,
      });
      return;
    }

    this.#state.set({ step: 'done', result: outcome });
    this.#dialogRef.close(outcome);
  }

  #localize(error: unknown): string {
    return isApiError(error)
      ? this.#apiErrorLocalizer.localizeApiError(error)
      : this.#transloco.translate('apiError.generic');
  }
}
