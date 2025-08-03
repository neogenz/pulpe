import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Parameter decorator to inject the authenticated Supabase client
 * @example
 * ```typescript
 * @Post()
 * async create(@SupabaseClient() client: SupabaseClient, @Body() dto: CreateDto) {
 *   // Use client for database operations
 * }
 * ```
 */
export const SupabaseClient = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.supabaseClient;
  },
);
