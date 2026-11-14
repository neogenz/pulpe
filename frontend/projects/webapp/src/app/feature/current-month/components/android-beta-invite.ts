import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ANALYTICS_EVENTS, FEATURE_FLAGS } from 'pulpe-shared';
import { PostHogService } from '@core/analytics';
import { StorageService, STORAGE_KEYS } from '@core/storage';

// Google Play only admits members of this group into the closed test, so
// joining it comes before the store page.
const TESTER_GROUP_URL = 'https://groups.google.com/g/pulpe-android-beta';
const PLAY_OPT_IN_URL =
  'https://play.google.com/apps/testing/app.pulpe.android';

/**
 * Invites someone browsing on an Android phone to try the Android app before
 * its release. It gates itself (flag, device, not dismissed) so the page that
 * hosts it carries a single tag and nothing to remove but that tag.
 */
@Component({
  selector: 'pulpe-android-beta-invite',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      <section
        class="flex items-start gap-3 rounded-3xl bg-surface-container-low p-4"
        aria-labelledby="android-beta-invite-title"
        data-testid="android-beta-invite-section"
      >
        <div
          class="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0!"
        >
          <mat-icon aria-hidden="true">android</mat-icon>
        </div>
        <div class="flex flex-col gap-1 min-w-0 flex-1">
          <h2
            id="android-beta-invite-title"
            class="text-title-medium font-bold text-on-surface leading-tight"
          >
            {{ 'androidBetaInvite.title' | transloco }}
          </h2>
          <p class="text-body-medium text-on-surface-variant">
            {{ 'androidBetaInvite.body' | transloco }}
          </p>
          <div class="flex flex-wrap gap-2 pt-2">
            <a
              matButton="tonal"
              [href]="groupUrl"
              target="_blank"
              rel="noopener noreferrer"
              (click)="trackStep('group')"
              data-testid="android-beta-invite-group-link"
            >
              {{ 'androidBetaInvite.joinGroup' | transloco }}
            </a>
            <a
              matButton
              [href]="playUrl"
              target="_blank"
              rel="noopener noreferrer"
              (click)="trackStep('install')"
              data-testid="android-beta-invite-install-link"
            >
              {{ 'androidBetaInvite.install' | transloco }}
            </a>
          </div>
        </div>
        <button
          matIconButton
          class="shrink-0 -mt-2 -mr-2"
          [attr.aria-label]="'androidBetaInvite.dismiss' | transloco"
          (click)="dismiss()"
          data-testid="android-beta-invite-dismiss-button"
        >
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    :host:empty {
      display: none;
    }
  `,
})
export class AndroidBetaInvite {
  readonly #postHog = inject(PostHogService);
  readonly #storage = inject(StorageService);
  readonly #isAndroid = /Android/i.test(
    inject(DOCUMENT).defaultView?.navigator.userAgent ?? '',
  );
  readonly #isDismissed = signal(
    this.#storage.get<boolean>(STORAGE_KEYS.ANDROID_BETA_INVITE_DISMISSED) ??
      false,
  );

  protected readonly groupUrl = TESTER_GROUP_URL;
  protected readonly playUrl = PLAY_OPT_IN_URL;

  protected readonly isVisible = computed(() => {
    this.#postHog.flagsVersion();
    return (
      this.#isAndroid &&
      !this.#isDismissed() &&
      this.#postHog.isFeatureEnabled(FEATURE_FLAGS.ANDROID_BETA_INVITE)
    );
  });

  protected trackStep(step: 'group' | 'install'): void {
    this.#postHog.captureEvent(ANALYTICS_EVENTS.ANDROID_BETA_INVITE_CLICKED, {
      step,
    });
  }

  protected dismiss(): void {
    this.#isDismissed.set(true);
    this.#storage.set(STORAGE_KEYS.ANDROID_BETA_INVITE_DISMISSED, true);
    this.#postHog.captureEvent(ANALYTICS_EVENTS.ANDROID_BETA_INVITE_DISMISSED);
  }
}
