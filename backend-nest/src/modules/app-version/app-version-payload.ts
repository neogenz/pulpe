import type { ConfigService } from '@nestjs/config';
import {
  appVersionResponseSchema,
  type AppVersionResponse,
} from 'pulpe-shared';
import { PRODUCT_VERSION } from '@config/product-version';
import { isVersionAtMost } from '@common/utils/semver-compare';
import type { IosVersionGate } from './ios-version-gate.service';

/**
 * Builds the payload served at `GET /api/v1/app/version`.
 *
 * Web values and the store URL come from `ConfigService` (validated at boot by
 * the `envSchema` Zod schema); iOS versions come from `IosVersionGateService`,
 * which tracks what the App Store actually serves. Everything runs through
 * `appVersionResponseSchema` for a final shape check, so any drift from the
 * shared contract surfaces here as a Zod error.
 */
export function buildAppVersionResponse(
  configService: ConfigService,
  iosVersions: IosVersionGate,
): AppVersionResponse {
  const configuredWebMinimum = configService.get<string>('MIN_WEB_VERSION')!;
  const webMinimum = isVersionAtMost(configuredWebMinimum, PRODUCT_VERSION)
    ? configuredWebMinimum
    : PRODUCT_VERSION;

  return appVersionResponseSchema.parse({
    success: true,
    data: {
      ios: {
        minVersion: iosVersions.minVersion,
        latestVersion: iosVersions.latestVersion,
        storeUrl: configService.get('IOS_STORE_URL'),
      },
      web: {
        minVersion: webMinimum,
        latestVersion: PRODUCT_VERSION,
      },
    },
  });
}
