import { describe, it, expect } from 'vitest';

function shouldAddClientKey(
  clientKeyHex: string | null,
  requestUrl: string,
  backendApiUrl: string,
  hasExistingHeader: boolean,
): boolean {
  return !!clientKeyHex && requestUrl.startsWith(backendApiUrl) && !hasExistingHeader;
}

describe('shouldAddClientKey', () => {
  const backendApiUrl = 'https://api.pulpe.ch';
  const clientKey = 'abc123def456';

  it('should return true when clientKey exists and URL matches backend', () => {
    expect(
      shouldAddClientKey(clientKey, 'https://api.pulpe.ch/users', backendApiUrl, false),
    ).toBe(true);
    expect(
      shouldAddClientKey(clientKey, 'https://api.pulpe.ch/auth/login', backendApiUrl, false),
    ).toBe(true);
    expect(shouldAddClientKey(clientKey, 'https://api.pulpe.ch', backendApiUrl, false)).toBe(
      true,
    );
  });

  it('should return false when no clientKey', () => {
    expect(
      shouldAddClientKey(null, 'https://api.pulpe.ch/users', backendApiUrl, false),
    ).toBe(false);
    expect(
      shouldAddClientKey('', 'https://api.pulpe.ch/users', backendApiUrl, false),
    ).toBe(false);
  });

  it('should return false when URL does not match backend', () => {
    expect(
      shouldAddClientKey(clientKey, 'https://external-api.com/data', backendApiUrl, false),
    ).toBe(false);
    expect(shouldAddClientKey(clientKey, 'https://google.com', backendApiUrl, false)).toBe(
      false,
    );
    expect(
      shouldAddClientKey(clientKey, 'http://localhost:3000', backendApiUrl, false),
    ).toBe(false);
  });

  it('should return false when request already has X-Client-Key header', () => {
    expect(
      shouldAddClientKey(clientKey, 'https://api.pulpe.ch/users', backendApiUrl, true),
    ).toBe(false);
    expect(
      shouldAddClientKey(clientKey, 'https://api.pulpe.ch/auth/login', backendApiUrl, true),
    ).toBe(false);
  });

  it('should handle different backend URL formats', () => {
    expect(
      shouldAddClientKey(clientKey, 'https://api.pulpe.ch/users', 'https://api.pulpe.ch', false),
    ).toBe(true);
    expect(
      shouldAddClientKey(
        clientKey,
        'http://localhost:8080/api/users',
        'http://localhost:8080/api',
        false,
      ),
    ).toBe(true);
    expect(
      shouldAddClientKey(
        clientKey,
        'https://api.pulpe.ch/users',
        'http://api.pulpe.ch',
        false,
      ),
    ).toBe(false);
  });
});
