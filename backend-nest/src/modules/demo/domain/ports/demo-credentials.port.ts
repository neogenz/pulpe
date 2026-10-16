import type { DemoAuthUser, DemoAuthSession } from '../auth.types';

export const DEMO_CREDENTIALS_PORT = Symbol('DEMO_CREDENTIALS_PORT');

export interface DemoCredentialsPort {
  generateCredentials(): { email: string; password: string };
  createDemoUser(
    email: string,
    password: string,
  ): Promise<{ userId: string; user: DemoAuthUser }>;
  signInDemoUser(
    email: string,
    password: string,
  ): Promise<{ session: DemoAuthSession; user: DemoAuthUser }>;
  /**
   * Makes the demo user the request's authenticated user, as AuthGuard does for
   * a real one. `/demo/session` is public, yet the seed calls other modules'
   * ports (balance recalculation) that read the user and client from the request.
   */
  bindDemoUserToRequest(
    userId: string,
    email: string,
    accessToken: string,
  ): void;
  deleteUser(userId: string): Promise<void>;
  listExpiredDemoUsers(
    cutoffTime: Date,
    throwOnError: boolean,
  ): Promise<{ id: string; email: string }[]>;
  bulkDeleteUsers(userIds: string[]): Promise<{
    fulfilled: string[];
    rejected: { userId: string; reason: string }[];
  }>;
}
