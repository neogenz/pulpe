import type { Request, Route } from '@playwright/test';

export { type E2EWindow, type DemoSession } from '../../projects/webapp/src/app/core/auth';

/**
 * Minimal user shape for E2E mocks
 */
export interface E2EUser {
  id: string;
  email: string;
}

/**
 * Minimal session shape for E2E mocks
 */
export interface E2ESession {
  access_token: string;
  user: E2EUser;
}

/**
 * E2E-specific auth state with relaxed types for mocking
 */
export interface E2EAuthState {
  user: E2EUser;
  session: E2ESession;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Extended window interface for E2E testing with relaxed mock types
 */
export interface E2ETestWindow extends Window {
  __E2E_AUTH_BYPASS__?: boolean;
  __E2E_MOCK_AUTH_STATE__?: E2EAuthState;
  __E2E_DEMO_BYPASS__?: boolean;
  __E2E_DEMO_SESSION__?: {
    user: E2EUser;
    access_token: string;
    refresh_token: string;
  };
}

/**
 * Playwright route handler type
 */
export type RouteHandler = (route: Route) => Promise<void> | void;

/**
 * Playwright request handler type
 */
export type RequestHandler = (request: Request) => void;

/**
 * Error event handler type
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Mock API response structure
 */
export interface MockApiResponse {
  status: number;
  body?: string;
  json?: unknown;
}

/**
 * Test user credentials
 */
export interface TestCredentials {
  email: string;
  password: string;
}