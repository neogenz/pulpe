import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { ROUTES } from '@core/routing/routes-constants';
import { buildInfo } from '@env/build-info';

interface DebugInfoSection {
  readonly label: string;
  readonly items: readonly DebugInfoItem[];
}

interface DebugInfoItem {
  readonly label: string;
  readonly value: string;
}

const LONG_PRESS_DURATION_MS = 10_000;

@Component({
  selector: 'pulpe-about-dialog',
  imports: [MatDialogModule, MatButtonModule, RouterLink, TranslocoPipe],
  template: `
    <h2
      mat-dialog-title
      class="text-headline-small select-none"
      (mousedown)="startLongPress()"
      (mouseup)="cancelLongPress()"
      (mouseleave)="cancelLongPress()"
      (touchstart)="startLongPress()"
      (touchend)="cancelLongPress()"
      (touchcancel)="cancelLongPress()"
    >
      {{ 'about.title' | transloco }}
    </h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-6">
        @for (section of visibleSections(); track section.label) {
          <div>
            <h3 class="text-label-large text-on-surface-variant mb-2">
              {{ section.label }}
            </h3>
            <div class="flex flex-col gap-1">
              @for (item of section.items; track item.label) {
                <div class="flex justify-between gap-4 py-1">
                  <span class="text-body-medium text-on-surface-variant">
                    {{ item.label }}
                  </span>
                  <span
                    class="text-body-medium text-on-surface font-mono text-right"
                  >
                    {{ item.value }}
                  </span>
                </div>
              }
            </div>
          </div>
        }
        <div>
          <h3 class="text-label-large text-on-surface-variant mb-2">
            {{ 'about.links' | transloco }}
          </h3>
          <div class="flex flex-col gap-1">
            <a
              class="text-body-medium text-primary py-1 hover:underline"
              href="https://pulpe.app/changelog"
              target="_blank"
              rel="noopener"
            >
              {{ 'about.newFeatures' | transloco }}
            </a>
            <a
              class="text-body-medium text-primary py-1 hover:underline"
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
              (click)="close()"
            >
              {{ 'about.termsOfService' | transloco }}
            </a>
            <a
              class="text-body-medium text-primary py-1 hover:underline"
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
              (click)="close()"
            >
              {{ 'about.privacyPolicy' | transloco }}
            </a>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        matButton="filled"
        (click)="close()"
        data-testid="about-close-button"
      >
        {{ 'about.close' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      mat-dialog-content {
        min-width: 320px;
        max-width: 480px;
      }

      h2 {
        -webkit-touch-callout: none;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutDialog {
  readonly #dialogRef = inject(MatDialogRef<AboutDialog>);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #destroyRef = inject(DestroyRef);
  readonly #locale = inject(LOCALE_ID);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  readonly #isDebugVisible = signal(false);
  #longPressTimer: ReturnType<typeof setTimeout> | null = null;

  readonly sections: readonly DebugInfoSection[] = [
    {
      label: this.#transloco.translate('about.buildSection'),
      items: [
        {
          label: this.#transloco.translate('about.version'),
          value: buildInfo.version,
        },
        {
          label: this.#transloco.translate('about.commit'),
          value: buildInfo.shortCommitHash,
        },
        {
          label: this.#transloco.translate('about.date'),
          value: this.#formatDate(buildInfo.buildDate),
        },
      ],
    },
  ];

  readonly #debugSections: readonly DebugInfoSection[] =
    this.#buildDebugSections();

  protected readonly visibleSections = computed(() =>
    this.#isDebugVisible()
      ? [...this.sections, ...this.#debugSections]
      : this.sections,
  );

  constructor() {
    this.#destroyRef.onDestroy(() => this.#clearLongPressTimer());
  }

  close(): void {
    this.#dialogRef.close();
  }

  protected startLongPress(): void {
    this.#clearLongPressTimer();
    this.#longPressTimer = setTimeout(() => {
      this.#isDebugVisible.set(true);
    }, LONG_PRESS_DURATION_MS);
  }

  protected cancelLongPress(): void {
    this.#clearLongPressTimer();
  }

  #clearLongPressTimer(): void {
    if (this.#longPressTimer) {
      clearTimeout(this.#longPressTimer);
      this.#longPressTimer = null;
    }
  }

  #buildDebugSections(): DebugInfoSection[] {
    const config = this.#applicationConfig;

    return [
      {
        label: this.#transloco.translate('about.environmentSection'),
        items: [
          {
            label: this.#transloco.translate('about.mode'),
            value: config.environment(),
          },
        ],
      },
      {
        label: this.#transloco.translate('about.configSection'),
        items: [
          {
            label: this.#transloco.translate('about.supabaseUrl'),
            value: this.#truncateUrl(config.supabaseUrl()),
          },
          {
            label: this.#transloco.translate('about.backendUrl'),
            value: this.#truncateUrl(config.backendApiUrl()),
          },
        ],
      },
      {
        label: this.#transloco.translate('about.analyticsSection'),
        items: [
          {
            label: this.#transloco.translate('about.postHog'),
            value: config.postHog().enabled
              ? this.#transloco.translate('about.active')
              : this.#transloco.translate('about.inactive'),
          },
          {
            label: this.#transloco.translate('about.host'),
            value: this.#truncateUrl(config.postHog().host),
          },
        ],
      },
    ];
  }

  #formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString(this.#locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  #truncateUrl(url: string): string {
    if (!url) return this.#transloco.translate('about.notConfigured');
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      return url;
    }
  }
}
