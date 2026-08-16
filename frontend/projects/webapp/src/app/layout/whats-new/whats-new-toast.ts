import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { StorageService } from '@core/storage/storage.service';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { CURRENT_APP_VERSION } from '@core/app-version/current-app-version';
import { featuresForLocale, LATEST_RELEASE } from './whats-new-releases';

@Component({
  selector: 'pulpe-whats-new-toast',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      <div class="toast" data-testid="whats-new-toast">
        <div class="flex items-start gap-3">
          <mat-icon class="text-primary shrink-0 mt-0.5">auto_awesome</mat-icon>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-title-small font-medium text-on-surface">{{
                'layout.whatsNewTitle' | transloco: { version: version }
              }}</span>
              <button
                mat-icon-button
                class="shrink-0 -mr-2 -mt-2"
                [attr.aria-label]="'common.close' | transloco"
                data-testid="whats-new-dismiss-button"
                (click)="dismiss()"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <ul class="mt-2 space-y-1 text-body-small text-on-surface-variant">
              @for (feature of features(); track feature) {
                <li class="flex items-start gap-1.5">
                  <span
                    class="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0"
                  ></span>
                  <span>{{ feature }}</span>
                </li>
              }
            </ul>
            <a
              [href]="changelogUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 mt-3 text-label-medium text-primary hover:underline"
              data-testid="whats-new-changelog-link"
            >
              {{ 'layout.whatsNewSeeAll' | transloco }}
              <mat-icon class="text-base!">open_in_new</mat-icon>
            </a>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 1000;
        max-width: 360px;
        width: calc(100vw - 32px);
        pointer-events: none;
      }

      .toast {
        pointer-events: auto;
        background: var(--mat-sys-surface-container-high);
        border-radius: var(--pulpe-surface-radius-panel);
        box-shadow: var(--mat-sys-level2);
        padding: 16px;
        animation: pulpe-whats-new-enter var(--pulpe-motion-base)
          var(--pulpe-ease-emphasized);
      }

      @keyframes pulpe-whats-new-enter {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .toast {
          animation: none;
        }
      }

      @media (max-width: 599.98px) {
        :host {
          left: 16px;
          right: 16px;
          bottom: 16px;
          max-width: none;
          width: auto;
        }
      }
    `,
  ],
})
export class WhatsNewToast {
  readonly #storageService = inject(StorageService);
  readonly #transloco = inject(TranslocoService);
  readonly #locale = toSignal(this.#transloco.langChanges$, {
    initialValue: this.#transloco.getActiveLang(),
  });

  protected readonly release = LATEST_RELEASE;
  protected readonly version = inject(CURRENT_APP_VERSION);
  protected readonly features = computed(() =>
    featuresForLocale(this.#locale()),
  );
  protected readonly changelogUrl = computed(() => {
    const locale = this.#locale();
    return locale === 'fr'
      ? 'https://pulpe.app/changelog'
      : `https://pulpe.app/${locale}/changelog`;
  });

  readonly #isVisible = signal(this.#shouldShow());
  protected readonly isVisible = this.#isVisible.asReadonly();

  #shouldShow(): boolean {
    if (LATEST_RELEASE.version !== this.version) return false;
    const dismissed = this.#storageService.get<string>(
      STORAGE_KEYS.WHATS_NEW_DISMISSED,
    );
    return dismissed !== this.version;
  }

  protected dismiss(): void {
    this.#storageService.set(STORAGE_KEYS.WHATS_NEW_DISMISSED, this.version);
    this.#isVisible.set(false);
  }
}
