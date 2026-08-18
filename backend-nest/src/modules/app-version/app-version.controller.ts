import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '@common/dto/response.dto';
import type { AppVersionResponse } from 'pulpe-shared';
import { buildAppVersionResponse } from './app-version-payload';
import { IosVersionGateService } from './ios-version-gate.service';
import { AppVersionResponseDto } from './dto/app-version-swagger.dto';

/**
 * Public, unauthenticated app-version policy.
 *
 * Clients hit this endpoint on launch + foreground, compare the returned
 * `minVersion` against their bundle version, and block the UI behind an
 * update wall when below the floor. iOS also uses `latestVersion` for a
 * dismissible App Store prompt. **No `AuthGuard`** — must work pre-login.
 * Rate-limited by the global `UserThrottlerGuard` via the `public` throttler
 * (20 req/min/IP in prod). Response is cacheable for 5 minutes — version
 * values change rarely and an old cached payload is harmless. iOS values come
 * from `IosVersionGateService` (App Store-tracked), web values from env.
 */
@ApiTags('App')
@Controller({ path: 'app', version: '1' })
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class AppVersionController {
  constructor(
    private readonly configService: ConfigService,
    private readonly iosVersionGate: IosVersionGateService,
  ) {}

  @Get('version')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Get minimum supported app version per platform',
    description:
      'Public endpoint consumed by clients on launch and foreground. ' +
      'Returns the platform-specific minimum supported version, latest ' +
      'published version, and store URL. Clients render a forced-update ' +
      'wall below `minVersion`; iOS offers a dismissible App Store prompt ' +
      'below `latestVersion`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Version requirements per platform',
    type: AppVersionResponseDto,
  })
  getVersion(): AppVersionResponse {
    return buildAppVersionResponse(
      this.configService,
      this.iosVersionGate.resolve(),
    );
  }
}
