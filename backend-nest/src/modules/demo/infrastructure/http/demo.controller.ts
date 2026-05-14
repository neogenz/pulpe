import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Body,
  Ip,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DevOnlyGuard } from '@common/guards/dev-only.guard';
import { TurnstileService } from '@common/services/turnstile.service';
import { CreateDemoSessionUseCase } from '../../application/create-demo-session.use-case';
import { CleanupDemoUsersByAgeUseCase } from '../../application/cleanup-demo-users-by-age.use-case';
import { CreateDemoSessionDto } from './dto/create-demo-session.dto';
import { DemoSessionResponseDto } from './dto/demo-session-response.dto';
import { DemoCleanupResponseDto } from './dto/demo-cleanup-response.dto';

@ApiTags('Demo')
@Controller({ path: 'demo', version: '1' })
export class DemoController {
  constructor(
    private readonly createDemoSession: CreateDemoSessionUseCase,
    private readonly cleanupDemoUsersByAge: CleanupDemoUsersByAgeUseCase,
    private readonly turnstileService: TurnstileService,
  ) {}

  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ demo: { limit: 30, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Create a demo session',
    description:
      'Creates an ephemeral user with pre-seeded demo data and returns authentication tokens. Requires Cloudflare Turnstile token for anti-bot protection.',
  })
  @ApiResponse({
    status: 201,
    description: 'Demo session created successfully',
    type: DemoSessionResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Turnstile verification failed' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (rate limit exceeded)',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async createSession(
    @Body() body: CreateDemoSessionDto,
    @Ip() ip: string,
  ): Promise<DemoSessionResponseDto> {
    const { turnstileToken } = body;

    const isValidToken = await this.turnstileService.verify(turnstileToken, ip);

    if (!isValidToken) {
      throw new ForbiddenException(
        'La vérification anti-robot a échoué — réessaie',
      );
    }

    return await this.createDemoSession.execute();
  }

  @Post('cleanup')
  @UseGuards(DevOnlyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiTags('Demo (Dev Only)')
  @ApiOperation({
    summary: 'Delete all demo users (development only)',
    description:
      'Deletes all demo users regardless of age. Only accessible in development and test environments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo users cleaned up successfully',
    type: DemoCleanupResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only available in development mode',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async cleanupAllDemoUsers(): Promise<DemoCleanupResponseDto> {
    const result = await this.cleanupDemoUsersByAge.execute(0);
    return {
      success: true,
      data: result,
      message: `${result.deleted} demo user(s) deleted, ${result.failed} failed`,
    };
  }
}
