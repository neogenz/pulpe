import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { LottieComponent, type AnimationOptions } from 'ngx-lottie';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MaintenanceApi } from '@core/maintenance';
import { LoadingButton } from '@ui/loading-button';

@Component({
  selector: 'pulpe-maintenance-page',
  imports: [LottieComponent, LoadingButton, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulpe-entry-shell pulpe-gradient">
      <div
        class="pulpe-entry-card w-full max-w-lg items-center gap-6 text-center"
      >
        <ng-lottie [options]="lottieOptions" class="w-48 h-48" />

        <h1 class="text-headline-large text-on-surface">
          {{ 'maintenance.title' | transloco }}
        </h1>

        <p class="text-body-large text-on-surface-variant">
          {{ 'maintenance.message' | transloco }}
        </p>

        @if (statusMessage()) {
          <p class="text-body-medium text-error">{{ statusMessage() }}</p>
        }

        <pulpe-loading-button
          [loading]="isChecking()"
          [disabled]="isChecking()"
          variant="filled"
          type="button"
          [loadingText]="'maintenance.retryLoading' | transloco"
          icon="refresh"
          testId="maintenance-reload-button"
          class="mt-4"
          (click)="checkAndReload()"
        >
          {{ 'maintenance.retry' | transloco }}
        </pulpe-loading-button>
      </div>
    </div>
  `,
})
export default class MaintenancePage {
  readonly #maintenanceApi = inject(MaintenanceApi);
  readonly #transloco = inject(TranslocoService);

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
        this.#transloco.translate('maintenance.stillDown'),
      );
    } catch {
      this.statusMessage.set(
        this.#transloco.translate('maintenance.checkFailed'),
      );
    } finally {
      this.isChecking.set(false);
    }
  }
}
