import { SetMetadata } from '@nestjs/common';
import { _ROLES_KEY, PUBLIC_KEY } from './enhanced-auth.guard';

/**
 * Decorator to mark an endpoint as public (no authentication required)
 */
export const Public = () => SetMetadata(_PUBLIC_KEY, true);

/**
 * Decorator to specify required roles for an endpoint
 * @param roles Array of role names required to access the endpoint
 */
export const Roles = (...roles: string[]) => SetMetadata(_ROLES_KEY, roles);

/**
 * Decorator to require admin role
 */
export const RequireAdmin = () => Roles('admin');

/**
 * Decorator to require authenticated user (any role)
 */
export const RequireAuth = () => SetMetadata(_PUBLIC_KEY, false);
