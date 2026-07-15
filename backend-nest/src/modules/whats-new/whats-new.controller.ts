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
import { GetIosWhatsNewUseCase } from './application/get-ios-whats-new.use-case';
import {
  WhatsNewQueryDto,
  WhatsNewResponseDto,
} from './dto/whats-new-swagger.dto';

/**
 * Authenticated iOS release-notes feed. Clients pass their current bundle
 * version and the last version whose notes they have already seen; the endpoint
 * returns the iOS user-facing releases in between, oldest first, so a user who
 * skipped several versions gets one chronological digest.
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
  constructor(private readonly getIosWhatsNewUseCase: GetIosWhatsNewUseCase) {}

  @Get('ios')
  @ApiOperation({
    summary: "Get iOS release notes since the client's last-seen version",
    description:
      'Returns iOS user-facing release notes strictly newer than ' +
      '`lastSeenVersion` and up to (and including) `currentVersion`, ordered ' +
      'oldest first. Releases with only technical changes are never returned.',
  })
  @ApiQuery({ name: 'currentVersion', example: '1.1.0' })
  @ApiQuery({ name: 'lastSeenVersion', example: '1.0.0' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated iOS release notes',
    type: WhatsNewResponseDto,
  })
  getIos(@Query() query: WhatsNewQueryDto): WhatsNewResponse {
    return this.getIosWhatsNewUseCase.execute(query);
  }
}
