import type { DemoAuthUser, DemoAuthSession } from './auth.types';

export interface DemoCredentials {
  email: string;
  password: string;
}

export interface DemoUser {
  userId: string;
  user: DemoAuthUser;
}

export interface DemoSession {
  session: DemoAuthSession;
  user: DemoAuthUser;
}
