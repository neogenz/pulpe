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
import { AppVersionResponseDto } from './dto/app-version-swagger.dto';

/**
 * Public, unauthenticated force-update gate.
 *
 * Clients hit this endpoint on launch + foreground, compare the returned
 * `minVersion` against their bundle version, and block the UI behind an
 * update wall when below the floor. **No `AuthGuard`** — must work pre-login.
 * Rate-limited by the global `UserThrottlerGuard` via the `public` throttler
 * (20 req/min/IP in prod). Response is cacheable for 5 minutes — version
 * values change rarely (env-driven) and an old cached payload is harmless.
 */
@ApiTags('App')
@Controller({ path: 'app', version: '1' })
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class AppVersionController {
  constructor(private readonly configService: ConfigService) {}

  @Get('version')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Get minimum supported app version per platform',
    description:
      'Public endpoint consumed by clients on launch and foreground. ' +
      'Returns the platform-specific minimum supported version, latest ' +
      'published version, and store URL. Clients render a forced-update ' +
      'wall when their bundle version falls below `minVersion`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Version requirements per platform',
    type: AppVersionResponseDto,
  })
  getVersion(): AppVersionResponse {
    return buildAppVersionResponse(this.configService);
  }
}
