import type { Request, Route } from '@playwright/test';

/**
 * Extended Window interface for E2E testing
 */
/**
 * OAuth user metadata from identity providers (Google, Apple, etc.)
 */
export interface OAuthUserMetadata {
  given_name?: string;
  full_name?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

export interface E2EWindow extends Window {
  __E2E_AUTH_BYPASS__?: boolean;
  __E2E_MOCK_AUTH_STATE__?: {
    user: {
      id: string;
      email: string;
      user_metadata?: OAuthUserMetadata;
    };
    session: {
      access_token: string;
      user: {
        id: string;
        email: string;
        user_metadata?: OAuthUserMetadata;
      };
    };
    isLoading: boolean;
    isAuthenticated: boolean;
  };
  __E2E_DEMO_BYPASS__?: boolean;
  __E2E_DEMO_SESSION__?: {
    user: {
      id: string;
      email: string;
    };
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
  json?: any;
}

/**
 * Test user credentials
 */
export interface TestCredentials {
  email: string;
  password: string;
}