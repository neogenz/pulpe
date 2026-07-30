import type { ConfigService } from '@nestjs/config';
import {
  appVersionResponseSchema,
  type AppVersionResponse,
} from 'pulpe-shared';
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
  return appVersionResponseSchema.parse({
    success: true,
    data: {
      ios: {
        minVersion: iosVersions.minVersion,
        latestVersion: iosVersions.latestVersion,
        storeUrl: configService.get('IOS_STORE_URL'),
      },
      web: {
        minVersion: configService.get('MIN_WEB_VERSION'),
        latestVersion: configService.get('LATEST_WEB_VERSION'),
      },
    },
  });
}
