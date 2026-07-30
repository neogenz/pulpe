import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { isVersionAtMost } from '@common/utils/semver-compare';

const APP_STORE_LOOKUP_URL = 'https://itunes.apple.com/lookup';
const APP_STORE_ID_PATTERN = /id(\d+)/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const LOOKUP_TIMEOUT_MS = 3_000;
const FRESH_TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_TTL_MS = 15 * 60 * 1000;

export interface IosVersionGate {
  minVersion: string;
  latestVersion: string;
}

/**
 * Publishes the iOS half of the force-update gate served by
 * `GET /api/v1/app/version`.
 *
 * `latestVersion` follows what Apple actually distributes: the App Store
 * lookup endpoint is polled lazily (first request after the TTL triggers a
 * background refresh, no request ever waits on Apple) and the result is
 * capped below by `LATEST_IOS_VERSION`, which stays as an offline fallback and
 * manual override. A release therefore needs no Railway variable update once
 * Apple approves the build.
 *
 * `minVersion` is clamped to `latestVersion`: the gate can never force users
 * onto a binary the App Store does not serve yet, so `MIN_IOS_VERSION` can be
 * set ahead of the rollout and activates on its own once the version is live.
 */
@Injectable()
export class IosVersionGateService {
  #publishedVersion: string | null = null;
  #refreshAfter = 0;
  #isRefreshing = false;
  #warnedClamp: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectInfoLogger(IosVersionGateService.name)
    private readonly logger: InfoLogger,
  ) {}

  resolve(): IosVersionGate {
    this.#refreshWhenStale();

    const configuredMin = this.configService.get<string>('MIN_IOS_VERSION')!;
    const latestVersion = this.#resolveLatestVersion();

    if (isVersionAtMost(configuredMin, latestVersion)) {
      return { minVersion: configuredMin, latestVersion };
    }

    this.#warnUnreachableFloor(configuredMin, latestVersion);
    return { minVersion: latestVersion, latestVersion };
  }

  #resolveLatestVersion(): string {
    const configured = this.configService.get<string>('LATEST_IOS_VERSION')!;
    if (!this.#publishedVersion) {
      return configured;
    }
    return isVersionAtMost(this.#publishedVersion, configured)
      ? configured
      : this.#publishedVersion;
  }

  #refreshWhenStale(): void {
    if (this.#isRefreshing || Date.now() < this.#refreshAfter) {
      return;
    }
    this.#isRefreshing = true;
    void this.#refreshPublishedVersion().finally(() => {
      this.#isRefreshing = false;
    });
  }

  async #refreshPublishedVersion(): Promise<void> {
    try {
      const version = await this.#fetchPublishedVersion();
      if (version !== this.#publishedVersion) {
        this.logger.info(
          { operation: 'refreshPublishedVersion', version },
          'App Store version resolved',
        );
      }
      this.#publishedVersion = version;
      this.#refreshAfter = Date.now() + FRESH_TTL_MS;
    } catch (error) {
      this.#refreshAfter = Date.now() + RETRY_TTL_MS;
      this.logger.warn(
        {
          operation: 'refreshPublishedVersion',
          err: error instanceof Error ? error : undefined,
        },
        'App Store lookup failed, serving the configured LATEST_IOS_VERSION',
      );
    }
  }

  async #fetchPublishedVersion(): Promise<string> {
    const storeUrl = this.configService.get<string>('IOS_STORE_URL') ?? '';
    const appStoreId = APP_STORE_ID_PATTERN.exec(storeUrl)?.[1];
    if (!appStoreId) {
      throw new Error('IOS_STORE_URL carries no App Store identifier');
    }

    const response = await fetch(`${APP_STORE_LOOKUP_URL}?id=${appStoreId}`, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`App Store lookup returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: { version?: string }[];
    };
    const version = payload.results?.[0]?.version;
    if (!version || !SEMVER_PATTERN.test(version)) {
      throw new Error(
        `App Store lookup returned an unusable version: ${version ?? 'none'}`,
      );
    }
    return version;
  }

  #warnUnreachableFloor(minVersion: string, latestVersion: string): void {
    const clamp = `${minVersion}>${latestVersion}`;
    if (this.#warnedClamp === clamp) {
      return;
    }
    this.#warnedClamp = clamp;
    this.logger.warn(
      { operation: 'resolve', minVersion, latestVersion },
      'MIN_IOS_VERSION is above the version available on the App Store, serving the available one as the floor',
    );
  }
}
