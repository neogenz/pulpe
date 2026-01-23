import { isDevMode } from '@angular/core';
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

/**
 * Checks if the application is running in E2E test mode.
 *
 * SECURITY: E2E bypass is ONLY allowed in development mode.
 * In production builds, this always returns false regardless of window properties,
 * preventing XSS attacks from enabling auth bypass.
 */
export function isE2EMode(): boolean {
  // SECURITY: E2E bypass only works in development mode
  // This prevents XSS attacks from setting window.__E2E_AUTH_BYPASS__ in production
  if (!isDevMode()) {
    return false;
  }

  return (
    typeof window !== 'undefined' &&
    (window as E2EWindow).__E2E_AUTH_BYPASS__ === true
  );
}
