/**
 * URL validation utilities for configuration and user input.
 * Provides secure URL validation and sanitization functions.
 */

/**
 * Validates if a string is a valid HTTP or HTTPS URL.
 *
 * @param url - The URL string to validate
 * @returns true if the URL is valid HTTP/HTTPS, false otherwise
 */
export function isValidUrl(url: unknown): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    // Only allow HTTP and HTTPS protocols for security
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid URL with specified protocols.
 *
 * @param url - The URL string to validate
 * @param allowedProtocols - Array of allowed protocols (e.g., ['http:', 'https:', 'ws:'])
 * @returns true if the URL is valid with allowed protocol, false otherwise
 */
export function isValidHttpUrl(
  url: unknown,
  allowedProtocols: string[] = ['http:', 'https:'],
): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return allowedProtocols.includes(parsedUrl.protocol);
  } catch {
    return false;
  }
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
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmedUrl = url.trim();

  if (isValidUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  return fallback;
}

/**
 * Result of URL validation for configuration objects
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates all URL fields in a configuration object.
 * Checks fields ending with 'Url' or 'URL' recursively.
 *
 * @param config - The configuration object to validate
 * @param path - Current path in the object (for recursive calls)
 * @returns Validation result with any errors found
 */
export function validateConfigUrls(
  config: Record<string, unknown>,
  path = '',
): ValidationResult {
  const errors: string[] = [];

  function validateRecursive(
    obj: Record<string, unknown>,
    currentPath: string,
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = currentPath ? `${currentPath}.${key}` : key;

      // Check if this key should contain a URL
      if (key.endsWith('Url') || key.endsWith('URL')) {
        if (typeof value === 'string') {
          if (!isValidUrl(value)) {
            errors.push(`Invalid URL for ${fullPath}: ${value}`);
          }
        }
      }

      // Recursively check nested objects
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        validateRecursive(value as Record<string, unknown>, fullPath);
      }
    }
  }

  validateRecursive(config, path);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a URL validator with custom protocol whitelist.
 * Useful for creating validators for specific use cases.
 *
 * @param allowedProtocols - Array of allowed protocols
 * @returns A validator function
 */
export function createUrlValidator(
  allowedProtocols: string[] = ['http:', 'https:'],
): (url: unknown) => boolean {
  return (url: unknown): boolean => {
    return isValidHttpUrl(url, allowedProtocols);
  };
}

/**
 * Extracts and validates the base URL from a full URL.
 * Useful for API configuration where we need just the origin.
 *
 * @param url - The full URL
 * @returns The base URL (origin) or null if invalid
 */
export function extractBaseUrl(url: unknown): string | null {
  if (!isValidUrl(url) || typeof url !== 'string') {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch {
    return null;
  }
}

/**
 * Validates if a URL is from a trusted domain.
 *
 * @param url - The URL to check
 * @param trustedDomains - Array of trusted domains
 * @returns true if the URL is from a trusted domain
 */
export function isFromTrustedDomain(
  url: unknown,
  trustedDomains: string[],
): boolean {
  if (!isValidUrl(url) || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return trustedDomains.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}
