import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApplicationConfiguration } from '@core/config/application-configuration';

type ClientId = 'chatgpt' | 'claude';

@Component({
  selector: 'pulpe-connection-setup',
  imports: [
    NgTemplateOutlet,
    ClipboardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-labelledby="connection-setup-title"
      class="border-t border-outline-variant pt-8"
      data-testid="connection-setup"
    >
      @if (folded()) {
        <details class="group" data-testid="setup-fold">
          <summary
            class="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <h2 id="connection-setup-title" class="text-title-large">
              {{ 'settings.connections.setup.anotherTitle' | transloco }}
            </h2>
            <mat-icon class="group-open:rotate-180" aria-hidden="true"
              >expand_more</mat-icon
            >
          </summary>
          <div class="pt-4">
            <ng-container *ngTemplateOutlet="guide" />
          </div>
        </details>
      } @else {
        <h2 id="connection-setup-title" class="text-title-large mb-4">
          {{ 'settings.connections.setup.title' | transloco }}
        </h2>
        <ng-container *ngTemplateOutlet="guide" />
      }
    </section>

    <ng-template #guide>
      <div class="space-y-5 max-w-3xl">
        <p class="text-body-medium text-on-surface-variant">
          {{ 'settings.connections.setup.sharing' | transloco }}
        </p>
        <mat-button-toggle-group
          [value]="client()"
          (change)="client.set($event.value)"
          hideSingleSelectionIndicator
          [attr.aria-label]="
            'settings.connections.setup.clientLabel' | transloco
          "
          class="w-full sm:w-auto"
          data-testid="setup-client"
        >
          @for (c of clients(); track c.id) {
            <mat-button-toggle
              [value]="c.id"
              class="flex-1 sm:flex-none sm:min-w-32"
              [attr.data-testid]="'setup-client-' + c.id"
              >{{ c.name }}</mat-button-toggle
            >
          }
        </mat-button-toggle-group>

        <ol
          class="rounded-2xl bg-surface-container-low p-5 space-y-6"
          [attr.data-testid]="'setup-steps-' + current().id"
        >
          @for (step of [1, 2, 3]; track step) {
            <li class="flex gap-4">
              <span
                class="grid size-8 shrink-0 place-items-center rounded-full bg-primary-container text-label-large text-on-primary-container"
                aria-hidden="true"
                >{{ step }}</span
              >
              <div class="min-w-0 flex-1 space-y-3 pt-1">
                <p class="text-body-medium">
                  {{
                    'settings.connections.setup.' + current().id + 'Step' + step
                      | transloco
                  }}
                </p>
                @if (step === 1) {
                  <a
                    matButton="filled"
                    [href]="current().url"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.data-testid]="'connect-' + current().id"
                  >
                    <mat-icon>open_in_new</mat-icon>
                    {{
                      'settings.connections.setup.open'
                        | transloco: { client: current().name }
                    }}
                    <span class="sr-only">{{
                      'settings.connections.setup.newTab' | transloco
                    }}</span>
                  </a>
                }
                @if (step === 2 && current().id === 'chatgpt') {
                  <div
                    class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-outline-variant bg-surface px-4 py-2"
                  >
                    <span
                      class="min-w-0 text-body-medium select-all break-all"
                      data-testid="mcp-address"
                      >{{ mcpUrl() }}</span
                    >
                    <button
                      matButton
                      [cdkCopyToClipboard]="mcpUrl()"
                      (cdkCopyToClipboardCopied)="copySucceeded.set($event)"
                      data-testid="copy-mcp-address"
                    >
                      <mat-icon>content_copy</mat-icon>
                      {{ 'settings.connections.setup.copy' | transloco }}
                    </button>
                  </div>
                  <p
                    role="status"
                    class="text-body-small text-on-surface-variant empty:hidden"
                    data-testid="mcp-copy-status"
                  >
                    @if (copySucceeded() !== null) {
                      {{
                        (copySucceeded()
                          ? 'settings.connections.setup.copied'
                          : 'settings.connections.setup.copyFailed'
                        ) | transloco
                      }}
                    }
                  </p>
                }
              </div>
            </li>
          }
          <li class="flex gap-4">
            <span
              class="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-on-primary"
              aria-hidden="true"
              ><mat-icon class="mat-icon-sm">lock</mat-icon></span
            >
            <p class="min-w-0 flex-1 pt-1 text-body-medium">
              {{ 'settings.connections.setup.consentStep' | transloco }}
            </p>
          </li>
        </ol>

        <p class="text-body-small text-on-surface-variant">
          {{ 'settings.connections.setup.availability' | transloco }}
        </p>
      </div>
    </ng-template>
  `,
  styles: `
    summary {
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
  `,
})
export class ConnectionSetup {
  readonly #config = inject(ApplicationConfiguration);
  /** Once an assistant is connected, the guide steps aside behind a disclosure. */
  readonly folded = input(false);
  protected readonly mcpUrl = computed(
    () => new URL('/mcp', this.#config.backendApiUrl()).href,
  );
  protected readonly copySucceeded = signal<boolean | null>(null);
  protected readonly client = signal<ClientId>('chatgpt');
  protected readonly clients = computed(() => [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/plugins' },
    {
      id: 'claude',
      name: 'Claude',
      url: `https://claude.ai/customize/connectors?${new URLSearchParams({
        modal: 'add-custom-connector',
        connectorName: 'Pulpe',
        connectorUrl: this.mcpUrl(),
      })}`,
    },
  ]);
  protected readonly current = computed(
    () => this.clients().find((c) => c.id === this.client())!,
  );
}
