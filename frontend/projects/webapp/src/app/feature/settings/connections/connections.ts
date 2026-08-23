import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { McpConnection } from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { ConnectionsStore } from './connections-store';
import { ConnectionCard } from './ui/connection-card';

/** Settings > Connexions: the visible side of the promise made on the consent page. */
@Component({
  selector: 'pulpe-connections',
  imports: [TranslocoPipe, BaseLoading, StateCard, ConnectionCard],
  providers: [ConnectionsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col gap-6 h-full min-w-0"
      data-testid="connections-page"
    >
      <header class="pulpe-page-header" data-testid="page-header">
        <div class="min-w-0">
          <h1
            class="text-headline-medium md:text-display-small font-bold truncate"
            data-testid="page-title"
          >
            {{ 'settings.connections.title' | transloco }}
          </h1>
          <p class="text-body-medium text-on-surface-variant mt-1">
            {{ 'settings.connections.subtitle' | transloco }}
          </p>
        </div>
      </header>

      @switch (store.status()) {
        @case ('loading') {
          <pulpe-base-loading
            [message]="'settings.connections.loading' | transloco"
            size="large"
            testId="connections-loading"
          />
        }
        @case ('error') {
          <pulpe-state-card
            variant="error"
            [title]="'settings.connections.errorTitle' | transloco"
            [message]="'settings.connections.errorMessage' | transloco"
            [actionLabel]="'common.retry' | transloco"
            (action)="store.reload()"
            testId="connections-error"
          />
        }
        @default {
          @if (store.connections().length === 0) {
            <pulpe-state-card
              variant="empty"
              [title]="'settings.connections.emptyTitle' | transloco"
              [message]="'settings.connections.emptyMessage' | transloco"
              testId="connections-empty"
            />
          } @else {
            <div class="space-y-4" data-testid="connections-list">
              @for (connection of store.connections(); track connection.id) {
                <pulpe-connection-card
                  [connection]="connection"
                  [loadActivity]="activityLoader(connection)"
                  (revoke)="onRevoke(connection)"
                />
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export default class Connections {
  protected readonly store = inject(ConnectionsStore);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

  protected activityLoader(connection: McpConnection) {
    return (limit: number) => this.store.loadActivity(connection.id, limit);
  }

  protected async onRevoke(connection: McpConnection): Promise<void> {
    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: {
        title: this.#transloco.translate('settings.connections.revokeTitle', {
          client: connection.clientName,
        }),
        message: this.#transloco.translate(
          'settings.connections.revokeMessage',
          { client: connection.clientName },
        ),
        confirmText: this.#transloco.translate('settings.connections.revoke'),
        cancelText: this.#transloco.translate('common.cancel'),
        confirmColor: 'warn',
      } satisfies ConfirmationDialogData,
      width: '400px',
    });
    if ((await firstValueFrom(dialogRef.afterClosed())) !== true) return;

    const failure = await this.store.revoke(connection.id);
    this.#snackBar.open(
      this.#transloco.translate(
        failure ?? 'settings.connections.revokeSuccess',
        { client: connection.clientName },
      ),
      undefined,
      { duration: 4000 },
    );
  }
}
