import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  McpActivityListResponse,
  McpConnectionListResponse,
} from 'pulpe-shared';
import { AuthGuard } from '@common/guards/auth.guard';
import { SkipClientKey } from '@common/decorators/skip-client-key.decorator';
import {
  type AuthenticatedUser,
  User,
} from '@common/decorators/user.decorator';
import { ListActivityUseCase } from '../../application/list-activity.use-case';
import { ListConnectionsUseCase } from '../../application/list-connections.use-case';
import { RevokeConnectionUseCase } from '../../application/revoke-connection.use-case';
import {
  McpActivityListResponseDto,
  McpActivityQueryDto,
  McpConnectionListResponseDto,
} from './dto/mcp-swagger.dto';

/**
 * Settings > Connexions: who holds access, what they did, and the cut. The
 * vault key is not needed to read or revoke; the PIN proved itself when the
 * grant was made.
 */
@ApiTags('MCP')
@Controller({ path: 'mcp/connections', version: '1' })
@UseGuards(AuthGuard)
@SkipClientKey()
export class McpConnectionsController {
  constructor(
    private readonly listConnections: ListConnectionsUseCase,
    private readonly listActivity: ListActivityUseCase,
    private readonly revokeConnection: RevokeConnectionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Active agent connections of the user' })
  @ApiResponse({ status: 200, type: McpConnectionListResponseDto })
  async list(
    @User() user: AuthenticatedUser,
  ): Promise<McpConnectionListResponse> {
    return { success: true, data: await this.listConnections.execute(user.id) };
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Write gestures made through one connection' })
  @ApiResponse({ status: 200, type: McpActivityListResponseDto })
  async activity(
    @User() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: McpActivityQueryDto,
  ): Promise<McpActivityListResponse> {
    return {
      success: true,
      data: await this.listActivity.execute(user.id, id, query),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cut an agent’s access: key destroyed, grant dropped',
  })
  @ApiResponse({ status: 204 })
  async revoke(
    @User() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.revokeConnection.execute(user.id, id, user.accessToken);
  }
}
