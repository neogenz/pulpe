import type { ConfigService } from '@nestjs/config';
import {
  appVersionResponseSchema,
  type AppVersionResponse,
} from 'pulpe-shared';
import { PRODUCT_VERSION } from '../../config/product-version';
import type { IosVersionGate } from './ios-version-gate.service';

/**
 * Builds the payload served at `GET /api/v1/app/version`.
 *
 * Minimum web policy and Android values come from `ConfigService` (validated
 * at boot by the `envSchema` Zod schema); the latest web version comes from
 * this backend artifact. iOS versions come from `IosVersionGateService`, which
 * tracks what the App Store actually serves. Everything runs through
 * `appVersionResponseSchema` for a final shape check.
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
      android: {
        minVersion: configService.get('MIN_ANDROID_VERSION'),
        latestVersion: configService.get('LATEST_ANDROID_VERSION'),
        storeUrl: configService.get('ANDROID_STORE_URL'),
      },
      web: {
        minVersion: configService.get('MIN_WEB_VERSION'),
        latestVersion: PRODUCT_VERSION,
      },
    },
  });
}
