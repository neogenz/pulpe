// Note: Users are managed by Supabase Auth, not in our public tables
// AuthenticatedUser interface is defined in @common/decorators/user.decorator.ts

// Constants for user validation
export const USER_CONSTANTS = {
  FIRST_NAME_MAX_LENGTH: 50,
  LAST_NAME_MAX_LENGTH: 50,
} as const;
