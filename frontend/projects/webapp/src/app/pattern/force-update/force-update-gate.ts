import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { TranslocoPipe } from '@jsverse/transloco';

import { AppVersionStore } from '@core/app-version';
import { PAGE_RELOAD } from '@core/page-reload';

/**
 * Non-dismissable "update required" wall rendered above every route when the
 * running bundle is older than the server-published `web.minVersion`.
 * On web, updating = reloading the page to fetch the fresh index.html.
 */
@Component({
  selector: 'pulpe-force-update-gate',
  imports: [MatButtonModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isUpdateRequired()) {
      <div
        class="pulpe-entry-shell pulpe-gradient fixed inset-0 z-[9999]"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-label]="'forceUpdate.title' | transloco"
      >
        <div
          class="pulpe-entry-card w-full max-w-lg items-center gap-6 text-center"
        >
          <h1 class="text-headline-large text-on-surface">
            {{ 'forceUpdate.title' | transloco }}
          </h1>

          <p class="text-body-large text-on-surface-variant">
            {{ 'forceUpdate.message' | transloco }}
          </p>

          <button
            matButton="filled"
            type="button"
            data-testid="force-update-reload-button"
            class="mt-4"
            (click)="reloadPage()"
          >
            {{ 'forceUpdate.reload' | transloco }}
          </button>
        </div>
      </div>
    }
  `,
})
export class ForceUpdateGate {
  readonly #store = inject(AppVersionStore);
  readonly #reload = inject(PAGE_RELOAD);

  protected readonly isUpdateRequired = this.#store.isUpdateRequired;

  protected reloadPage(): void {
    this.#reload();
  }
}
