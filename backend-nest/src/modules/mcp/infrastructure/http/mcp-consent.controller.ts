import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  McpConsentDetailsResponse,
  McpConsentRedirectResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import { SkipClientKey } from '@common/decorators/skip-client-key.decorator';
import {
  type AuthenticatedUser,
  User,
} from '@common/decorators/user.decorator';
import { ApproveConnectionUseCase } from '../../application/approve-connection.use-case';
import { DenyConnectionUseCase } from '../../application/deny-connection.use-case';
import {
  OAUTH_AUTHORIZATION_PORT,
  type OAuthAuthorizationPort,
} from '../../domain/ports/oauth-authorization.port';
import {
  McpConsentApproveRequestDto,
  McpConsentDetailsResponseDto,
  McpConsentRedirectResponseDto,
} from './dto/mcp-swagger.dto';

/**
 * The Pulpe consent page talks to this controller, never to GoTrue directly.
 * `approve` is the only route that needs the vault key: `AuthGuard` proves
 * the PIN-derived `X-Client-Key` against the key check before the grant is
 * written, so a wrong PIN never leaves a connection behind.
 */
@ApiTags('MCP')
@Controller({ path: 'mcp/consent', version: '1' })
@UseGuards(AuthGuard)
export class McpConsentController {
  constructor(
    @Inject(OAUTH_AUTHORIZATION_PORT)
    private readonly authorizations: OAuthAuthorizationPort,
    private readonly approveConnection: ApproveConnectionUseCase,
    private readonly denyConnection: DenyConnectionUseCase,
  ) {}

  @SkipClientKey()
  @Get(':authorizationId')
  @ApiOperation({ summary: 'Name of the agent client asking for access' })
  @ApiResponse({ status: 200, type: McpConsentDetailsResponseDto })
  async getDetails(
    @User() user: AuthenticatedUser,
    @Param('authorizationId') authorizationId: string,
  ): Promise<McpConsentDetailsResponse> {
    const { clientName } = await this.authorizations.getDetails(
      authorizationId,
      user.accessToken,
    );
    return { clientName };
  }

  @Post(':authorizationId/approve')
  @ApiOperation({ summary: 'Grant the client access in the chosen mode' })
  @ApiResponse({ status: 201, type: McpConsentRedirectResponseDto })
  async approve(
    @User() user: AuthenticatedUser,
    @Param('authorizationId') authorizationId: string,
    @Body() body: McpConsentApproveRequestDto,
  ): Promise<McpConsentRedirectResponse> {
    try {
      const redirectUrl = await this.approveConnection.execute({
        authorizationId,
        mode: body.mode,
        user,
      });
      return { redirectUrl };
    } finally {
      user.clientKey.fill(0);
    }
  }

  @SkipClientKey()
  @Post(':authorizationId/deny')
  @ApiOperation({ summary: 'Refuse the request; nothing is stored' })
  @ApiResponse({ status: 201, type: McpConsentRedirectResponseDto })
  async deny(
    @User() user: AuthenticatedUser,
    @Param('authorizationId') authorizationId: string,
  ): Promise<McpConsentRedirectResponse> {
    return {
      redirectUrl: await this.denyConnection.execute(
        authorizationId,
        user.accessToken,
      ),
    };
  }
}
