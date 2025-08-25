/**
 * URL validation utilities using Zod for configuration and user input.
 * Provides secure URL validation and sanitization functions.
 */

import { z } from 'zod';

// HTTP URL schema - only allows HTTP/HTTPS URLs
const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'Only HTTP/HTTPS URLs allowed',
  );

/**
 * Validates if a string is a valid HTTP or HTTPS URL.
 *
 * @param url - The URL string to validate
 * @returns true if the URL is valid HTTP/HTTPS, false otherwise
 */
export function isValidUrl(url: unknown): boolean {
  return httpUrlSchema.safeParse(url).success;
}

/**
 * Sanitizes a URL by validating it and returning a fallback if invalid.
 * Also trims whitespace from valid URLs.
 *
 * @param url - The URL string to sanitize
 * @param fallback - The fallback URL if validation fails
 * @returns The sanitized URL or fallback
 */
export function sanitizeUrl(
  url: unknown,
  fallback = 'http://localhost:3000',
): string {
  if (typeof url === 'string') {
    const trimmedUrl = url.trim();
    if (httpUrlSchema.safeParse(trimmedUrl).success) {
      return trimmedUrl;
    }
  }
  return fallback;
}
