import type { ConfigService } from '@nestjs/config';
import {
  appVersionResponseSchema,
  type AppVersionResponse,
} from 'pulpe-shared';

/**
 * Builds the payload served at `GET /api/v1/app/version`.
 *
 * Reads version + store URL values from `ConfigService` (validated at boot by
 * the `envSchema` Zod schema) and runs them through `appVersionResponseSchema`
 * for a final shape check. Any drift between env values and the shared
 * contract surfaces here as a Zod error.
 */
export function buildAppVersionResponse(
  configService: ConfigService,
): AppVersionResponse {
  return appVersionResponseSchema.parse({
    success: true,
    data: {
      ios: {
        minVersion: configService.get('MIN_IOS_VERSION'),
        latestVersion: configService.get('LATEST_IOS_VERSION'),
        storeUrl: configService.get('IOS_STORE_URL'),
      },
      web: {
        minVersion: configService.get('MIN_WEB_VERSION'),
        latestVersion: configService.get('LATEST_WEB_VERSION'),
      },
    },
  });
}
