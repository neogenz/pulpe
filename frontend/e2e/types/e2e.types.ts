import type { Request, Route } from '@playwright/test';
import { type E2EWindow } from '../../projects/webapp/src/app/core/auth';

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