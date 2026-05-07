import type { Session, User } from '@supabase/supabase-js';

export const DEMO_CREDENTIALS_PORT = Symbol('DEMO_CREDENTIALS_PORT');

export interface DemoCredentialsPort {
  generateCredentials(): { email: string; password: string };
  createDemoUser(
    email: string,
    password: string,
  ): Promise<{ userId: string; user: User }>;
  signInDemoUser(
    email: string,
    password: string,
  ): Promise<{ session: Session; user: User }>;
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
