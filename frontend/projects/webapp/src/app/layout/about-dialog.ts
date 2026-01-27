import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'pulpe-about-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <h2 mat-dialog-title class="text-headline-small">À propos</h2>

    <mat-dialog-content>
      <div class="flex flex-col gap-6">
        @for (section of sections; track section.label) {
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
            Mentions légales
          </h3>
          <div class="flex flex-col gap-1">
            <a
              class="text-body-medium text-primary py-1 hover:underline"
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
              (click)="close()"
            >
              Conditions Générales d'Utilisation
            </a>
            <a
              class="text-body-medium text-primary py-1 hover:underline"
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
              (click)="close()"
            >
              Politique de Confidentialité
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
        Fermer
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutDialog {
  readonly #dialogRef = inject(MatDialogRef<AboutDialog>);
  readonly #applicationConfig = inject(ApplicationConfiguration);

  protected readonly ROUTES = ROUTES;

  readonly sections: readonly DebugInfoSection[] = this.#buildSections();

  close(): void {
    this.#dialogRef.close();
  }

  #buildSections(): DebugInfoSection[] {
    const config = this.#applicationConfig;

    return [
      {
        label: 'Build',
        items: [
          { label: 'Version', value: buildInfo.version },
          { label: 'Commit', value: buildInfo.shortCommitHash },
          { label: 'Date', value: this.#formatDate(buildInfo.buildDate) },
        ],
      },
      {
        label: 'Environnement',
        items: [{ label: 'Mode', value: config.environment() }],
      },
      {
        label: 'Configuration',
        items: [
          {
            label: 'Supabase URL',
            value: this.#truncateUrl(config.supabaseUrl()),
          },
          {
            label: 'Backend URL',
            value: this.#truncateUrl(config.backendApiUrl()),
          },
        ],
      },
      {
        label: 'Analytics',
        items: [
          {
            label: 'PostHog',
            value: config.postHog().enabled ? 'Actif' : 'Inactif',
          },
          { label: 'Host', value: this.#truncateUrl(config.postHog().host) },
        ],
      },
    ];
  }

  #formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString('fr-FR', {
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
    if (!url) return 'Non configuré';
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      return url;
    }
  }
}
