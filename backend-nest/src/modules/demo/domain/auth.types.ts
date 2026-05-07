export interface DemoAuthUser {
  id: string;
  email?: string;
  created_at: string;
  user_metadata?: Record<string, unknown>;
}

export interface DemoAuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: DemoAuthUser;
}
