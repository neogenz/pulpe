import type { Session, User } from '@supabase/supabase-js';

export interface DemoCredentials {
  email: string;
  password: string;
}

export interface DemoUser {
  userId: string;
  user: User;
}

export interface DemoSession {
  session: Session;
  user: User;
}
