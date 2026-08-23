import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { McpActivity, McpConnection } from 'pulpe-shared';

const PREVIEW_COUNT = 5;
const FULL_COUNT = 50;

/**
 * One agent connection: who, what was granted, since when, and what the
 * agent did. The activity is fetched on demand through the parent's loader.
 */
@Component({
  selector: 'pulpe-connection-card',
  imports: [DatePipe, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="rounded-2xl border border-outline-variant bg-surface-container-low p-5 space-y-4"
      data-testid="connection-card"
    >
      <header class="flex items-start gap-3">
        <mat-icon class="text-primary shrink-0" aria-hidden="true"
          >smart_toy</mat-icon
        >
        <div class="min-w-0">
          <h2
            class="text-title-medium font-semibold text-on-surface break-words"
            data-testid="connection-name"
          >
            {{ connection().clientName }}
          </h2>
          <p
            class="text-body-small text-on-surface-variant"
            data-testid="connection-meta"
          >
            {{
              (connection().mode === 'read'
                ? 'settings.connections.modeRead'
                : 'settings.connections.modeReadWrite'
              ) | transloco
            }}
            ·
            {{
              'settings.connections.since'
                | transloco
                  : { date: connection().authorizedAt | date: 'longDate' }
            }}
          </p>
        </div>
      </header>

      @if (connection().mode === 'read_write') {
        <section>
          <h3 class="text-label-large text-on-surface-variant mb-2">
            {{ 'settings.connections.recentActions' | transloco }}
          </h3>
          @if (activity(); as entries) {
            @if (entries.length === 0) {
              <p
                class="text-body-small text-on-surface-variant"
                data-testid="connection-no-activity"
              >
                {{ 'settings.connections.noActivity' | transloco }}
              </p>
            } @else {
              <ul class="space-y-1" data-testid="connection-activity">
                @for (entry of entries; track entry.createdAt) {
                  <li
                    class="flex justify-between gap-4 text-body-medium"
                    data-testid="connection-activity-row"
                  >
                    <span [class.text-error]="entry.outcome === 'error'">
                      {{
                        'settings.connections.tools.' + entry.tool | transloco
                      }}
                      @if (entry.outcome === 'error') {
                        ({{ 'settings.connections.failed' | transloco }})
                      }
                    </span>
                    <time
                      class="text-on-surface-variant shrink-0"
                      [attr.datetime]="entry.createdAt"
                    >
                      {{ entry.createdAt | date: 'short' }}
                    </time>
                  </li>
                }
              </ul>
              @if (!isExpanded() && entries.length >= previewCount) {
                <button
                  matButton
                  type="button"
                  class="mt-1"
                  (click)="expand()"
                  data-testid="connection-see-all"
                >
                  {{ 'settings.connections.seeAll' | transloco }}
                </button>
              }
            }
          } @else {
            <button
              matButton
              type="button"
              (click)="preview()"
              data-testid="connection-load-activity"
            >
              {{ 'settings.connections.showActions' | transloco }}
            </button>
          }
        </section>
      }

      <footer class="flex justify-end">
        <button
          matButton="outlined"
          type="button"
          class="warn-theme"
          (click)="revoke.emit()"
          data-testid="connection-revoke-button"
        >
          {{ 'settings.connections.revoke' | transloco }}
        </button>
      </footer>
    </article>
  `,
})
export class ConnectionCard {
  readonly connection = input.required<McpConnection>();
  /** Fetches the newest entries; the parent owns the API. */
  readonly loadActivity =
    input.required<(limit: number) => Promise<McpActivity[]>>();
  readonly revoke = output<void>();

  protected readonly previewCount = PREVIEW_COUNT;
  protected readonly activity = signal<McpActivity[] | null>(null);
  protected readonly isExpanded = signal(false);

  protected async preview(): Promise<void> {
    this.activity.set(await this.loadActivity()(PREVIEW_COUNT));
  }

  protected async expand(): Promise<void> {
    this.isExpanded.set(true);
    this.activity.set(await this.loadActivity()(FULL_COUNT));
  }
}
