import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { DemoSessionResponseDto } from './dto/demo-session-response.dto';
import { Public } from '@common/decorators/public.decorator';

/**
 * Controller for demo mode functionality
 *
 * Provides public endpoint for creating demo sessions
 * Rate limited to prevent abuse (10 requests/hour per IP)
 */
@ApiTags('Demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

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
}
