import { Injectable, inject, signal, computed } from '@angular/core';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';
import type { NgxTurnstileComponent } from 'ngx-turnstile';

const TURNSTILE_TIMEOUT_MS = 5000;

const ERROR_MESSAGES = {
  TURNSTILE_FAILED: 'Échec de la vérification de sécurité. Veuillez réessayer.',
} as const;

@Injectable({ providedIn: 'root' })
export class TurnstileService {
  readonly #config = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);

  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #resolutionHandled = false;
  #onTokenCallback: ((token: string) => void) | null = null;
  #onErrorCallback: ((message: string) => void) | null = null;

  readonly #isProcessing = signal(false);
  readonly #shouldRender = signal(false);

  readonly isProcessing = this.#isProcessing.asReadonly();
  readonly shouldRender = this.#shouldRender.asReadonly();
  readonly siteKey = computed(() => this.#config.turnstile().siteKey);
  readonly shouldUseTurnstile = computed(() => !this.#config.isLocal());

  startVerification(
    widget: NgxTurnstileComponent | undefined,
    onToken: (token: string) => void,
    onError: (message: string) => void,
  ): void {
    this.#isProcessing.set(true);
    this.#resolutionHandled = false;
    this.#onTokenCallback = onToken;
    this.#onErrorCallback = onError;

    if (this.#isE2EBypass()) {
      this.#logger.debug('E2E demo bypass detected, skipping Turnstile');
      this.#resolveWithToken('');
      return;
    }

    if (!this.shouldUseTurnstile()) {
      this.#logger.debug('Turnstile skipped in local environment');
      this.#resolveWithToken('');
      return;
    }

    if (this.#isSafariIOS()) {
      this.#logger.info('Safari iOS detected, bypassing Turnstile');
      this.#resolveWithToken('');
      return;
    }

    this.#timeoutId = setTimeout(() => {
      this.#handleTimeout();
    }, TURNSTILE_TIMEOUT_MS);

    if (widget) {
      this.#logger.debug('Resetting existing Turnstile widget');
      widget.reset();
    } else {
      this.#logger.debug('Rendering new Turnstile widget');
      this.#shouldRender.set(true);
    }
  }

  handleResolved(token: string | null): void {
    this.#clearTimeout();

    if (this.#resolutionHandled) {
      this.#logger.debug('Turnstile resolution already handled, ignoring');
      return;
    }
    this.#resolutionHandled = true;

    if (!token) {
      this.#logger.error('Turnstile resolved with null token');
      this.#handleError(ERROR_MESSAGES.TURNSTILE_FAILED);
      return;
    }

    this.#logger.debug('Turnstile resolved', { tokenLength: token.length });
    this.#resolveWithToken(token);
  }

  handleError(): void {
    this.#clearTimeout();
    this.#logger.error('Turnstile verification failed');
    this.#handleError(ERROR_MESSAGES.TURNSTILE_FAILED);
  }

  reset(): void {
    this.#clearTimeout();
    this.#isProcessing.set(false);
    this.#shouldRender.set(false);
    this.#resolutionHandled = false;
    this.#onTokenCallback = null;
    this.#onErrorCallback = null;
  }

  isSafariIOS(): boolean {
    return this.#isSafariIOS();
  }

  #isE2EBypass(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window as { __E2E_DEMO_BYPASS__?: boolean }).__E2E_DEMO_BYPASS__ === true
    );
  }

  #isSafariIOS(): boolean {
    if (typeof navigator === 'undefined') return false;

    const ua = navigator.userAgent;
    const isTouchCapable =
      'maxTouchPoints' in navigator && navigator.maxTouchPoints > 1;

    const isIOS =
      /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && isTouchCapable);

    const isSafari =
      /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

    return isIOS && isSafari;
  }

  #handleTimeout(): void {
    if (this.#resolutionHandled) {
      this.#logger.debug('Turnstile already resolved, ignoring timeout');
      return;
    }
    this.#resolutionHandled = true;

    this.#logger.warn('Turnstile timeout (5s) - bypassing verification');
    this.#clearTimeout();
    this.#shouldRender.set(false);
    this.#resolveWithToken('');
  }

  #clearTimeout(): void {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
  }

  #resolveWithToken(token: string): void {
    this.#shouldRender.set(false);
    this.#onTokenCallback?.(token);
    this.#isProcessing.set(false);
  }

  #handleError(message: string): void {
    this.#isProcessing.set(false);
    this.#shouldRender.set(false);
    this.#resolutionHandled = false;
    this.#onErrorCallback?.(message);
  }
}
