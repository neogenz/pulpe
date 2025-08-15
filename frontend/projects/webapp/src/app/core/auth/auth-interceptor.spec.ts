import { describe, it, expect } from 'vitest';

// Test simple de la fonction shouldInterceptRequest
function shouldInterceptRequest(url: string, backendApiUrl: string): boolean {
  return url.startsWith(backendApiUrl);
}

describe('shouldInterceptRequest', () => {
  it('should return true for backend URLs', () => {
    const backendUrl = 'https://api.pulpe.ch';

    expect(
      shouldInterceptRequest('https://api.pulpe.ch/users', backendUrl),
    ).toBe(true);
    expect(
      shouldInterceptRequest('https://api.pulpe.ch/auth/login', backendUrl),
    ).toBe(true);
    expect(shouldInterceptRequest('https://api.pulpe.ch', backendUrl)).toBe(
      true,
    );
  });

  it('should return false for non-backend URLs', () => {
    const backendUrl = 'https://api.pulpe.ch';

    expect(
      shouldInterceptRequest('https://external-api.com/data', backendUrl),
    ).toBe(false);
    expect(shouldInterceptRequest('https://google.com', backendUrl)).toBe(
      false,
    );
    expect(shouldInterceptRequest('http://localhost:3000', backendUrl)).toBe(
      false,
    );
  });

  it('should handle different backend URL formats', () => {
    expect(
      shouldInterceptRequest(
        'https://api.pulpe.ch/users',
        'https://api.pulpe.ch',
      ),
    ).toBe(true);
    expect(
      shouldInterceptRequest(
        'http://localhost:8080/api/users',
        'http://localhost:8080/api',
      ),
    ).toBe(true);
    expect(
      shouldInterceptRequest(
        'https://api.pulpe.ch/users',
        'http://api.pulpe.ch',
      ),
    ).toBe(false);
  });
});
