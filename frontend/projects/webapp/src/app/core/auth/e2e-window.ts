import type { AuthState } from './auth-state.service';

export interface DemoSession {
  user: {
    id: string;
    email: string;
  };
  access_token: string;
  refresh_token: string;
}

export interface E2EWindow extends Window {
  __E2E_AUTH_BYPASS__?: boolean;
  __E2E_MOCK_AUTH_STATE__?: AuthState;
  __E2E_DEMO_BYPASS__?: boolean;
  __E2E_DEMO_SESSION__?: DemoSession;
}

export function isE2EMode(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as E2EWindow).__E2E_AUTH_BYPASS__ === true
  );
}
