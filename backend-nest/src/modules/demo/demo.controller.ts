import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { DemoCleanupService } from './demo-cleanup.service';
import { DemoSessionResponseDto } from './dto/demo-session-response.dto';
import { DemoCleanupResponseDto } from './dto/demo-cleanup-response.dto';
import { Public } from '@common/decorators/public.decorator';
import { DevOnlyGuard } from '@common/guards/dev-only.guard';

/**
 * Controller for demo mode functionality
 *
 * Provides public endpoint for creating demo sessions
 * Rate limited to prevent abuse (10 requests/hour per IP)
 */
@ApiTags('Demo')
@Controller('demo')
export class DemoController {
  constructor(
    private readonly demoService: DemoService,
    private readonly demoCleanupService: DemoCleanupService,
  ) {}

  /**
   * Creates a new demo session with an ephemeral user
   *
   * This endpoint:
   * - Creates a temporary user via Supabase Admin API
   * - Seeds realistic demo data (templates, budgets, transactions)
   * - Returns a real Supabase session (JWT tokens)
   * - User and data are automatically cleaned up after 24 hours
   *
   * Rate limited to 10 requests per hour per IP
   */
  @Post('session')
  @Public() // No authentication required
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ demo: { limit: 10, ttl: 3600000 } }) // 10 requests per hour
  @ApiOperation({
    summary: 'Create a demo session',
    description:
      'Creates an ephemeral user with pre-seeded demo data and returns authentication tokens',
  })
  @ApiResponse({
    status: 201,
    description: 'Demo session created successfully',
    type: DemoSessionResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests (rate limit exceeded)',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async createDemoSession(): Promise<DemoSessionResponseDto> {
    return await this.demoService.createDemoSession();
  }

  /**
   * Deletes all demo users (development only)
   *
   * This endpoint:
   * - Only accessible in development/test environments
   * - Deletes ALL demo users regardless of age
   * - Returns count of deleted and failed deletions
   * - Useful for cleaning up test data during development
   *
   * Blocked in production and preview environments
   */
  @Post('cleanup')
  @Public() // No authentication required
  @UseGuards(DevOnlyGuard) // Only accessible in development
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
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async cleanupAllDemoUsers(): Promise<DemoCleanupResponseDto> {
    const result = await this.demoCleanupService.cleanupDemoUsersByAge(0);
    return {
      success: true,
      data: result,
      message: `${result.deleted} demo user(s) deleted, ${result.failed} failed`,
    };
  }
}
