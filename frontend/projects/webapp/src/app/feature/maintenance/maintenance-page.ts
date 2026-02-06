import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { MaintenanceApi } from '@core/maintenance';
import { LoadingButton } from '@ui/loading-button';

@Component({
  selector: 'pulpe-maintenance-page',
  imports: [LottieComponent, LoadingButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulpe-entry-shell pulpe-gradient">
      <div
        class="pulpe-entry-card w-full max-w-lg items-center gap-6 text-center"
      >
        <ng-lottie [options]="lottieOptions" class="w-48 h-48" />

        <h1 class="text-headline-large text-on-surface">
          Maintenance en cours
        </h1>

        <p class="text-body-large text-on-surface-variant">
          On améliore Pulpe pour toi — tes données sont bien au chaud, pas
          d'inquiétude. Réessaie dans quelques instants.
        </p>

        @if (statusMessage()) {
          <p class="text-body-medium text-error">{{ statusMessage() }}</p>
        }

        <pulpe-loading-button
          [loading]="isChecking()"
          [disabled]="isChecking()"
          variant="filled"
          type="button"
          loadingText="Vérification..."
          icon="refresh"
          testId="maintenance-reload-button"
          class="mt-4"
          (click)="checkAndReload()"
        >
          Réessayer
        </pulpe-loading-button>
      </div>
    </div>
  `,
})
export default class MaintenancePage {
  readonly #maintenanceApi = inject(MaintenanceApi);

  protected readonly isChecking = signal(false);
  protected readonly statusMessage = signal('');

  protected readonly lottieOptions: AnimationOptions = {
    path: '/lottie/maintenance-animation.json',
    loop: true,
    autoplay: true,
    renderer: 'svg',
  };

  async checkAndReload(): Promise<void> {
    this.isChecking.set(true);
    this.statusMessage.set('');

    try {
      const data = await this.#maintenanceApi.checkStatus();
      if (!data.maintenanceMode) {
        window.location.href = '/';
        return;
      }
      this.statusMessage.set(
        'Toujours en maintenance — réessaie dans un instant',
      );
    } catch {
      this.statusMessage.set('Connexion difficile — réessaie dans un instant');
    } finally {
      this.isChecking.set(false);
    }
  }
}
