import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';
import { ErrorResponseDto } from '@common/dto/response.dto';
import type { WhatsNewResponse } from 'pulpe-shared';
import { GetWhatsNewUseCase } from '../../application/get-whats-new.use-case';
import {
  WhatsNewQueryDto,
  WhatsNewResponseDto,
} from './dto/whats-new-swagger.dto';

/**
 * Authenticated release-notes feed, one route per mobile platform. Clients pass
 * their current bundle version and the last version whose notes they have
 * already seen; the endpoint returns the user-facing releases in between,
 * oldest first, so a user who skipped several versions gets one chronological
 * digest.
 *
 * The two routes are not interchangeable: `currentVersion` is read in the
 * calling platform's own numbering — App Store marketing versions on iOS, repo
 * versions on Android.
 */
@ApiTags('WhatsNew')
@ApiBearerAuth()
@Controller({ path: 'whats-new', version: '1' })
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'Authentication required',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Internal server error',
  type: ErrorResponseDto,
})
export class WhatsNewController {
  constructor(private readonly getWhatsNewUseCase: GetWhatsNewUseCase) {}

  @Get('ios')
  @ApiOperation({
    summary: "Get iOS release notes since the client's last-seen version",
    description:
      'Returns iOS user-facing release notes strictly newer than ' +
      '`lastSeenVersion` and up to (and including) `currentVersion`, ordered ' +
      'oldest first. Versions are App Store marketing versions. Releases with ' +
      'only technical changes are never returned.',
  })
  @ApiQuery({ name: 'currentVersion', example: '1.1.0' })
  @ApiQuery({ name: 'lastSeenVersion', example: '1.0.0' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated iOS release notes',
    type: WhatsNewResponseDto,
  })
  getIos(@Query() query: WhatsNewQueryDto): WhatsNewResponse {
    return this.getWhatsNewUseCase.execute(query, 'ios');
  }

  @Get('android')
  @ApiOperation({
    summary: "Get Android release notes since the client's last-seen version",
    description:
      'Returns Android user-facing release notes strictly newer than ' +
      '`lastSeenVersion` and up to (and including) `currentVersion`, ordered ' +
      'oldest first. Versions are repo versions, which the Android bundle ' +
      'ships verbatim. Releases with only technical changes are never returned.',
  })
  @ApiQuery({ name: 'currentVersion', example: '0.43.0' })
  @ApiQuery({ name: 'lastSeenVersion', example: '0.42.0' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated Android release notes',
    type: WhatsNewResponseDto,
  })
  getAndroid(@Query() query: WhatsNewQueryDto): WhatsNewResponse {
    return this.getWhatsNewUseCase.execute(query, 'android');
  }
}
