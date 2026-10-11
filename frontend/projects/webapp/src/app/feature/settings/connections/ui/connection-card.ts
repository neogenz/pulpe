import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { McpActivity, McpConnection } from 'pulpe-shared';

const PREVIEW_COUNT = 5;
const FULL_COUNT = 50;

/** Identity and access controls stay visible while activity is explored on demand. */
@Component({
  selector: 'pulpe-connection-card',
  imports: [DatePipe, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article
      class="rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden"
      data-testid="connection-card"
    >
      <header class="flex flex-wrap items-center justify-between gap-4 p-5">
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container"
          >
            <mat-icon aria-hidden="true">smart_toy</mat-icon>
          </span>
          <div class="min-w-0">
            <h3
              class="text-title-medium font-semibold text-on-surface break-words"
              data-testid="connection-name"
            >
              {{ connection().clientName }}
            </h3>
            <p
              class="text-body-medium text-on-surface-variant"
              data-testid="connection-meta"
            >
              {{
                (connection().mode === 'read'
                  ? 'settings.connections.modeRead'
                  : 'settings.connections.modeReadWrite'
                ) | transloco
              }}
            </p>
            <p class="text-body-small text-on-surface-variant mt-1">
              {{
                'settings.connections.since'
                  | transloco
                    : { date: connection().authorizedAt | date: 'longDate' }
              }}
            </p>
          </div>
        </div>
        <button
          matButton="outlined"
          type="button"
          class="shrink-0"
          (click)="revoke.emit()"
          data-testid="connection-revoke-button"
        >
          {{ 'settings.connections.revoke' | transloco }}
        </button>
      </header>

      @if (connection().mode === 'read_write') {
        <div class="border-t border-outline-variant px-5 py-2">
          <button
            matButton
            type="button"
            [attr.aria-expanded]="historyOpen()"
            [attr.aria-controls]="'activity-' + connection().id"
            (click)="toggleActivity()"
            data-testid="connection-load-activity"
          >
            <mat-icon aria-hidden="true">{{
              historyOpen() ? 'expand_less' : 'history'
            }}</mat-icon>
            {{ 'settings.connections.recentActions' | transloco }}
          </button>
          <section
            [id]="'activity-' + connection().id"
            [hidden]="!historyOpen()"
            [attr.aria-label]="'settings.connections.recentActions' | transloco"
            [attr.aria-busy]="isLoading()"
            class="pb-3"
          >
            @if (isLoading()) {
              <p
                role="status"
                class="text-body-small text-on-surface-variant py-3"
              >
                {{ 'settings.connections.activityLoading' | transloco }}
              </p>
            }
            @if (activityError()) {
              <div class="flex flex-wrap items-center gap-2 py-2">
                <p role="alert" class="text-body-small text-error">
                  {{ 'settings.connections.activityError' | transloco }}
                </p>
                <button
                  matButton
                  type="button"
                  (click)="fetchActivity(requestedLimit)"
                  data-testid="connection-retry-activity"
                >
                  {{ 'common.retry' | transloco }}
                </button>
              </div>
            }
            @if (activity(); as entries) {
              @if (entries.length === 0) {
                <p
                  class="text-body-small text-on-surface-variant py-3"
                  data-testid="connection-no-activity"
                >
                  {{ 'settings.connections.noActivity' | transloco }}
                </p>
              } @else {
                <div
                  class="max-h-80 overflow-y-auto overscroll-contain rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
                  role="region"
                  tabindex="0"
                  [attr.aria-label]="
                    'settings.connections.recentActions' | transloco
                  "
                  data-testid="connection-activity"
                >
                  <ul class="divide-y divide-outline-variant">
                    @for (
                      entry of isExpanded()
                        ? entries
                        : entries.slice(0, previewCount);
                      track $index
                    ) {
                      <li
                        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3 pr-2 text-body-medium"
                        data-testid="connection-activity-row"
                      >
                        <span [class.text-error]="entry.outcome === 'error'">
                          {{ toolLabel(entry.tool) }}
                          @if (entry.outcome === 'error') {
                            ({{ 'settings.connections.failed' | transloco }})
                          }
                        </span>
                        <time
                          class="text-body-small text-on-surface-variant shrink-0 tabular-nums"
                          [attr.datetime]="entry.createdAt"
                          >{{ entry.createdAt | date: 'short' }}</time
                        >
                      </li>
                    }
                  </ul>
                </div>
                @if (!activityError() && entries.length >= previewCount) {
                  <button
                    matButton
                    type="button"
                    class="mt-2"
                    [disabled]="isLoading()"
                    (click)="
                      isExpanded()
                        ? isExpanded.set(false)
                        : requestedLimit === fullCount
                          ? isExpanded.set(true)
                          : fetchActivity(fullCount)
                    "
                    [attr.data-testid]="
                      isExpanded()
                        ? 'connection-show-less'
                        : 'connection-see-all'
                    "
                  >
                    {{
                      (isExpanded()
                        ? 'settings.connections.showLess'
                        : 'settings.connections.seeAll'
                      ) | transloco
                    }}
                  </button>
                }
              }
            }
          </section>
        </div>
      }
    </article>
  `,
})
export class ConnectionCard {
  readonly #transloco = inject(TranslocoService);
  readonly connection = input.required<McpConnection>();
  /** Fetches the newest entries; the parent owns the API. */
  readonly loadActivity =
    input.required<
      (connectionId: string, limit: number) => Promise<McpActivity[]>
    >();
  readonly revoke = output<void>();

  protected readonly previewCount = PREVIEW_COUNT;
  protected readonly fullCount = FULL_COUNT;
  protected readonly activity = signal<McpActivity[] | null>(null);
  protected readonly isExpanded = signal(false);
  protected readonly historyOpen = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly activityError = signal(false);
  protected requestedLimit = PREVIEW_COUNT;

  protected toolLabel(tool: string): string {
    const key = `settings.connections.tools.${tool}`;
    const label = this.#transloco.translate<string>(key);
    return label === key
      ? this.#transloco.translate('settings.connections.unknownAction')
      : label;
  }

  protected toggleActivity(): void {
    this.historyOpen.update((open) => !open);
    if (this.historyOpen() && this.activity() === null) {
      void this.fetchActivity(PREVIEW_COUNT);
    }
  }

  protected async fetchActivity(limit: number): Promise<void> {
    if (this.isLoading()) return;
    this.requestedLimit = limit;
    this.isLoading.set(true);
    this.activityError.set(false);
    try {
      this.activity.set(await this.loadActivity()(this.connection().id, limit));
      this.isExpanded.set(limit === FULL_COUNT);
    } catch {
      this.activityError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }
}
