import { SetMetadata } from '@nestjs/common';

/**
 * Public decorator to mark endpoints as publicly accessible
 * Bypasses the AuthGuard for endpoints that don't require authentication
 *
 * Usage:
 * @Public()
 * @Get('endpoint')
 * publicEndpoint() { ... }
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
