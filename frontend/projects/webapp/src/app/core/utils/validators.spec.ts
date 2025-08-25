import { isValidUrl, sanitizeUrl } from './validators';

describe('URL Validators', () => {
  describe('isValidUrl', () => {
    it('should validate correct HTTP URLs', () => {
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://api.example.com/v1')).toBe(true);
      expect(isValidUrl('http://192.168.1.1:8080')).toBe(true);
    });

    it('should validate correct HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://api.example.com/v1/users')).toBe(true);
      expect(isValidUrl('https://example.com:443')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      // Note: 'http://.' is actually valid per URL constructor
      expect(isValidUrl('http://.')).toBe(true);
    });

    it('should reject non-HTTP(S) protocols', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
      expect(isValidUrl('data:text/plain,test')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });

    it('should handle special characters in URLs', () => {
      expect(isValidUrl('https://example.com/path?query=value&other=123')).toBe(
        true,
      );
      expect(isValidUrl('https://example.com/path#fragment')).toBe(true);
      expect(isValidUrl('https://user:pass@example.com')).toBe(true);
    });
  });

  describe('sanitizeUrl', () => {
    it('should return valid URLs unchanged', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('http://localhost:3000/api')).toBe(
        'http://localhost:3000/api',
      );
    });

    it('should return fallback for invalid URLs', () => {
      expect(sanitizeUrl('not-a-url')).toBe('http://localhost:3000');
      expect(sanitizeUrl('')).toBe('http://localhost:3000');
      expect(sanitizeUrl('javascript:alert(1)')).toBe('http://localhost:3000');
    });

    it('should use custom fallback', () => {
      const customFallback = 'https://default.com';
      expect(sanitizeUrl('invalid', customFallback)).toBe(customFallback);
      expect(sanitizeUrl('', customFallback)).toBe(customFallback);
    });

    it('should trim whitespace from URLs', () => {
      expect(sanitizeUrl('  https://example.com  ')).toBe(
        'https://example.com',
      );
      expect(sanitizeUrl('\nhttps://example.com\t')).toBe(
        'https://example.com',
      );
    });

    it('should handle null and undefined', () => {
      expect(sanitizeUrl(null)).toBe('http://localhost:3000');
      expect(sanitizeUrl(undefined)).toBe('http://localhost:3000');
    });
  });
});
