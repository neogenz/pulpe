import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApplicationConfiguration } from '@core/config/application-configuration';

@Component({
  selector: 'pulpe-connection-setup',
  imports: [ClipboardModule, MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-labelledby="connection-setup-title"
      class="space-y-4"
      data-testid="connection-setup"
    >
      <h2 id="connection-setup-title" class="text-title-large">
        {{ 'settings.connections.setup.title' | transloco }}
      </h2>
      <p class="text-body-medium text-on-surface-variant">
        {{ 'settings.connections.setup.sharing' | transloco }}
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        @for (client of clients(); track client.id) {
          <article
            class="bg-surface-container-low rounded-corner-large p-4 flex flex-col gap-4"
          >
            <h3 class="text-title-medium">{{ client.name }}</h3>
            <ol
              class="list-decimal pl-5 space-y-2 text-body-medium text-on-surface-variant"
            >
              @for (step of [1, 2, 3]; track step) {
                <li>
                  {{
                    'settings.connections.setup.' + client.id + 'Step' + step
                      | transloco
                  }}
                </li>
              }
            </ol>
            <a
              matButton="outlined"
              [href]="client.url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-auto self-start"
              [attr.data-testid]="'connect-' + client.id"
            >
              <mat-icon>open_in_new</mat-icon>
              {{
                'settings.connections.setup.open'
                  | transloco: { client: client.name }
              }}
              <span class="sr-only">{{
                'settings.connections.setup.newTab' | transloco
              }}</span>
            </a>
          </article>
        }
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <p class="text-body-medium min-w-0">
          {{ 'settings.connections.setup.address' | transloco }}
          <span class="select-all break-all" data-testid="mcp-address">{{
            mcpUrl()
          }}</span>
        </p>
        <button
          matButton
          [cdkCopyToClipboard]="mcpUrl()"
          (cdkCopyToClipboardCopied)="copySucceeded.set($event)"
          data-testid="copy-mcp-address"
        >
          <mat-icon>content_copy</mat-icon>
          {{ 'settings.connections.setup.copy' | transloco }}
        </button>
        <p
          role="status"
          class="text-body-small text-on-surface-variant"
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
      </div>
      <p class="text-body-small text-on-surface-variant">
        {{ 'settings.connections.setup.finish' | transloco }}
      </p>
      <p class="text-body-small text-on-surface-variant">
        {{ 'settings.connections.setup.availability' | transloco }}
      </p>
    </section>
  `,
})
export class ConnectionSetup {
  readonly #config = inject(ApplicationConfiguration);
  protected readonly mcpUrl = computed(
    () => new URL('/mcp', this.#config.backendApiUrl()).href,
  );
  protected readonly copySucceeded = signal<boolean | null>(null);
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
}
