import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { AppCurrencyPipe } from '@core/currency';
import { TagApi } from '@core/tag';
import { firstValueFrom } from 'rxjs';
import type { SupportedCurrency, Tag, TagHistoryMonths } from 'pulpe-shared';
import { TagHistoryChart } from './tag-history-chart';

const MASKED_VALUE = '•••••';

export interface TagHistoryDialogData {
  tags: readonly Tag[];
  selectedTagId?: string;
  endMonth: number;
  endYear: number;
  currency: SupportedCurrency;
}

@Component({
  selector: 'pulpe-tag-history-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TagHistoryChart,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div mat-dialog-title class="flex! items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-headline-small truncate">
          {{ 'tagHistory.title' | transloco }}
        </h2>
        <p class="text-body-small text-on-surface-variant font-normal">
          {{
            'tagHistory.subtitle'
              | transloco: { month: data.endMonth, year: data.endYear }
          }}
        </p>
      </div>
      <button
        matIconButton
        mat-dialog-close
        [attr.aria-label]="'common.close' | transloco"
        data-testid="tag-history-close"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="min-w-0 overflow-x-hidden!">
      <div class="flex min-w-0 flex-col gap-5 py-1">
        <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tagHistory.tagLabel' | transloco }}</mat-label>
            <mat-select
              [value]="selectedTagId()"
              (selectionChange)="selectedTagId.set($event.value)"
              data-testid="tag-history-tag-select"
            >
              @for (tag of data.tags; track tag.id) {
                <mat-option [value]="tag.id">{{ tag.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tagHistory.periodLabel' | transloco }}</mat-label>
            <mat-select
              [value]="months()"
              (selectionChange)="months.set($event.value)"
              data-testid="tag-history-period-select"
            >
              @for (option of monthOptions; track option) {
                <mat-option [value]="option">
                  {{ 'tagHistory.monthCount' | transloco: { count: option } }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (historyResource.isLoading()) {
          <div
            class="flex min-h-64 flex-col items-center justify-center gap-3 text-on-surface-variant"
            role="status"
            data-testid="tag-history-loading"
          >
            <mat-progress-spinner mode="indeterminate" diameter="36" />
            <p>{{ 'tagHistory.loading' | transloco }}</p>
          </div>
        } @else if (historyResource.error()) {
          <div
            class="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center"
            role="alert"
            data-testid="tag-history-error"
          >
            <mat-icon class="text-error text-4xl! w-10! h-10!"
              >error_outline</mat-icon
            >
            <div>
              <h3 class="text-title-medium">
                {{ 'tagHistory.errorTitle' | transloco }}
              </h3>
              <p class="text-body-medium text-on-surface-variant">
                {{ 'tagHistory.errorMessage' | transloco }}
              </p>
            </div>
            <button
              matButton="tonal"
              (click)="retry()"
              data-testid="tag-history-retry"
            >
              <mat-icon>refresh</mat-icon>
              {{ 'common.retry' | transloco }}
            </button>
          </div>
        } @else if (history(); as history) {
          @if (isEmpty()) {
            <div
              class="flex min-h-64 flex-col items-center justify-center gap-2 px-4 text-center text-on-surface-variant"
              role="status"
              data-testid="tag-history-empty"
            >
              <mat-icon class="text-5xl! w-12! h-12!">insights</mat-icon>
              <h3 class="text-title-medium text-on-surface">
                {{ 'tagHistory.emptyTitle' | transloco }}
              </h3>
              <p class="text-body-medium">
                {{
                  'tagHistory.emptyMessage'
                    | transloco: { tag: selectedTag()?.name }
                }}
              </p>
            </div>
          } @else {
            <div
              class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4"
              data-testid="tag-history-summary"
            >
              <div class="rounded-2xl bg-surface-container-low p-3 min-w-0">
                <p class="text-label-medium text-on-surface-variant">
                  {{ 'tagHistory.totalActual' | transloco }}
                </p>
                <p
                  class="ph-no-capture text-title-medium font-semibold truncate"
                >
                  {{ formatAmount(history.totalActual) }}
                </p>
              </div>
              <div class="rounded-2xl bg-surface-container-low p-3 min-w-0">
                <p class="text-label-medium text-on-surface-variant">
                  {{ 'tagHistory.monthlyAverage' | transloco }}
                </p>
                <p
                  class="ph-no-capture text-title-medium font-semibold truncate"
                >
                  {{ formatAmount(history.monthlyAverageActual) }}
                </p>
              </div>
              <div class="rounded-2xl bg-surface-container-low p-3 min-w-0">
                <p class="text-label-medium text-on-surface-variant">
                  {{ 'tagHistory.totalPlanned' | transloco }}
                </p>
                <p
                  class="ph-no-capture text-title-medium font-semibold truncate"
                >
                  {{ formatAmount(history.totalPlanned) }}
                </p>
              </div>
              <div class="rounded-2xl bg-surface-container-low p-3 min-w-0">
                <p class="text-label-medium text-on-surface-variant">
                  {{ 'tagHistory.actualToPlanned' | transloco }}
                </p>
                <p
                  class="ph-no-capture text-title-medium font-semibold truncate"
                >
                  {{ formatRatio(history.actualToPlannedPercent) }}
                </p>
              </div>
            </div>

            <pulpe-tag-history-chart
              [periods]="history.periods"
              [selectedTagName]="selectedTag()?.name ?? ''"
              [currency]="data.currency"
              [totalActual]="history.totalActual"
              [monthlyAverageActual]="history.monthlyAverageActual"
            />
          }
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>
        {{ 'common.close' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
      max-width: 100%;
    }
  `,
})
export class TagHistoryDialog {
  readonly data = inject<TagHistoryDialogData>(MAT_DIALOG_DATA);
  readonly #tagApi = inject(TagApi);
  readonly #amountsVisibility = inject(AmountsVisibilityService);
  readonly #currencyPipe = new AppCurrencyPipe();

  readonly monthOptions: readonly TagHistoryMonths[] = [3, 6, 12, 24];
  readonly selectedTagId = signal(
    this.data.selectedTagId ?? this.data.tags[0]?.id ?? '',
  );
  readonly months = signal<TagHistoryMonths>(3);
  readonly selectedTag = computed(() =>
    this.data.tags.find((tag) => tag.id === this.selectedTagId()),
  );

  readonly historyResource = resource({
    params: () => {
      const tagId = this.selectedTagId();
      if (!tagId) return undefined;
      return {
        tagId,
        months: this.months(),
        endMonth: this.data.endMonth,
        endYear: this.data.endYear,
      };
    },
    loader: ({ params }) =>
      firstValueFrom(
        this.#tagApi.getHistory$(params.tagId, {
          months: params.months,
          endMonth: params.endMonth,
          endYear: params.endYear,
        }),
      ),
  });

  readonly history = computed(() => this.historyResource.value()?.data ?? null);
  readonly isEmpty = computed(() =>
    this.history()?.periods.every(
      (period) => period.plannedAmount === 0 && period.actualAmount === 0,
    ),
  );

  retry(): void {
    this.historyResource.reload();
  }

  protected formatAmount(amount: number): string {
    if (this.#amountsVisibility.amountsHidden()) return MASKED_VALUE;
    return this.#currencyPipe.transform(amount, this.data.currency) ?? '';
  }

  protected formatRatio(value: number | null): string {
    if (value === null) return '—';
    if (this.#amountsVisibility.amountsHidden()) return MASKED_VALUE;
    return `${Math.round(value)} %`;
  }
}
